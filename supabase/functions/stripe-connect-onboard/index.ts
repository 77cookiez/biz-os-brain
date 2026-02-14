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

    const { workspace_id, return_url, refresh_url } = await req.json();
    if (!workspace_id) {
      return new Response(JSON.stringify({ error: "workspace_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify user is workspace admin
    const { data: isAdmin } = await supabase.rpc("is_workspace_admin", {
      _user_id: userId,
      _workspace_id: workspace_id,
    });
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: "Forbidden: admin only" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const stripe = new Stripe(PLATFORM_STRIPE_SECRET_KEY, { apiVersion: "2024-12-18.acacia" });

    // Check if tenant already has a stripe_account_id
    const { data: settings } = await supabase
      .from("booking_settings")
      .select("stripe_account_id, stripe_onboarding_completed")
      .eq("workspace_id", workspace_id)
      .single();

    let stripeAccountId = settings?.stripe_account_id;

    if (!stripeAccountId) {
      // Create new Express connected account
      const account = await stripe.accounts.create({
        type: "express",
        metadata: { workspace_id },
      });
      stripeAccountId = account.id;

      // Save to booking_settings
      const adminClient = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
      );
      await adminClient
        .from("booking_settings")
        .update({
          stripe_account_id: stripeAccountId,
          stripe_onboarding_completed: false,
        })
        .eq("workspace_id", workspace_id);
    }

    // Create account link for onboarding
    const accountLink = await stripe.accountLinks.create({
      account: stripeAccountId,
      refresh_url: refresh_url || `${req.headers.get("origin")}/apps/booking/settings`,
      return_url: return_url || `${req.headers.get("origin")}/apps/booking/settings?stripe=success`,
      type: "account_onboarding",
    });

    return new Response(
      JSON.stringify({ url: accountLink.url, stripe_account_id: stripeAccountId }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: unknown) {
    console.error("stripe-connect-onboard error:", error);
    const msg = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
