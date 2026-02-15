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

  return { id: data.user.id, email: data.user.email || "" };
}

function getServiceClient() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );
}

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

async function requirePlatformRole(userId: string, allowed: string[]): Promise<string> {
  const role = await getPlatformRole(userId);
  if (!role || !allowed.includes(role)) throw new Error("FORBIDDEN");
  return role;
}

async function audit(
  actorId: string,
  actionType: string,
  opts: { targetType?: string; targetId?: string; payload?: Record<string, unknown>; reason?: string } = {}
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

// ─── Existing Route Handlers ───

async function handleBootstrap(user: { id: string; email: string }) {
  const sb = getServiceClient();
  const ownerEmail = Deno.env.get("PLATFORM_OWNER_EMAIL");
  const bootstrapEnabled = Deno.env.get("PLATFORM_BOOTSTRAP_ENABLED");

  if (!ownerEmail || bootstrapEnabled !== "true") return err("Bootstrap not enabled", 403);
  if (user.email.toLowerCase() !== ownerEmail.toLowerCase()) return err("Email mismatch", 403);

  const { data: lockRow } = await sb.from("platform_settings").select("value").eq("key", "bootstrap_locked").single();
  if (lockRow?.value === true) return err("Bootstrap already locked", 403);

  const { data: existing } = await sb.from("platform_users").select("user_id").eq("role", "owner").limit(1);
  if (existing && existing.length > 0) return err("Owner already exists", 409);

  const { error: insertErr } = await sb.from("platform_users").insert({ user_id: user.id, role: "owner", is_active: true });
  if (insertErr) return err(insertErr.message, 500);

  await sb.from("platform_settings").update({ value: true, updated_at: new Date().toISOString() }).eq("key", "bootstrap_locked");
  await audit(user.id, "bootstrap_owner", { payload: { email: user.email } });

  return json({ success: true, role: "owner" });
}

async function handleGetRole(user: { id: string }) {
  const role = await getPlatformRole(user.id);
  const sb = getServiceClient();
  const { data: lockRow } = await sb.from("platform_settings").select("value").eq("key", "bootstrap_locked").single();
  return json({ role, bootstrap_locked: lockRow?.value === true });
}

async function handleListWorkspaces(user: { id: string }, params: URLSearchParams) {
  await requirePlatformRole(user.id, ["owner", "admin", "support", "auditor"]);

  const sb = getServiceClient();
  const search = params.get("search") || "";
  const limit = Math.min(parseInt(params.get("limit") || "20"), 50);
  const offset = parseInt(params.get("offset") || "0");

  let query = sb
    .from("workspaces")
    .select("id, name, created_at, company_id", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (search) {
    query = query.or(`name.ilike.%${search}%,id.eq.${search}`);
  }

  const { data, count, error: qErr } = await query;
  if (qErr) return err(qErr.message, 500);

  return json({ workspaces: data, total: count });
}

async function handleCreateGrant(user: { id: string }, body: Record<string, unknown>) {
  await requirePlatformRole(user.id, ["owner", "admin"]);

  const { scope, scope_id, grant_type, reason, value_json, ends_at } = body;
  if (!scope || !scope_id || !grant_type || !reason) return err("scope, scope_id, grant_type, reason are required");

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

async function handleListGrants(user: { id: string }, params: URLSearchParams) {
  await requirePlatformRole(user.id, ["owner", "admin", "support", "auditor"]);

  const sb = getServiceClient();
  const scope = params.get("scope");
  const activeOnly = params.get("active") !== "false";

  let query = sb.from("platform_grants").select("*").order("created_at", { ascending: false }).limit(100);
  if (scope) query = query.eq("scope", scope);
  if (activeOnly) query = query.eq("is_active", true);

  const { data, error: qErr } = await query;
  if (qErr) return err(qErr.message, 500);

  return json({ grants: data });
}

async function handleRevokeGrant(user: { id: string }, body: Record<string, unknown>) {
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

async function handleListAudit(user: { id: string }, params: URLSearchParams) {
  await requirePlatformRole(user.id, ["owner", "admin", "auditor"]);

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

// ─── NEW Route Handlers ───

// (A) Fixed: single workspace query, member_count from workspace_members
async function handleWorkspaceDetail(user: { id: string }, params: URLSearchParams) {
  await requirePlatformRole(user.id, ["owner", "admin", "support", "auditor"]);

  const workspaceId = params.get("workspace_id");
  if (!workspaceId) return err("workspace_id is required");

  const sb = getServiceClient();

  // Single workspace fetch + all parallel queries
  const [wsRes, appsRes, osPlanRes, bookingSubRes, membersRes, grantsRes] = await Promise.all([
    sb.from("workspaces").select("id, name, created_at, company_id").eq("id", workspaceId).single(),
    sb.from("workspace_apps").select("*").eq("workspace_id", workspaceId),
    sb.from("billing_subscriptions").select("*, billing_plans(*)").eq("workspace_id", workspaceId).maybeSingle(),
    sb.from("booking_subscriptions").select("*").eq("workspace_id", workspaceId).maybeSingle(),
    sb.from("workspace_members").select("id", { count: "exact" }).eq("workspace_id", workspaceId),
    sb.from("platform_grants").select("*").eq("scope", "workspace").eq("scope_id", workspaceId).eq("is_active", true),
  ]);

  if (wsRes.error) return err("Workspace not found", 404);

  return json({
    workspace: wsRes.data,
    apps: appsRes.data || [],
    os_subscription: osPlanRes.data || null,
    booking_subscription: bookingSubRes.data || null,
    member_count: membersRes.count || 0,
    active_grants: grantsRes.data || [],
  });
}

// (B) Fixed: ONLY creates a grant, NO direct billing_subscriptions write
async function handleSetOsPlan(user: { id: string }, body: Record<string, unknown>) {
  await requirePlatformRole(user.id, ["owner", "admin"]);

  const { workspace_id, plan_id, billing_cycle, reason } = body;
  if (!workspace_id || !plan_id || !reason) return err("workspace_id, plan_id, reason are required");

  const sb = getServiceClient();

  // Verify workspace exists
  const { data: ws } = await sb.from("workspaces").select("id").eq("id", workspace_id as string).single();
  if (!ws) return err("Workspace not found", 404);

  // Verify plan exists and is active
  const { data: plan } = await sb.from("billing_plans").select("id, name").eq("id", plan_id as string).eq("is_active", true).single();
  if (!plan) return err("Plan not found or inactive", 404);

  // Deactivate any existing os_plan_override grants for this workspace
  await sb
    .from("platform_grants")
    .update({ is_active: false })
    .eq("scope", "workspace")
    .eq("scope_id", workspace_id as string)
    .eq("grant_type", "os_plan_override")
    .eq("is_active", true);

  // Create grant-based override (no billing_subscriptions write)
  const { data: grant, error: grantErr } = await sb
    .from("platform_grants")
    .insert({
      scope: "workspace",
      scope_id: workspace_id as string,
      grant_type: "os_plan_override",
      value_json: { plan_id, billing_cycle: billing_cycle || "monthly", plan_name: plan.name },
      reason: reason as string,
      created_by: user.id,
    })
    .select()
    .single();

  if (grantErr) return err(grantErr.message, 500);

  await audit(user.id, "os_plan_override", {
    targetType: "workspace",
    targetId: workspace_id as string,
    payload: { plan_id, billing_cycle, grant_id: grant.id },
    reason: reason as string,
  });

  return json({ success: true, grant });
}

async function handleSetAppSubscription(user: { id: string }, body: Record<string, unknown>) {
  await requirePlatformRole(user.id, ["owner", "admin"]);

  const { workspace_id, app_id, plan, status, expires_at, reason } = body;
  if (!workspace_id || !app_id || !plan || !reason) return err("workspace_id, app_id, plan, reason are required");

  const sb = getServiceClient();

  const { data: ws } = await sb.from("workspaces").select("id").eq("id", workspace_id as string).single();
  if (!ws) return err("Workspace not found", 404);

  // Deactivate existing app_plan_override grants for this workspace+app
  await sb
    .from("platform_grants")
    .update({ is_active: false })
    .eq("scope", "workspace")
    .eq("scope_id", workspace_id as string)
    .eq("grant_type", "app_plan_override")
    .eq("is_active", true);

  const { data: grant, error: grantErr } = await sb
    .from("platform_grants")
    .insert({
      scope: "workspace",
      scope_id: workspace_id as string,
      grant_type: "app_plan_override",
      value_json: { app_id, plan, status: status || "active", expires_at: expires_at || null },
      reason: reason as string,
      created_by: user.id,
    })
    .select()
    .single();

  if (grantErr) return err(grantErr.message, 500);

  // App-specific subscription upsert (adapter pattern for immediate reflection)
  if (app_id === "booking") {
    await sb
      .from("booking_subscriptions")
      .upsert(
        {
          workspace_id: workspace_id as string,
          plan: plan as string,
          status: (status as string) || "active",
          expires_at: (expires_at as string) || null,
          started_at: new Date().toISOString(),
        },
        { onConflict: "workspace_id" }
      );
  }

  await audit(user.id, "app_subscription_override", {
    targetType: "workspace",
    targetId: workspace_id as string,
    payload: { app_id, plan, status, expires_at, grant_id: grant.id },
    reason: reason as string,
  });

  return json({ success: true, grant });
}

// (C) Robust and idempotent install/uninstall
async function handleInstallApp(user: { id: string }, body: Record<string, unknown>) {
  await requirePlatformRole(user.id, ["owner", "admin"]);

  const { workspace_id, app_id, reason } = body;
  if (!workspace_id || !app_id || !reason) return err("workspace_id, app_id, reason are required");

  const sb = getServiceClient();

  const { data: ws } = await sb.from("workspaces").select("id").eq("id", workspace_id as string).single();
  if (!ws) return err("Workspace not found", 404);

  const { data: app } = await sb.from("app_registry").select("id, name, status").eq("id", app_id as string).single();
  if (!app) return err("App not found in registry", 404);
  if (app.status === "deprecated") return err("App is deprecated", 400);

  // Upsert: reactivates if inactive, creates if missing
  const { error: appErr } = await sb
    .from("workspace_apps")
    .upsert(
      {
        workspace_id: workspace_id as string,
        app_id: app_id as string,
        is_active: true,
        installed_at: new Date().toISOString(),
        installed_by: user.id,
        uninstalled_at: null,
      },
      { onConflict: "workspace_id,app_id" }
    );

  if (appErr) return err(appErr.message, 500);

  await audit(user.id, "app_installed", {
    targetType: "workspace",
    targetId: workspace_id as string,
    payload: { app_id, app_name: app.name },
    reason: reason as string,
  });

  return json({ success: true, app_id });
}

async function handleUninstallApp(user: { id: string }, body: Record<string, unknown>) {
  await requirePlatformRole(user.id, ["owner", "admin"]);

  const { workspace_id, app_id, reason } = body;
  if (!workspace_id || !app_id || !reason) return err("workspace_id, app_id, reason are required");

  const sb = getServiceClient();

  // Check existing row
  const { data: existing } = await sb
    .from("workspace_apps")
    .select("id, is_active")
    .eq("workspace_id", workspace_id as string)
    .eq("app_id", app_id as string)
    .maybeSingle();

  if (!existing) return err("App not installed", 404);
  if (!existing.is_active) return err("Already inactive", 409);

  const { error: appErr } = await sb
    .from("workspace_apps")
    .update({
      is_active: false,
      uninstalled_at: new Date().toISOString(),
    })
    .eq("id", existing.id);

  if (appErr) return err(appErr.message, 500);

  await audit(user.id, "app_uninstalled", {
    targetType: "workspace",
    targetId: workspace_id as string,
    payload: { app_id },
    reason: reason as string,
  });

  return json({ success: true, app_id });
}

// (D) Available apps from DB
async function handleAvailableApps(user: { id: string }) {
  await requirePlatformRole(user.id, ["owner", "admin", "support", "auditor"]);

  const sb = getServiceClient();
  const { data, error: qErr } = await sb
    .from("app_registry")
    .select("id, name, icon, pricing, status")
    .eq("status", "available")
    .order("name");

  if (qErr) return err(qErr.message, 500);

  return json({ apps: data || [] });
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
        if (path === "workspaces") return handleListWorkspaces(user, url.searchParams);
        if (path === "grants") return handleListGrants(user, url.searchParams);
        if (path === "audit") return handleListAudit(user, url.searchParams);
        if (path === "workspace-detail") return handleWorkspaceDetail(user, url.searchParams);
        if (path === "available-apps") return handleAvailableApps(user);
        return err("Not found", 404);
      }
      case "POST": {
        const body = await req.json().catch(() => ({}));
        if (path === "bootstrap") return handleBootstrap(user);
        if (path === "grants") return handleCreateGrant(user, body);
        if (path === "revoke-grant") return handleRevokeGrant(user, body);
        if (path === "set-os-plan") return handleSetOsPlan(user, body);
        if (path === "set-app-subscription") return handleSetAppSubscription(user, body);
        if (path === "install-app") return handleInstallApp(user, body);
        if (path === "uninstall-app") return handleUninstallApp(user, body);
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
