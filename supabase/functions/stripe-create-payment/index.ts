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

  // BookEvo SaaS does NOT process customer payments.
  // This endpoint is a stub for future marketplace/operator mode (Frha).
  return new Response(
    JSON.stringify({
      error: "Payment processing is not available in BookEvo SaaS. Bookings use offline payments only.",
      hint: "Use 'Mark as Paid' in the vendor portal to confirm offline payments.",
    }),
    {
      status: 503,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    }
  );
});
