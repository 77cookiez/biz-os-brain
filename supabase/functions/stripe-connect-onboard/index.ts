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

  // BookEvo SaaS does NOT use Stripe Connect for booking payments.
  // This is a stub for future marketplace/operator mode (Frha).
  return new Response(
    JSON.stringify({
      error: "Stripe Connect is not available in BookEvo SaaS mode. Bookings use offline payments only.",
      hint: "Stripe Connect is reserved for the Frha Operator product.",
    }),
    {
      status: 503,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    }
  );
});
