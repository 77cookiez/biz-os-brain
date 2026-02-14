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
    const PLATFORM_STRIPE_WEBHOOK_SECRET = Deno.env.get("PLATFORM_STRIPE_WEBHOOK_SECRET");
    if (!PLATFORM_STRIPE_SECRET_KEY || !PLATFORM_STRIPE_WEBHOOK_SECRET) {
      throw new Error("Stripe secrets not configured");
    }

    const stripe = new Stripe(PLATFORM_STRIPE_SECRET_KEY, { apiVersion: "2024-12-18.acacia" });

    // Verify webhook signature
    const body = await req.text();
    const sig = req.headers.get("stripe-signature");
    if (!sig) {
      return new Response(JSON.stringify({ error: "Missing signature" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let event: Stripe.Event;
    try {
      event = await stripe.webhooks.constructEventAsync(body, sig, PLATFORM_STRIPE_WEBHOOK_SECRET);
    } catch (err) {
      console.error("Webhook signature verification failed:", err);
      return new Response(JSON.stringify({ error: "Invalid signature" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Handle Connect account events
    if (event.type === "account.updated") {
      const account = event.data.object as Stripe.Account;
      if (account.charges_enabled && account.payouts_enabled) {
        await adminClient
          .from("booking_settings")
          .update({ stripe_onboarding_completed: true })
          .eq("stripe_account_id", account.id);
        console.log(`Stripe onboarding completed for account ${account.id}`);
      }
    }

    // Handle payment events (from connected accounts)
    if (event.type === "payment_intent.succeeded") {
      const pi = event.data.object as Stripe.PaymentIntent;
      const meta = pi.metadata;
      if (meta?.quote_id && meta?.workspace_id) {
        const paymentType = meta.payment_type || "full";

        // Update quote payment status
        await adminClient
          .from("booking_quotes")
          .update({ payment_status: "paid" })
          .eq("id", meta.quote_id);

        // Update or create booking
        const newStatus = paymentType === "deposit" ? "deposit_paid" : "confirmed";

        const { data: existingBooking } = await adminClient
          .from("booking_bookings")
          .select("id")
          .eq("quote_id", meta.quote_id)
          .maybeSingle();

        if (existingBooking) {
          await adminClient
            .from("booking_bookings")
            .update({
              status: newStatus,
              payment_intent_id: pi.id,
              payment_provider: "stripe",
              paid_amount: pi.amount / 100,
              ...(paymentType === "deposit" ? { deposit_paid: pi.amount / 100 } : {}),
            })
            .eq("id", existingBooking.id);
        }

        // Record payment
        await adminClient.from("booking_payments").insert({
          booking_id: existingBooking?.id,
          workspace_id: meta.workspace_id,
          amount: pi.amount / 100,
          currency: pi.currency.toUpperCase(),
          status: "paid",
          provider: "stripe",
          payment_type: paymentType,
          payment_reference: pi.id,
          paid_at: new Date().toISOString(),
          metadata: { stripe_account: event.account },
        });

        console.log(`Payment succeeded: ${pi.id} for quote ${meta.quote_id}`);
      }
    }

    if (event.type === "payment_intent.payment_failed") {
      const pi = event.data.object as Stripe.PaymentIntent;
      const meta = pi.metadata;
      if (meta?.quote_id) {
        await adminClient
          .from("booking_quotes")
          .update({ payment_status: "failed" })
          .eq("id", meta.quote_id);
        console.log(`Payment failed: ${pi.id} for quote ${meta.quote_id}`);
      }
    }

    if (event.type === "charge.refunded") {
      const charge = event.data.object as Stripe.Charge;
      const pi = charge.payment_intent;
      if (pi) {
        const piId = typeof pi === "string" ? pi : pi.id;
        await adminClient
          .from("booking_bookings")
          .update({ status: "refunded" })
          .eq("payment_intent_id", piId);

        await adminClient
          .from("booking_payments")
          .update({ status: "refunded", refunded_at: new Date().toISOString() })
          .eq("payment_reference", piId);

        console.log(`Charge refunded for payment intent ${piId}`);
      }
    }

    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    console.error("stripe-webhook error:", error);
    const msg = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
