import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Use service role to read all workspace members
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Get distinct user_id + workspace_id pairs (only accepted members)
    const { data: members, error } = await supabase
      .from("workspace_members")
      .select("user_id, workspace_id")
      .eq("invite_status", "accepted");

    if (error) {
      console.error("Failed to fetch workspace members:", error);
      return new Response(
        JSON.stringify({ error: "Failed to fetch members" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const digestUrl = `${supabaseUrl}/functions/v1/weekly-digest`;
    const results: Array<{ user_id: string; workspace_id: string; status: string }> = [];

    // Call weekly-digest for each user/workspace pair
    for (const member of members || []) {
      try {
        // Use service role as auth header so the digest function can operate
        const resp = await fetch(digestUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${serviceRoleKey}`,
            apikey: anonKey,
          },
          body: JSON.stringify({
            workspace_id: member.workspace_id,
            user_id: member.user_id,
          }),
        });

        const data = await resp.json();
        results.push({
          user_id: member.user_id,
          workspace_id: member.workspace_id,
          status: data.skipped ? `skipped:${data.reason}` : "generated",
        });
      } catch (e) {
        console.error(`Digest failed for ${member.user_id}:`, e);
        results.push({
          user_id: member.user_id,
          workspace_id: member.workspace_id,
          status: "error",
        });
      }
    }

    console.log(`Weekly digest cron completed: ${results.length} members processed`);

    return new Response(
      JSON.stringify({ success: true, processed: results.length, results }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("weekly-digest-cron error:", error);
    return new Response(
      JSON.stringify({ error: "Cron job failed" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
