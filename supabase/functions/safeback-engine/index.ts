import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function getServiceClient() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // ── Auth via getClaims ──
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return json({ error: "Unauthorized" }, 401);
    }

    const token = authHeader.replace("Bearer ", "");
    const anonClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: claimsData, error: claimsErr } =
      await anonClient.auth.getClaims(token);
    if (claimsErr || !claimsData?.claims) {
      return json({ error: "Unauthorized" }, 401);
    }

    const userId = claimsData.claims.sub as string;

    const url = new URL(req.url);
    const path = url.pathname.split("/").pop();
    const body = req.method === "POST" ? await req.json() : {};

    const sb = getServiceClient();

    // ── Verify workspace admin ──
    async function assertAdmin(workspaceId: string) {
      const { data } = await sb.rpc("is_workspace_admin", {
        _user_id: userId,
        _workspace_id: workspaceId,
      });
      if (!data)
        throw Object.assign(new Error("FORBIDDEN"), { status: 403 });
    }

    // ── CAPTURE (v3) ──
    if (path === "capture") {
      const { workspace_id, reason } = body;
      if (!workspace_id) return json({ error: "workspace_id required" }, 400);
      await assertAdmin(workspace_id);

      const { data, error } = await sb.rpc("capture_workspace_snapshot_v3", {
        _workspace_id: workspace_id,
        _snapshot_type: "manual",
        _reason: reason || null,
        _actor: userId,
      });
      if (error) throw error;
      return json({ snapshot_id: data });
    }

    // ── PREVIEW (v3) ──
    if (path === "preview") {
      const { snapshot_id } = body;
      if (!snapshot_id) return json({ error: "snapshot_id required" }, 400);

      // Derive workspace_id from snapshot (never trust client)
      const { data: snap, error: snapErr } = await sb
        .from("workspace_snapshots")
        .select("workspace_id")
        .eq("id", snapshot_id)
        .single();
      if (snapErr || !snap) return json({ error: "Snapshot not found" }, 404);
      await assertAdmin(snap.workspace_id);

      // preview_restore_v3 uses auth.uid() internally for token creation,
      // so call via the user's anon client
      const { data, error } = await anonClient.rpc("preview_restore_v3", {
        _snapshot_id: snapshot_id,
      });
      if (error) throw error;
      return json(data);
    }

    // ── RESTORE (v3) ──
    if (path === "restore") {
      const { snapshot_id, confirmation_token } = body;
      if (!snapshot_id || !confirmation_token) {
        return json(
          { error: "snapshot_id, confirmation_token required" },
          400
        );
      }

      // Derive workspace_id from snapshot (never trust client)
      const { data: snap, error: snapErr } = await sb
        .from("workspace_snapshots")
        .select("workspace_id")
        .eq("id", snapshot_id)
        .single();
      if (snapErr || !snap) return json({ error: "Snapshot not found" }, 404);
      await assertAdmin(snap.workspace_id);

      const { data, error } = await sb.rpc(
        "restore_workspace_snapshot_atomic_v3",
        {
          _workspace_id: snap.workspace_id,
          _snapshot_id: snapshot_id,
          _actor: userId,
          _confirmation_token: confirmation_token,
        }
      );
      if (error) throw error;
      return json(data);
    }

    // ── PROVIDERS (read registry) ──
    if (path === "providers") {
      const { workspace_id } = body;
      if (!workspace_id) return json({ error: "workspace_id required" }, 400);

      const { data, error } = await sb.rpc("get_effective_snapshot_providers", {
        _workspace_id: workspace_id,
      });
      if (error) throw error;
      return json({ providers: data });
    }

    return json({ error: "Unknown action" }, 404);
  } catch (err: any) {
    const status = err.status || 500;
    console.error("safeback-engine error:", err.message || err);
    return json({ error: err.message || "Internal error" }, status);
  }
});
