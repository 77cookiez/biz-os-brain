import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const requestId = crypto.randomUUID();

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Auth: get user from token
    const authHeader = req.headers.get("Authorization") || "";
    const token = authHeader.replace("Bearer ", "");
    if (!token) {
      return new Response(
        JSON.stringify({ ok: false, code: "UNAUTHORIZED", request_id: requestId }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY") || serviceKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const { data: { user }, error: userErr } = await userClient.auth.getUser(token);
    if (userErr || !user) {
      return new Response(
        JSON.stringify({ ok: false, code: "UNAUTHORIZED", request_id: requestId }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const url = new URL(req.url);
    const snapshotId = url.searchParams.get("snapshot_id");
    if (!snapshotId) {
      return new Response(
        JSON.stringify({ ok: false, code: "BAD_REQUEST", message: "snapshot_id required", request_id: requestId }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const sb = createClient(supabaseUrl, serviceKey);

    // Load snapshot
    const { data: snap, error: snapErr } = await sb
      .from("workspace_snapshots")
      .select("*")
      .eq("id", snapshotId)
      .single();

    if (snapErr || !snap) {
      return new Response(
        JSON.stringify({ ok: false, code: "NOT_FOUND", request_id: requestId }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Admin check
    const { data: isAdmin } = await sb.rpc("is_workspace_admin", {
      _user_id: user.id,
      _workspace_id: snap.workspace_id,
    });

    if (!isAdmin) {
      return new Response(
        JSON.stringify({ ok: false, code: "FORBIDDEN", request_id: requestId }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // If stored in storage, return signed URL
    if (snap.storage_path) {
      const { data: signedUrl, error: signErr } = await sb.storage
        .from("workspace-backups")
        .createSignedUrl(snap.storage_path, 600); // 10 min expiry

      if (!signErr && signedUrl) {
        return new Response(
          JSON.stringify({ ok: true, download_url: signedUrl.signedUrl, expires_in_seconds: 600, request_id: requestId }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
    }

    // Fallback: return inline JSON
    return new Response(
      JSON.stringify({ ok: true, snapshot: snap.snapshot_json, request_id: requestId }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("[backup-export] error:", error);
    return new Response(
      JSON.stringify({ ok: false, code: "INTERNAL_ERROR", request_id: requestId }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
