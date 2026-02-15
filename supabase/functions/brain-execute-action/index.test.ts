import "https://deno.land/std@0.224.0/dotenv/load.ts";
import { assertEquals, assertExists } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const SUPABASE_URL = Deno.env.get("VITE_SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("VITE_SUPABASE_PUBLISHABLE_KEY")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || Deno.env.get("VITE_SUPABASE_SERVICE_ROLE_KEY") || "";
const MAINTENANCE_KEY = Deno.env.get("MAINTENANCE_KEY") || "";
const FUNCTION_URL = `${SUPABASE_URL}/functions/v1/brain-execute-action`;
const MAINTENANCE_URL = `${SUPABASE_URL}/functions/v1/maintenance-cleanup`;

// Service client for test data setup/teardown
const sb = SERVICE_KEY ? createClient(SUPABASE_URL, SERVICE_KEY) : null;

// ─── Test helpers ───

async function callFunction(
  body: Record<string, unknown>,
  opts?: { userId?: string; workspaceId?: string; role?: string; token?: string },
) {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    apikey: SUPABASE_ANON_KEY,
  };
  if (opts?.userId) headers["x-test-user-id"] = opts.userId;
  if (opts?.workspaceId) headers["x-test-workspace-id"] = opts.workspaceId;
  if (opts?.role) headers["x-test-role"] = opts.role;
  if (opts?.token) headers["Authorization"] = `Bearer ${opts.token}`;

  const resp = await fetch(FUNCTION_URL, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
  const data = await resp.json();
  return { status: resp.status, data };
}

function makeDraft(overrides?: Record<string, unknown>) {
  return {
    id: crypto.randomUUID(),
    type: "draft_task_set",
    title: "Test Draft",
    target_module: "teamwork",
    agent_type: "teamwork",
    payload: { tasks: [{ title: "Test task 1" }] },
    required_role: "member",
    intent: "create tasks",
    scope: { affected_modules: ["teamwork"], affected_entities: [], impact_summary: "test" },
    risks: [],
    rollback_possible: true,
    meaning: { meaning_payload: { type: "task", subject: "Test", source_lang: "en", workspace_id: "test" } },
    ...overrides,
  };
}

// ─── Basic Tests (no service key needed) ───

Deno.test("OPTIONS returns CORS headers", async () => {
  const resp = await fetch(FUNCTION_URL, { method: "OPTIONS" });
  assertEquals(resp.status, 200);
  assertExists(resp.headers.get("access-control-allow-origin"));
  await resp.text();
});

Deno.test("dry_run rejects unauthenticated request", async () => {
  const { status, data } = await callFunction({
    mode: "dry_run",
    workspace_id: crypto.randomUUID(),
    draft: makeDraft(),
  });
  assertEquals(status, 401);
  assertEquals(data.code, "EXECUTION_DENIED");
  assertExists(data.request_id);
});

Deno.test("execute rejects missing confirmation_hash", async () => {
  const { status, data } = await callFunction({
    mode: "execute",
    workspace_id: crypto.randomUUID(),
    draft: makeDraft(),
  });
  assertEquals(status, 401);
  assertEquals(data.code, "EXECUTION_DENIED");
  assertExists(data.request_id);
});

Deno.test("rejects missing meaning", async () => {
  const { status } = await callFunction(
    {
      mode: "dry_run",
      workspace_id: crypto.randomUUID(),
      draft: makeDraft({ meaning: {} }),
    },
    { token: "fake-token" },
  );
  assertEquals(typeof status, "number");
});

Deno.test("rejects invalid draft structure", async () => {
  const { status } = await callFunction(
    {
      mode: "dry_run",
      workspace_id: crypto.randomUUID(),
      draft: { id: "x" },
    },
    { token: "fake-token" },
  );
  assertEquals(typeof status, "number");
});

Deno.test("all responses include request_id", async () => {
  // 401 path
  const { data: d1 } = await callFunction({
    mode: "dry_run",
    workspace_id: crypto.randomUUID(),
    draft: makeDraft(),
  });
  assertExists(d1.request_id);

  // 400 path (missing workspace_id)
  const { data: d2 } = await callFunction(
    { mode: "dry_run", draft: makeDraft() },
    { token: "fake-token" },
  );
  assertExists(d2.request_id);
});

// ─── Strong Behavior Tests (require TEST_MODE=true + SERVICE_ROLE_KEY) ───

const TEST_MODE_AVAILABLE = Deno.env.get("TEST_MODE") === "true" && !!SERVICE_KEY;

if (TEST_MODE_AVAILABLE) {
  const testUserId = crypto.randomUUID();
  const testWorkspaceId = crypto.randomUUID();
  const testCompanyId = crypto.randomUUID();

  // Setup test data once
  async function setupTestData() {
    if (!sb) return;

    await sb.from("companies").insert({
      id: testCompanyId,
      name: "Test Company",
      created_by: testUserId,
    });

    await sb.from("workspaces").insert({
      id: testWorkspaceId,
      name: "Test Workspace",
      company_id: testCompanyId,
    });

    await sb.from("profiles").upsert({
      user_id: testUserId,
      full_name: "Test User",
      preferred_locale: "en",
    });

    await sb.from("workspace_members").insert({
      workspace_id: testWorkspaceId,
      user_id: testUserId,
      team_role: "owner",
      invite_status: "accepted",
    });

    await sb.from("user_roles").insert({
      user_id: testUserId,
      company_id: testCompanyId,
      role: "owner",
    });
  }

  // Teardown test data
  async function teardownTestData() {
    if (!sb) return;
    await sb.from("request_dedupes").delete().eq("workspace_id", testWorkspaceId);
    await sb.from("rate_limits").delete().eq("workspace_id", testWorkspaceId);
    await sb.from("draft_confirmations").delete().eq("workspace_id", testWorkspaceId);
    await sb.from("executed_drafts").delete().eq("workspace_id", testWorkspaceId);
    await sb.from("audit_logs").delete().eq("workspace_id", testWorkspaceId);
    await sb.from("org_events").delete().eq("workspace_id", testWorkspaceId);
    await sb.from("tasks").delete().eq("workspace_id", testWorkspaceId);
    await sb.from("meaning_objects").delete().eq("workspace_id", testWorkspaceId);
    await sb.from("workspace_members").delete().eq("workspace_id", testWorkspaceId);
    await sb.from("user_roles").delete().eq("company_id", testCompanyId);
    await sb.from("workspaces").delete().eq("id", testWorkspaceId);
    await sb.from("companies").delete().eq("id", testCompanyId);
    await sb.from("profiles").delete().eq("user_id", testUserId);
  }

  // Helper: full confirm->execute flow
  async function confirmAndExecute(draft: Record<string, unknown>) {
    const { data: confirmData } = await callFunction(
      { mode: "confirm", workspace_id: testWorkspaceId, draft },
      { userId: testUserId, role: "owner" },
    );

    const execDraft = {
      ...draft,
      expires_at: confirmData.expires_at,
      meaning: confirmData.meaning_object_id
        ? { meaning_object_id: confirmData.meaning_object_id }
        : draft.meaning,
    };

    return {
      confirmData,
      execDraft,
      execute: () => callFunction(
        { mode: "execute", workspace_id: testWorkspaceId, draft: execDraft, confirmation_hash: confirmData.confirmation_hash },
        { userId: testUserId, role: "owner" },
      ),
    };
  }

  Deno.test({
    name: "BEHAVIOR: dry_run does NOT write tasks",
    async fn() {
      await setupTestData();
      try {
        const { count: beforeCount } = await sb!.from("tasks").select("*", { count: "exact", head: true }).eq("workspace_id", testWorkspaceId);

        const { status, data } = await callFunction(
          { mode: "dry_run", workspace_id: testWorkspaceId, draft: makeDraft() },
          { userId: testUserId, role: "owner" },
        );

        assertEquals(status, 200);
        assertEquals(data.can_execute, true);
        assertExists(data.preview);
        assertExists(data.request_id);

        const { count: afterCount } = await sb!.from("tasks").select("*", { count: "exact", head: true }).eq("workspace_id", testWorkspaceId);
        assertEquals(beforeCount, afterCount);
      } finally {
        await teardownTestData();
      }
    },
  });

  // ─── M4 TEST 1: confirm twice with meaning_payload returns same meaning_object_id ───

  Deno.test({
    name: "M4: confirm twice returns same meaning_object_id (idempotent)",
    async fn() {
      await setupTestData();
      try {
        const draft = makeDraft();

        const { status: s1, data: d1 } = await callFunction(
          { mode: "confirm", workspace_id: testWorkspaceId, draft },
          { userId: testUserId, role: "owner" },
        );
        assertEquals(s1, 200);
        assertExists(d1.meaning_object_id);
        assertExists(d1.request_id);

        const { count: countAfterFirst } = await sb!.from("meaning_objects").select("*", { count: "exact", head: true }).eq("workspace_id", testWorkspaceId);

        // Second confirm — same draft but new request_id (different request)
        const { status: s2, data: d2 } = await callFunction(
          { mode: "confirm", workspace_id: testWorkspaceId, draft, request_id: crypto.randomUUID() },
          { userId: testUserId, role: "owner" },
        );
        assertEquals(s2, 200);
        assertEquals(d2.meaning_object_id, d1.meaning_object_id);

        const { count: countAfterSecond } = await sb!.from("meaning_objects").select("*", { count: "exact", head: true }).eq("workspace_id", testWorkspaceId);
        assertEquals(countAfterFirst, countAfterSecond);
      } finally {
        await teardownTestData();
      }
    },
  });

  // ─── M4 TEST 2: execute with meaning_payload should fail 400 ───

  Deno.test({
    name: "M4: execute with meaning_payload returns 400 VALIDATION_ERROR",
    async fn() {
      await setupTestData();
      try {
        const draft = makeDraft();

        const { status, data } = await callFunction(
          { mode: "execute", workspace_id: testWorkspaceId, draft, confirmation_hash: "any-hash" },
          { userId: testUserId, role: "owner" },
        );
        assertEquals(status, 400);
        assertEquals(data.code, "VALIDATION_ERROR");
        assertExists(data.request_id);
      } finally {
        await teardownTestData();
      }
    },
  });

  // ─── M4 TEST 3: execute with tampered meaning_object_id returns 403 ───

  Deno.test({
    name: "M4: execute with tampered meaning_object_id returns 403",
    async fn() {
      await setupTestData();
      try {
        const draft = makeDraft();

        const { data: confirmData } = await callFunction(
          { mode: "confirm", workspace_id: testWorkspaceId, draft },
          { userId: testUserId, role: "owner" },
        );

        const tamperedDraft = {
          ...draft,
          expires_at: confirmData.expires_at,
          meaning: { meaning_object_id: crypto.randomUUID() },
        };

        const { status, data } = await callFunction(
          { mode: "execute", workspace_id: testWorkspaceId, draft: tamperedDraft, confirmation_hash: confirmData.confirmation_hash },
          { userId: testUserId, role: "owner" },
        );
        assertEquals(status, 403);
        assertEquals(data.code, "EXECUTION_DENIED");
        assertEquals(data.reason, "Meaning mismatch — draft tampered");
      } finally {
        await teardownTestData();
      }
    },
  });

  // ─── M4 TEST 4: execute twice — second returns 200 replayed ───

  Deno.test({
    name: "M4: execute twice returns replayed success on second call",
    async fn() {
      await setupTestData();
      try {
        const draft = makeDraft();
        const { execDraft, confirmData, execute } = await confirmAndExecute(draft);

        const { status: s1, data: d1 } = await execute();
        assertEquals(s1, 200);
        assertEquals(d1.success, true);
        assertExists(d1.entities);
        assertExists(d1.audit_log_id);
        assertExists(d1.request_id);

        // Second execute — same request so dedupe returns replayed
        // Need fresh request_id for execute to not hit request_dedupes
        const { status: s2, data: d2 } = await callFunction(
          { mode: "execute", workspace_id: testWorkspaceId, draft: execDraft, confirmation_hash: confirmData.confirmation_hash, request_id: crypto.randomUUID() },
          { userId: testUserId, role: "owner" },
        );
        assertEquals(s2, 200);
        assertEquals(d2.success, true);
        assertEquals(d2.replayed, true);
        assertExists(d2.audit_log_id);
        assertEquals(JSON.stringify(d2.entities), JSON.stringify(d1.entities));
      } finally {
        await teardownTestData();
      }
    },
  });

  // ─── M4 TEST 5: duplicate while reserved returns 409 in-progress ───

  Deno.test({
    name: "M4: execute while reserved returns 409 in-progress",
    async fn() {
      await setupTestData();
      try {
        const draft = makeDraft();

        const { data: confirmData } = await callFunction(
          { mode: "confirm", workspace_id: testWorkspaceId, draft },
          { userId: testUserId, role: "owner" },
        );

        const execDraft = {
          ...draft,
          expires_at: confirmData.expires_at,
          meaning: { meaning_object_id: confirmData.meaning_object_id },
        };

        // Simulate: insert reserved row directly
        await sb!.from("executed_drafts").insert({
          draft_id: draft.id,
          workspace_id: testWorkspaceId,
          agent_type: "teamwork",
          draft_type: "draft_task_set",
          executed_by: testUserId,
          status: "reserved",
        });

        const { status, data } = await callFunction(
          { mode: "execute", workspace_id: testWorkspaceId, draft: execDraft, confirmation_hash: confirmData.confirmation_hash },
          { userId: testUserId, role: "owner" },
        );
        assertEquals(status, 409);
        assertEquals(data.code, "ALREADY_EXECUTED");
        assertEquals(data.reason, "Draft execution in progress");
      } finally {
        await teardownTestData();
      }
    },
  });

  // ─── Existing tests kept ───

  Deno.test({
    name: "BEHAVIOR: confirm does NOT mint if meaning_object_id already present",
    async fn() {
      await setupTestData();
      try {
        const { count: beforeCount } = await sb!.from("meaning_objects").select("*", { count: "exact", head: true }).eq("workspace_id", testWorkspaceId);

        const draft = makeDraft({ meaning: { meaning_object_id: crypto.randomUUID() } });

        const { status, data } = await callFunction(
          { mode: "confirm", workspace_id: testWorkspaceId, draft },
          { userId: testUserId, role: "owner" },
        );

        assertEquals(status, 200);
        assertExists(data.confirmation_hash);
        assertEquals(data.meaning_object_id, undefined);
        assertExists(data.request_id);

        const { count: afterCount } = await sb!.from("meaning_objects").select("*", { count: "exact", head: true }).eq("workspace_id", testWorkspaceId);
        assertEquals(beforeCount, afterCount);
      } finally {
        await teardownTestData();
      }
    },
  });

  Deno.test({
    name: "BEHAVIOR: execute with valid hash creates tasks + audit + org_events",
    async fn() {
      await setupTestData();
      try {
        const draft = makeDraft();
        const { execute, confirmData } = await confirmAndExecute(draft);

        const { status, data } = await execute();
        assertEquals(status, 200);
        assertEquals(data.success, true);
        assertExists(data.entities);
        assertEquals(data.entities.length, 1);
        assertEquals(data.entities[0].type, "task");
        assertExists(data.request_id);

        const { data: task } = await sb!.from("tasks").select("id").eq("id", data.entities[0].id).single();
        assertExists(task);

        const { data: audits } = await sb!.from("audit_logs").select("id").eq("workspace_id", testWorkspaceId).eq("action", "agent.execute.success");
        assertEquals(audits!.length >= 1, true);

        const { data: events } = await sb!.from("org_events").select("id").eq("workspace_id", testWorkspaceId).eq("event_type", "agent.executed");
        assertEquals(events!.length >= 1, true);

        const { data: reservation } = await sb!.from("executed_drafts").select("*").eq("draft_id", draft.id).single();
        assertExists(reservation);
        assertEquals(reservation.status, "success");
        assertExists(reservation.audit_log_id);
      } finally {
        await teardownTestData();
      }
    },
  });

  Deno.test({
    name: "BEHAVIOR: execute with invalid hash returns 403",
    async fn() {
      await setupTestData();
      try {
        const draft = makeDraft();

        const { data: confirmData } = await callFunction(
          { mode: "confirm", workspace_id: testWorkspaceId, draft },
          { userId: testUserId, role: "owner" },
        );

        const execDraft = {
          ...draft,
          expires_at: confirmData.expires_at,
          meaning: { meaning_object_id: confirmData.meaning_object_id },
        };

        const { status, data } = await callFunction(
          { mode: "execute", workspace_id: testWorkspaceId, draft: execDraft, confirmation_hash: "invalid-hash-000" },
          { userId: testUserId, role: "owner" },
        );
        assertEquals(status, 403);
        assertEquals(data.code, "EXECUTION_DENIED");
      } finally {
        await teardownTestData();
      }
    },
  });

  Deno.test({
    name: "BEHAVIOR: execute expired draft returns 410",
    async fn() {
      await setupTestData();
      try {
        const draft = makeDraft({ expires_at: Date.now() - 60000 });

        const { status, data } = await callFunction(
          {
            mode: "execute",
            workspace_id: testWorkspaceId,
            draft: { ...draft, meaning: { meaning_object_id: crypto.randomUUID() } },
            confirmation_hash: "any-hash",
          },
          { userId: testUserId, role: "owner" },
        );
        assertEquals(status, 410);
        assertEquals(data.code, "EXECUTION_DENIED");
      } finally {
        await teardownTestData();
      }
    },
  });

  Deno.test({
    name: "BEHAVIOR: member cannot execute owner-required draft",
    async fn() {
      await setupTestData();
      try {
        const draft = makeDraft({ required_role: "owner" });

        const { data: confirmData } = await callFunction(
          { mode: "confirm", workspace_id: testWorkspaceId, draft },
          { userId: testUserId, role: "member" },
        );

        const execDraft = {
          ...draft,
          expires_at: confirmData.expires_at,
          meaning: confirmData.meaning_object_id
            ? { meaning_object_id: confirmData.meaning_object_id }
            : draft.meaning,
        };

        const { status, data } = await callFunction(
          { mode: "execute", workspace_id: testWorkspaceId, draft: execDraft, confirmation_hash: confirmData.confirmation_hash },
          { userId: testUserId, role: "member" },
        );
        assertEquals(status, 403);
        assertEquals(data.code, "EXECUTION_DENIED");
      } finally {
        await teardownTestData();
      }
    },
  });

  Deno.test({
    name: "BEHAVIOR: missing meaning rejects with validation error",
    async fn() {
      await setupTestData();
      try {
        const draft = makeDraft({ meaning: {} });

        const { status, data } = await callFunction(
          { mode: "dry_run", workspace_id: testWorkspaceId, draft },
          { userId: testUserId, role: "owner" },
        );
        assertEquals(status, 400);
        assertEquals(data.code, "VALIDATION_ERROR");
      } finally {
        await teardownTestData();
      }
    },
  });

  // ─── M5 TEST: Stale reserved takeover ───

  Deno.test({
    name: "M5: stale reserved row is taken over on execute",
    async fn() {
      await setupTestData();
      try {
        const draft = makeDraft();

        const { data: confirmData } = await callFunction(
          { mode: "confirm", workspace_id: testWorkspaceId, draft },
          { userId: testUserId, role: "owner" },
        );

        const execDraft = {
          ...draft,
          expires_at: confirmData.expires_at,
          meaning: { meaning_object_id: confirmData.meaning_object_id },
        };

        const staleTime = new Date(Date.now() - 120000).toISOString();
        await sb!.from("executed_drafts").insert({
          draft_id: draft.id,
          workspace_id: testWorkspaceId,
          agent_type: "teamwork",
          draft_type: "draft_task_set",
          executed_by: testUserId,
          status: "reserved",
          created_at: staleTime,
          updated_at: staleTime,
        });

        const { status, data } = await callFunction(
          { mode: "execute", workspace_id: testWorkspaceId, draft: execDraft, confirmation_hash: confirmData.confirmation_hash },
          { userId: testUserId, role: "owner" },
        );
        assertEquals(status, 200);
        assertEquals(data.success, true);
        assertExists(data.entities);
        assertEquals(data.entities.length, 1);
      } finally {
        await teardownTestData();
      }
    },
  });

  // ─── M5 TEST: Atomicity ───

  Deno.test({
    name: "M5: unsupported draft_type fails without partial writes",
    async fn() {
      await setupTestData();
      try {
        const draft = makeDraft({ type: "draft_unknown_type", target_module: "teamwork" });

        const { data: confirmData } = await callFunction(
          { mode: "confirm", workspace_id: testWorkspaceId, draft },
          { userId: testUserId, role: "owner" },
        );

        const execDraft = {
          ...draft,
          expires_at: confirmData.expires_at,
          meaning: { meaning_object_id: confirmData.meaning_object_id },
        };

        const { count: tasksBefore } = await sb!.from("tasks").select("*", { count: "exact", head: true }).eq("workspace_id", testWorkspaceId);
        const { count: auditsBefore } = await sb!.from("audit_logs").select("*", { count: "exact", head: true }).eq("workspace_id", testWorkspaceId);

        const { status, data } = await callFunction(
          { mode: "execute", workspace_id: testWorkspaceId, draft: execDraft, confirmation_hash: confirmData.confirmation_hash },
          { userId: testUserId, role: "owner" },
        );

        assertEquals(status, 400);

        const { count: tasksAfter } = await sb!.from("tasks").select("*", { count: "exact", head: true }).eq("workspace_id", testWorkspaceId);
        assertEquals(tasksBefore, tasksAfter);

        const { count: auditsAfter } = await sb!.from("audit_logs").select("*", { count: "exact", head: true }).eq("workspace_id", testWorkspaceId);
        assertEquals(auditsBefore, auditsAfter);

        const { data: reservation } = await sb!.from("executed_drafts").select("*").eq("draft_id", draft.id).maybeSingle();
        assertEquals(reservation, null);
      } finally {
        await teardownTestData();
      }
    },
  });

  // ─── M6 TEST: Cleanup expired draft confirmations ───

  Deno.test({
    name: "M6: cleanup_expired_draft_confirmations deletes expired rows",
    async fn() {
      await setupTestData();
      try {
        const expiredDraftId = `m6-expired-${crypto.randomUUID()}`;
        const validDraftId = `m6-valid-${crypto.randomUUID()}`;
        const pastEpochMs = Date.now() - 3600_000;
        const futureEpochMs = Date.now() + 3600_000;

        await sb!.from("draft_confirmations").insert({
          draft_id: expiredDraftId,
          workspace_id: testWorkspaceId,
          confirmed_meaning_object_id: crypto.randomUUID(),
          confirmed_by: testUserId,
          confirmation_hash: "expired-hash",
          expires_at: pastEpochMs,
        });

        await sb!.from("draft_confirmations").insert({
          draft_id: validDraftId,
          workspace_id: testWorkspaceId,
          confirmed_meaning_object_id: crypto.randomUUID(),
          confirmed_by: testUserId,
          confirmation_hash: "valid-hash",
          expires_at: futureEpochMs,
        });

        const { data: deleted, error } = await sb!.rpc("cleanup_expired_draft_confirmations", {});
        assertEquals(error, null);
        assertEquals(typeof deleted, "number");
        assertEquals(deleted >= 1, true);

        const { data: expiredRow } = await sb!.from("draft_confirmations").select("*").eq("draft_id", expiredDraftId).maybeSingle();
        assertEquals(expiredRow, null);

        const { data: validRow } = await sb!.from("draft_confirmations").select("*").eq("draft_id", validDraftId).maybeSingle();
        assertExists(validRow);

        await sb!.from("draft_confirmations").delete().eq("draft_id", validDraftId);
      } finally {
        await teardownTestData();
      }
    },
  });

  // ─── M6 TEST: Cleanup stale reserved executed_drafts ───

  Deno.test({
    name: "M6: cleanup_stale_executed_drafts deletes stale reserved rows only",
    async fn() {
      await setupTestData();
      try {
        const staleDraftId = `m6-stale-${crypto.randomUUID()}`;
        const freshDraftId = `m6-fresh-${crypto.randomUUID()}`;
        const staleTime = new Date(Date.now() - 15 * 60_000).toISOString();

        await sb!.from("executed_drafts").insert({
          draft_id: staleDraftId,
          workspace_id: testWorkspaceId,
          agent_type: "teamwork",
          draft_type: "draft_task_set",
          executed_by: testUserId,
          status: "reserved",
          created_at: staleTime,
          updated_at: staleTime,
        });

        await sb!.from("executed_drafts").insert({
          draft_id: freshDraftId,
          workspace_id: testWorkspaceId,
          agent_type: "teamwork",
          draft_type: "draft_task_set",
          executed_by: testUserId,
          status: "reserved",
        });

        const { data: deleted, error } = await sb!.rpc("cleanup_stale_executed_drafts", {});
        assertEquals(error, null);
        assertEquals(typeof deleted, "number");
        assertEquals(deleted >= 1, true);

        const { data: staleRow } = await sb!.from("executed_drafts").select("*").eq("draft_id", staleDraftId).maybeSingle();
        assertEquals(staleRow, null);

        const { data: freshRow } = await sb!.from("executed_drafts").select("*").eq("draft_id", freshDraftId).maybeSingle();
        assertExists(freshRow);

        await sb!.from("executed_drafts").delete().eq("draft_id", freshDraftId);
      } finally {
        await teardownTestData();
      }
    },
  });

  // ─── M6 TEST: Execute response includes request_id in RPC metadata ───

  Deno.test({
    name: "M6: execute success includes request_id in audit metadata",
    async fn() {
      await setupTestData();
      try {
        const draft = makeDraft();
        const { execute } = await confirmAndExecute(draft);

        const { status, data } = await execute();
        assertEquals(status, 200);
        assertEquals(data.success, true);

        const { data: audits } = await sb!.from("audit_logs")
          .select("metadata")
          .eq("workspace_id", testWorkspaceId)
          .eq("action", "agent.execute.success")
          .order("created_at", { ascending: false })
          .limit(1);

        assertExists(audits);
        assertEquals(audits!.length >= 1, true);
        const meta = audits![0].metadata as Record<string, unknown>;
        assertExists(meta.request_id);
        assertEquals(typeof meta.request_id, "string");
      } finally {
        await teardownTestData();
      }
    },
  });

  // ─── M8 TEST: Rate limiting returns 429 when exceeded ───

  Deno.test({
    name: "M8: rate limiting returns 429 when confirm limit exceeded",
    async fn() {
      await setupTestData();
      try {
        // Fire 21 confirm requests (limit is 20/min)
        let hitRateLimit = false;
        for (let i = 0; i < 22; i++) {
          const draft = makeDraft();
          const { status, data } = await callFunction(
            { mode: "confirm", workspace_id: testWorkspaceId, draft, request_id: crypto.randomUUID() },
            { userId: testUserId, role: "owner" },
          );
          if (status === 429) {
            assertEquals(data.code, "RATE_LIMITED");
            assertExists(data.reset_at);
            assertExists(data.request_id);
            hitRateLimit = true;
            break;
          }
        }
        assertEquals(hitRateLimit, true);
      } finally {
        await teardownTestData();
      }
    },
  });

  // ─── M8 TEST: Request dedupe returns replayed for duplicate request_id ───

  Deno.test({
    name: "M8: duplicate request_id returns REQUEST_REPLAYED",
    async fn() {
      await setupTestData();
      try {
        const sharedRequestId = crypto.randomUUID();
        const draft = makeDraft();

        // First call
        const { status: s1, data: d1 } = await callFunction(
          { mode: "dry_run", workspace_id: testWorkspaceId, draft, request_id: sharedRequestId },
          { userId: testUserId, role: "owner" },
        );
        assertEquals(s1, 200);

        // Second call with same request_id
        const { status: s2, data: d2 } = await callFunction(
          { mode: "dry_run", workspace_id: testWorkspaceId, draft, request_id: sharedRequestId },
          { userId: testUserId, role: "owner" },
        );
        assertEquals(s2, 200);
        assertEquals(d2.code, "REQUEST_REPLAYED");
        assertEquals(d2.replayed, true);
        assertExists(d2.request_id);
      } finally {
        await teardownTestData();
      }
    },
  });

  // ─── M8 TEST: Execute success response includes request_id ───

  Deno.test({
    name: "M8: execute success response includes request_id",
    async fn() {
      await setupTestData();
      try {
        const draft = makeDraft();
        const { execute } = await confirmAndExecute(draft);

        const { status, data } = await execute();
        assertEquals(status, 200);
        assertEquals(data.success, true);
        assertExists(data.request_id);
        assertEquals(typeof data.request_id, "string");
      } finally {
        await teardownTestData();
      }
    },
  });
}

// ─── Maintenance-cleanup tests (require MAINTENANCE_KEY) ───

const MAINTENANCE_TEST_AVAILABLE = !!MAINTENANCE_KEY;

if (MAINTENANCE_TEST_AVAILABLE) {
  Deno.test("M6: maintenance-cleanup rejects missing key with 401", async () => {
    const resp = await fetch(MAINTENANCE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });
    const data = await resp.json();
    assertEquals(resp.status, 401);
    assertEquals(data.code, "UNAUTHORIZED");
    assertExists(data.request_id);
  });

  Deno.test("M6: maintenance-cleanup rejects wrong key with 401", async () => {
    const resp = await fetch(MAINTENANCE_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-maintenance-key": "wrong-key-value",
      },
    });
    const data = await resp.json();
    assertEquals(resp.status, 401);
    assertEquals(data.code, "UNAUTHORIZED");
  });

  Deno.test("M8: maintenance-cleanup accepts correct key and returns all cleanup counts", async () => {
    const resp = await fetch(MAINTENANCE_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-maintenance-key": MAINTENANCE_KEY,
      },
    });
    const data = await resp.json();
    assertEquals(resp.status, 200);
    assertEquals(data.ok, true);
    assertEquals(typeof data.confirmations_deleted, "number");
    assertEquals(typeof data.stale_reservations_deleted, "number");
    assertEquals(typeof data.dedupes_deleted, "number");
    assertEquals(typeof data.rate_limits_deleted, "number");
    assertEquals(typeof data.usage_counters_deleted, "number");
    assertEquals(typeof data.pending_executions_deleted, "number");
    assertEquals(typeof data.runtime_ms, "number");
    assertExists(data.request_id);
  });
}

// ─── M9 Tests (require TEST_MODE + SERVICE_ROLE_KEY) ───

if (TEST_MODE_AVAILABLE) {
  const m9TestUserId = crypto.randomUUID();
  const m9TestWorkspaceId = crypto.randomUUID();
  const m9TestCompanyId = crypto.randomUUID();

  async function setupM9TestData() {
    if (!sb) return;
    await sb.from("companies").insert({ id: m9TestCompanyId, name: "M9 Test Company", created_by: m9TestUserId });
    await sb.from("workspaces").insert({ id: m9TestWorkspaceId, name: "M9 Test Workspace", company_id: m9TestCompanyId });
    await sb.from("profiles").upsert({ user_id: m9TestUserId, full_name: "M9 Test User", preferred_locale: "en" });
    await sb.from("workspace_members").insert({ workspace_id: m9TestWorkspaceId, user_id: m9TestUserId, team_role: "member", invite_status: "accepted" });
    await sb.from("user_roles").insert({ user_id: m9TestUserId, company_id: m9TestCompanyId, role: "member" });
  }

  async function teardownM9TestData() {
    if (!sb) return;
    await sb.from("pending_executions").delete().eq("workspace_id", m9TestWorkspaceId);
    await sb.from("execution_policies").delete().eq("workspace_id", m9TestWorkspaceId);
    await sb.from("usage_counters").delete().eq("workspace_id", m9TestWorkspaceId);
    await sb.from("request_dedupes").delete().eq("workspace_id", m9TestWorkspaceId);
    await sb.from("rate_limits").delete().eq("workspace_id", m9TestWorkspaceId);
    await sb.from("draft_confirmations").delete().eq("workspace_id", m9TestWorkspaceId);
    await sb.from("executed_drafts").delete().eq("workspace_id", m9TestWorkspaceId);
    await sb.from("audit_logs").delete().eq("workspace_id", m9TestWorkspaceId);
    await sb.from("org_events").delete().eq("workspace_id", m9TestWorkspaceId);
    await sb.from("tasks").delete().eq("workspace_id", m9TestWorkspaceId);
    await sb.from("meaning_objects").delete().eq("workspace_id", m9TestWorkspaceId);
    await sb.from("workspace_members").delete().eq("workspace_id", m9TestWorkspaceId);
    await sb.from("user_roles").delete().eq("company_id", m9TestCompanyId);
    await sb.from("workspaces").delete().eq("id", m9TestWorkspaceId);
    await sb.from("companies").delete().eq("id", m9TestCompanyId);
    await sb.from("profiles").delete().eq("user_id", m9TestUserId);
  }

  Deno.test({
    name: "M9: execution policy - require_owner_approval returns PENDING_APPROVAL for member",
    async fn() {
      await setupM9TestData();
      try {
        // Set policy
        await sb!.from("execution_policies").upsert({
          workspace_id: m9TestWorkspaceId,
          require_owner_approval: true,
          restrict_ai_updates: false,
          enabled_modules: ["teamwork", "brain", "chat", "bookivo"],
        });

        const draft = makeDraft();

        // Confirm first
        const { data: confirmData } = await callFunction(
          { mode: "confirm", workspace_id: m9TestWorkspaceId, draft },
          { userId: m9TestUserId, role: "member" },
        );

        const execDraft = {
          ...draft,
          expires_at: confirmData.expires_at,
          meaning: confirmData.meaning_object_id
            ? { meaning_object_id: confirmData.meaning_object_id }
            : draft.meaning,
        };

        const { status, data } = await callFunction(
          { mode: "execute", workspace_id: m9TestWorkspaceId, draft: execDraft, confirmation_hash: confirmData.confirmation_hash },
          { userId: m9TestUserId, role: "member" },
        );

        assertEquals(status, 202);
        assertEquals(data.status, "PENDING_APPROVAL");
        assertExists(data.request_id);
      } finally {
        await teardownM9TestData();
      }
    },
  });

  Deno.test({
    name: "M9: execution policy - disabled module returns MODULE_DISABLED",
    async fn() {
      await setupM9TestData();
      try {
        // Disable teamwork module
        await sb!.from("execution_policies").upsert({
          workspace_id: m9TestWorkspaceId,
          require_owner_approval: false,
          restrict_ai_updates: false,
          enabled_modules: ["brain", "chat"],
        });

        // Make user owner for this test
        await sb!.from("user_roles").update({ role: "owner" }).eq("user_id", m9TestUserId).eq("company_id", m9TestCompanyId);

        const draft = makeDraft(); // target_module: teamwork

        const { data: confirmData } = await callFunction(
          { mode: "confirm", workspace_id: m9TestWorkspaceId, draft },
          { userId: m9TestUserId, role: "owner" },
        );

        const execDraft = {
          ...draft,
          expires_at: confirmData.expires_at,
          meaning: confirmData.meaning_object_id
            ? { meaning_object_id: confirmData.meaning_object_id }
            : draft.meaning,
        };

        const { status, data } = await callFunction(
          { mode: "execute", workspace_id: m9TestWorkspaceId, draft: execDraft, confirmation_hash: confirmData.confirmation_hash },
          { userId: m9TestUserId, role: "owner" },
        );

        assertEquals(status, 403);
        assertEquals(data.code, "MODULE_DISABLED");
        assertExists(data.request_id);
      } finally {
        await teardownM9TestData();
      }
    },
  });

  Deno.test({
    name: "M9: snapshot create works with explicit _actor param",
    async fn() {
      if (!sb) return;

      await setupM9TestData();
      // Make user admin/owner
      await sb!.from("user_roles").update({ role: "owner" }).eq("user_id", m9TestUserId).eq("company_id", m9TestCompanyId);

      try {
        // Create a snapshot via RPC with explicit _actor (fixes service role auth.uid()=null)
        const { data: snapId, error: snapErr } = await sb!.rpc("create_workspace_snapshot", {
          _workspace_id: m9TestWorkspaceId,
          _actor: m9TestUserId,
          _snapshot_type: "test",
        });

        // Should succeed now with explicit _actor
        assertEquals(snapErr, null);
        assertExists(snapId);

        // Verify snapshot exists
        const { data: snap } = await sb!.from("workspace_snapshots").select("*").eq("id", snapId).single();
        assertExists(snap);
        assertEquals(snap.workspace_id, m9TestWorkspaceId);
        assertEquals(snap.snapshot_type, "test");

        // Test preview_restore_snapshot
        const { data: preview, error: previewErr } = await sb!.rpc("preview_restore_snapshot", {
          _snapshot_id: snapId,
          _actor: m9TestUserId,
        });
        assertEquals(previewErr, null);
        assertExists(preview);
        assertExists((preview as Record<string, unknown>).confirmation_token);

        // Cleanup
        await sb!.from("restore_confirmation_tokens").delete().eq("workspace_id", m9TestWorkspaceId);
        await sb!.from("workspace_snapshots").delete().eq("workspace_id", m9TestWorkspaceId);
        await sb!.from("audit_logs").delete().eq("workspace_id", m9TestWorkspaceId);
      } finally {
        await teardownM9TestData();
      }
    },
  });
}
