import Stripe from "npm:stripe@17";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const PLATFORM_STRIPE_SECRET_KEY = Deno.env.get("PLATFORM_STRIPE_SECRET_KEY");
    if (!PLATFORM_STRIPE_SECRET_KEY) {
      throw new Error("PLATFORM_STRIPE_SECRET_KEY not configured");
    }

    // Auth check
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = claimsData.claims.sub;

    const { quote_id, workspace_id } = await req.json();
    if (!quote_id || !workspace_id) {
      return new Response(JSON.stringify({ error: "quote_id and workspace_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify workspace membership
    const { data: isMember } = await supabase.rpc("is_workspace_member", {
      _user_id: userId,
      _workspace_id: workspace_id,
    });
    if (!isMember) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get quote details
    const { data: quote, error: quoteError } = await supabase
      .from("booking_quotes")
      .select("*")
      .eq("id", quote_id)
      .eq("workspace_id", workspace_id)
      .single();

    if (quoteError || !quote) {
      return new Response(JSON.stringify({ error: "Quote not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get tenant's Stripe account
    const { data: settings } = await supabase
      .from("booking_settings")
      .select("stripe_account_id, stripe_onboarding_completed, commission_rate")
      .eq("workspace_id", workspace_id)
      .single();

    if (!settings?.stripe_account_id || !settings.stripe_onboarding_completed) {
      return new Response(
        JSON.stringify({ error: "Tenant has not completed Stripe onboarding" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const stripe = new Stripe(PLATFORM_STRIPE_SECRET_KEY, { apiVersion: "2024-12-18.acacia" });

    // Determine amount: deposit or full
    const paymentType = quote.payment_required_type || "deposit";
    let paymentAmount: number;
    if (paymentType === "deposit" && quote.deposit_amount) {
      paymentAmount = Math.round(quote.deposit_amount * 100); // cents
    } else {
      paymentAmount = Math.round(quote.amount * 100); // cents
    }

    // Calculate platform fee (commission)
    const commissionRate = settings.commission_rate || 0;
    const applicationFee = commissionRate > 0
      ? Math.round(paymentAmount * (commissionRate / 100))
      : undefined;

    // Create payment intent on tenant's connected account
    const paymentIntentParams: Stripe.PaymentIntentCreateParams = {
      amount: paymentAmount,
      currency: quote.currency.toLowerCase(),
      automatic_payment_methods: { enabled: true },
      metadata: {
        quote_id: quote.id,
        quote_request_id: quote.quote_request_id,
        workspace_id,
        customer_user_id: userId,
        payment_type: paymentType,
      },
    };

    if (applicationFee && applicationFee > 0) {
      paymentIntentParams.application_fee_amount = applicationFee;
    }

    const paymentIntent = await stripe.paymentIntents.create(
      paymentIntentParams,
      { stripeAccount: settings.stripe_account_id }
    );

    return new Response(
      JSON.stringify({
        client_secret: paymentIntent.client_secret,
        payment_intent_id: paymentIntent.id,
        stripe_account_id: settings.stripe_account_id,
        amount: paymentAmount,
        currency: quote.currency,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: unknown) {
    console.error("stripe-create-payment error:", error);
    const msg = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
