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

async function getAuthUser(req: Request) {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return null;
  const token = authHeader.replace("Bearer ", "");
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const anonClient = createClient(supabaseUrl, supabaseKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const {
    data: { user },
    error,
  } = await anonClient.auth.getUser(token);
  if (error || !user) return null;
  return user;
}

function getServiceClient() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const user = await getAuthUser(req);
    if (!user) return json({ error: "Unauthorized" }, 401);

    const url = new URL(req.url);
    const path = url.pathname.split("/").pop();
    const body = req.method === "POST" ? await req.json() : {};

    const sb = getServiceClient();

    // ── Verify workspace admin ──
    async function assertAdmin(workspaceId: string) {
      const { data } = await sb.rpc("is_workspace_admin", {
        _user_id: user!.id,
        _workspace_id: workspaceId,
      });
      if (!data)
        throw Object.assign(new Error("FORBIDDEN"), { status: 403 });
    }

    // ── CAPTURE ──
    if (path === "capture") {
      const { workspace_id, reason } = body;
      if (!workspace_id) return json({ error: "workspace_id required" }, 400);
      await assertAdmin(workspace_id);

      const { data, error } = await sb.rpc("capture_workspace_snapshot_v2", {
        _workspace_id: workspace_id,
        _snapshot_type: "manual",
        _reason: reason || null,
      });
      if (error) throw error;
      return json({ snapshot_id: data });
    }

    // ── PREVIEW ──
    if (path === "preview") {
      const { snapshot_id } = body;
      if (!snapshot_id) return json({ error: "snapshot_id required" }, 400);

      // Need to read snapshot to get workspace_id for admin check
      const { data: snap, error: snapErr } = await sb
        .from("workspace_snapshots")
        .select("workspace_id")
        .eq("id", snapshot_id)
        .single();
      if (snapErr || !snap) return json({ error: "Snapshot not found" }, 404);
      await assertAdmin(snap.workspace_id);

      const { data, error } = await sb.rpc("preview_restore_v2", {
        _snapshot_id: snapshot_id,
      });
      if (error) throw error;
      return json(data);
    }

    // ── RESTORE ──
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
        "restore_workspace_snapshot_atomic",
        {
          _workspace_id: snap.workspace_id,
          _snapshot_id: snapshot_id,
          _actor: user.id,
          _confirmation_token: confirmation_token,
        }
      );
      if (error) throw error;
      return json(data);
    }

    return json({ error: "Unknown action" }, 404);
  } catch (err: any) {
    const status = err.status || 500;
    console.error("safeback-engine error:", err.message || err);
    return json({ error: err.message || "Internal error" }, status);
  }
});
