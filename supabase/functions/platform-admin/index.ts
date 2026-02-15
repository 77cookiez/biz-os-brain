import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function err(msg: string, status = 400) {
  return json({ error: msg }, status);
}

/** Authenticate user from Authorization header */
async function getAuthUser(req: Request) {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } }
  );

  const token = authHeader.replace("Bearer ", "");
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data?.user) return null;

  return {
    id: data.user.id,
    email: data.user.email || "",
  };
}

function getServiceClient() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );
}

/** Get platform role using service client (bypasses RLS) */
async function getPlatformRole(userId: string): Promise<string | null> {
  const sb = getServiceClient();
  const { data } = await sb
    .from("platform_users")
    .select("role")
    .eq("user_id", userId)
    .eq("is_active", true)
    .single();
  return data?.role ?? null;
}

/** Require one of the allowed roles; returns role or throws */
async function requirePlatformRole(
  userId: string,
  allowed: string[]
): Promise<string> {
  const role = await getPlatformRole(userId);
  if (!role || !allowed.includes(role)) {
    throw new Error("FORBIDDEN");
  }
  return role;
}

/** Insert platform audit log */
async function audit(
  actorId: string,
  actionType: string,
  opts: {
    targetType?: string;
    targetId?: string;
    payload?: Record<string, unknown>;
    reason?: string;
  } = {}
) {
  const sb = getServiceClient();
  await sb.from("platform_audit_log").insert({
    actor_user_id: actorId,
    action_type: actionType,
    target_type: opts.targetType ?? null,
    target_id: opts.targetId ?? null,
    payload: opts.payload ?? {},
    reason: opts.reason ?? null,
  });
}

// ─── Route handlers ───

async function handleBootstrap(user: { id: string; email: string }) {
  const sb = getServiceClient();
  const ownerEmail = Deno.env.get("PLATFORM_OWNER_EMAIL");
  const bootstrapEnabled = Deno.env.get("PLATFORM_BOOTSTRAP_ENABLED");

  if (!ownerEmail || bootstrapEnabled !== "true") {
    return err("Bootstrap not enabled", 403);
  }

  if (user.email.toLowerCase() !== ownerEmail.toLowerCase()) {
    return err("Email mismatch", 403);
  }

  // Check DB lock
  const { data: lockRow } = await sb
    .from("platform_settings")
    .select("value")
    .eq("key", "bootstrap_locked")
    .single();

  if (lockRow?.value === true) {
    return err("Bootstrap already locked", 403);
  }

  // Check if owner already exists
  const { data: existing } = await sb
    .from("platform_users")
    .select("user_id")
    .eq("role", "owner")
    .limit(1);

  if (existing && existing.length > 0) {
    return err("Owner already exists", 409);
  }

  // Insert owner
  const { error: insertErr } = await sb.from("platform_users").insert({
    user_id: user.id,
    role: "owner",
    is_active: true,
  });

  if (insertErr) return err(insertErr.message, 500);

  // Lock bootstrap in DB
  await sb
    .from("platform_settings")
    .update({ value: true, updated_at: new Date().toISOString() })
    .eq("key", "bootstrap_locked");

  // Audit
  await audit(user.id, "bootstrap_owner", {
    payload: { email: user.email },
  });

  return json({ success: true, role: "owner" });
}

async function handleGetRole(user: { id: string }) {
  const role = await getPlatformRole(user.id);
  const sb = getServiceClient();
  const { data: lockRow } = await sb
    .from("platform_settings")
    .select("value")
    .eq("key", "bootstrap_locked")
    .single();

  return json({
    role,
    bootstrap_locked: lockRow?.value === true,
  });
}

async function handleListWorkspaces(
  user: { id: string },
  params: URLSearchParams
) {
  await requirePlatformRole(user.id, [
    "owner",
    "admin",
    "support",
    "auditor",
  ]);

  const sb = getServiceClient();
  const search = params.get("search") || "";
  const limit = Math.min(parseInt(params.get("limit") || "20"), 50);
  const offset = parseInt(params.get("offset") || "0");

  let query = sb
    .from("workspaces")
    .select("id, name, slug, created_at, company_id", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (search) {
    query = query.or(`name.ilike.%${search}%,slug.ilike.%${search}%,id.eq.${search}`);
  }

  const { data, count, error: qErr } = await query;
  if (qErr) return err(qErr.message, 500);

  return json({ workspaces: data, total: count });
}

async function handleCreateGrant(
  user: { id: string },
  body: Record<string, unknown>
) {
  const role = await requirePlatformRole(user.id, ["owner", "admin"]);

  const { scope, scope_id, grant_type, reason, value_json, ends_at } = body;
  if (!scope || !scope_id || !grant_type || !reason) {
    return err("scope, scope_id, grant_type, reason are required");
  }

  const sb = getServiceClient();
  const { data, error: insertErr } = await sb
    .from("platform_grants")
    .insert({
      scope: scope as string,
      scope_id: scope_id as string,
      grant_type: grant_type as string,
      value_json: (value_json as Record<string, unknown>) || {},
      reason: reason as string,
      ends_at: (ends_at as string) || null,
      created_by: user.id,
    })
    .select()
    .single();

  if (insertErr) return err(insertErr.message, 500);

  await audit(user.id, "grant_created", {
    targetType: scope as string,
    targetId: scope_id as string,
    payload: { grant_type, grant_id: data.id },
    reason: reason as string,
  });

  return json({ grant: data }, 201);
}

async function handleListGrants(
  user: { id: string },
  params: URLSearchParams
) {
  await requirePlatformRole(user.id, [
    "owner",
    "admin",
    "support",
    "auditor",
  ]);

  const sb = getServiceClient();
  const scope = params.get("scope");
  const activeOnly = params.get("active") !== "false";

  let query = sb
    .from("platform_grants")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(100);

  if (scope) query = query.eq("scope", scope);
  if (activeOnly) query = query.eq("is_active", true);

  const { data, error: qErr } = await query;
  if (qErr) return err(qErr.message, 500);

  return json({ grants: data });
}

async function handleRevokeGrant(
  user: { id: string },
  body: Record<string, unknown>
) {
  await requirePlatformRole(user.id, ["owner", "admin"]);

  const { grant_id, reason } = body;
  if (!grant_id || !reason) return err("grant_id and reason are required");

  const sb = getServiceClient();
  const { data, error: upErr } = await sb
    .from("platform_grants")
    .update({ is_active: false })
    .eq("id", grant_id as string)
    .select()
    .single();

  if (upErr) return err(upErr.message, 500);

  await audit(user.id, "grant_revoked", {
    targetType: data.scope,
    targetId: data.scope_id,
    payload: { grant_id: data.id, grant_type: data.grant_type },
    reason: reason as string,
  });

  return json({ grant: data });
}

async function handleListAudit(
  user: { id: string },
  params: URLSearchParams
) {
  await requirePlatformRole(user.id, [
    "owner",
    "admin",
    "auditor",
  ]);

  const sb = getServiceClient();
  const actionType = params.get("action_type");
  const limit = Math.min(parseInt(params.get("limit") || "50"), 200);
  const offset = parseInt(params.get("offset") || "0");

  let query = sb
    .from("platform_audit_log")
    .select("*", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (actionType) query = query.eq("action_type", actionType);

  const { data, count, error: qErr } = await query;
  if (qErr) return err(qErr.message, 500);

  return json({ logs: data, total: count });
}

// ─── Main handler ───

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const user = await getAuthUser(req);
    if (!user) return err("Unauthorized", 401);

    const url = new URL(req.url);
    const path = url.pathname.split("/").pop() || "";

    switch (req.method) {
      case "GET": {
        if (path === "role") return handleGetRole(user);
        if (path === "workspaces")
          return handleListWorkspaces(user, url.searchParams);
        if (path === "grants")
          return handleListGrants(user, url.searchParams);
        if (path === "audit")
          return handleListAudit(user, url.searchParams);
        return err("Not found", 404);
      }
      case "POST": {
        const body = await req.json().catch(() => ({}));
        if (path === "bootstrap") return handleBootstrap(user);
        if (path === "grants") return handleCreateGrant(user, body);
        if (path === "revoke-grant") return handleRevokeGrant(user, body);
        return err("Not found", 404);
      }
      default:
        return err("Method not allowed", 405);
    }
  } catch (e) {
    if (e instanceof Error && e.message === "FORBIDDEN") {
      return err("Access denied", 403);
    }
    console.error("platform-admin error:", e);
    return err("Internal server error", 500);
  }
});
