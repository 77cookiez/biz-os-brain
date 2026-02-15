import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-maintenance-key",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const startMs = Date.now();
  const requestId = crypto.randomUUID();

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // ── Auth: require service role key via Authorization header ──
    const authHeader = req.headers.get("Authorization") || "";
    const token = authHeader.replace("Bearer ", "");

    if (token !== serviceKey) {
      return new Response(
        JSON.stringify({ ok: false, reason: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const sb = createClient(supabaseUrl, serviceKey);

    // ── 1. Cleanup expired draft confirmations ──
    const { data: confirmationsDeleted, error: err1 } = await sb.rpc(
      "cleanup_expired_draft_confirmations",
      {},
    );
    if (err1) {
      console.error("[maintenance-cleanup] draft confirmations cleanup error:", err1.message);
    }

    // ── 2. Cleanup stale reserved executed_drafts ──
    const { data: staleDeleted, error: err2 } = await sb.rpc(
      "cleanup_stale_executed_drafts",
      {},
    );
    if (err2) {
      console.error("[maintenance-cleanup] stale reservations cleanup error:", err2.message);
    }

    const runtimeMs = Date.now() - startMs;
    const confirmsCount = confirmationsDeleted ?? 0;
    const staleCount = staleDeleted ?? 0;

    // ── 3. Emit observability org_event (best-effort) ──
    try {
      // Find any workspace for the org_event — use a system sentinel or skip if none
      // For maintenance events we use a "system" event that doesn't require a workspace
      // but org_events requires workspace_id, so we pick the first active one
      if (confirmsCount > 0 || staleCount > 0) {
        const { data: ws } = await sb.from("workspaces").select("id").limit(1).single();
        if (ws) {
          await sb.from("org_events").insert({
            workspace_id: ws.id,
            event_type: "maintenance.cleanup",
            object_type: "system",
            severity_hint: "info",
            metadata: {
              request_id: requestId,
              confirmations_deleted: confirmsCount,
              stale_reservations_deleted: staleCount,
              runtime_ms: runtimeMs,
            },
          });
        }
      }
    } catch (e) {
      console.warn("[maintenance-cleanup] org_event write failed:", e);
    }

    return new Response(
      JSON.stringify({
        ok: true,
        confirmations_deleted: confirmsCount,
        stale_reservations_deleted: staleCount,
        runtime_ms: runtimeMs,
        request_id: requestId,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("[maintenance-cleanup] unexpected error:", error);
    return new Response(
      JSON.stringify({ ok: false, reason: "Internal error", request_id: requestId }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
