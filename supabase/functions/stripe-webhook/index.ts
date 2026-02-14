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

  // BookEvo SaaS does NOT process customer payments via Stripe.
  // This webhook stub acknowledges events but takes no action.
  // Future: Frha Operator product may implement full webhook handling.
  console.log("stripe-webhook: BookEvo SaaS mode — no payment processing. Acknowledging.");
  return new Response(
    JSON.stringify({ received: true, note: "BookEvo SaaS mode — no payment processing active." }),
    {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    }
  );
});
