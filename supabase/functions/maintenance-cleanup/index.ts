import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-maintenance-key",
};

// ─── Environment / Prod Lock ───
const APP_ENV = () => Deno.env.get("APP_ENV") || "dev";

function structuredLog(fields: Record<string, unknown>): void {
  console.log(JSON.stringify({
    ts: new Date().toISOString(),
    function: "maintenance-cleanup",
    ...fields,
  }));
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const startMs = Date.now();
  const requestId = crypto.randomUUID();

  try {
    // ── Prod lock: POST only, reject query params ──
    if (APP_ENV() === "prod") {
      if (req.method !== "POST") {
        return new Response(
          JSON.stringify({ ok: false, code: "METHOD_NOT_ALLOWED", request_id: requestId }),
          { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      const url = new URL(req.url);
      if (url.search && url.search !== "") {
        return new Response(
          JSON.stringify({ ok: false, code: "BAD_REQUEST", request_id: requestId }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
    }

    // ── IP allowlist (optional) ──
    const allowedIps = Deno.env.get("MAINTENANCE_ALLOWED_IPS");
    if (allowedIps) {
      const clientIp = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
                       req.headers.get("cf-connecting-ip") || "";
      const allowed = allowedIps.split(",").map(s => s.trim());
      if (clientIp && !allowed.includes(clientIp)) {
        structuredLog({ status_code: 403, code: "IP_BLOCKED", request_id: requestId });
        return new Response(
          JSON.stringify({ ok: false, code: "FORBIDDEN", request_id: requestId }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
    }

    // ── Auth: x-maintenance-key ──
    const maintenanceKey = Deno.env.get("MAINTENANCE_KEY");
    const providedKey = req.headers.get("x-maintenance-key") || "";

    if (!maintenanceKey || providedKey !== maintenanceKey) {
      structuredLog({ status_code: 401, code: "UNAUTHORIZED", request_id: requestId });
      return new Response(
        JSON.stringify({ ok: false, code: "UNAUTHORIZED", request_id: requestId }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const sb = createClient(supabaseUrl, serviceKey);

    // ── 1. Cleanup expired draft confirmations ──
    const { data: confirmationsDeleted, error: err1 } = await sb.rpc(
      "cleanup_expired_draft_confirmations",
      {},
    );
    if (err1) {
      structuredLog({ step: "draft_confirmations", error: err1.message, request_id: requestId });
    }

    // ── 2. Cleanup stale reserved executed_drafts ──
    const { data: staleDeleted, error: err2 } = await sb.rpc(
      "cleanup_stale_executed_drafts",
      {},
    );
    if (err2) {
      structuredLog({ step: "stale_reservations", error: err2.message, request_id: requestId });
    }

    // ── 3. Cleanup old request dedupes (M8) ──
    const { data: dedupesDeleted, error: err3 } = await sb.rpc(
      "cleanup_request_dedupes",
      { _older_than_minutes: 60, _batch: 1000 },
    );
    if (err3) {
      structuredLog({ step: "request_dedupes", error: err3.message, request_id: requestId });
    }

    // ── 4. Cleanup old rate limits (M8) ──
    const { data: rateLimitsDeleted, error: err4 } = await sb.rpc(
      "cleanup_rate_limits",
      { _older_than_hours: 24, _batch: 1000 },
    );
    if (err4) {
      structuredLog({ step: "rate_limits", error: err4.message, request_id: requestId });
    }

    const runtimeMs = Date.now() - startMs;
    const confirmsCount = confirmationsDeleted ?? 0;
    const staleCount = staleDeleted ?? 0;
    const dedupesCount = dedupesDeleted ?? 0;
    const rateLimitsCount = rateLimitsDeleted ?? 0;

    // ── 5. Structured log ──
    structuredLog({
      status_code: 200,
      code: "OK",
      request_id: requestId,
      confirmations_deleted: confirmsCount,
      stale_deleted: staleCount,
      dedupes_deleted: dedupesCount,
      rate_limits_deleted: rateLimitsCount,
      runtime_ms: runtimeMs,
    });

    return new Response(
      JSON.stringify({
        ok: true,
        confirmations_deleted: confirmsCount,
        stale_reservations_deleted: staleCount,
        dedupes_deleted: dedupesCount,
        rate_limits_deleted: rateLimitsCount,
        runtime_ms: runtimeMs,
        request_id: requestId,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    structuredLog({ status_code: 500, code: "INTERNAL_ERROR", request_id: requestId, runtime_ms: Date.now() - startMs });
    console.error("[maintenance-cleanup] unexpected error:", error);
    return new Response(
      JSON.stringify({ ok: false, code: "INTERNAL_ERROR", request_id: requestId }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
