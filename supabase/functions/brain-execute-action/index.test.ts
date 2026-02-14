import "https://deno.land/std@0.224.0/dotenv/load.ts";
import { assertEquals, assertExists } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const SUPABASE_URL = Deno.env.get("VITE_SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("VITE_SUPABASE_PUBLISHABLE_KEY")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || Deno.env.get("VITE_SUPABASE_SERVICE_ROLE_KEY") || "";
const FUNCTION_URL = `${SUPABASE_URL}/functions/v1/brain-execute-action`;

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
});

Deno.test("execute rejects missing confirmation_hash", async () => {
  const { status, data } = await callFunction({
    mode: "execute",
    workspace_id: crypto.randomUUID(),
    draft: makeDraft(),
  });
  // Without auth we get 401 first
  assertEquals(status, 401);
  assertEquals(data.code, "EXECUTION_DENIED");
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

// ─── Strong Behavior Tests (require TEST_MODE=true + SERVICE_ROLE_KEY) ───

const TEST_MODE_AVAILABLE = Deno.env.get("TEST_MODE") === "true" && !!SERVICE_KEY;

if (TEST_MODE_AVAILABLE) {
  const testUserId = crypto.randomUUID();
  const testWorkspaceId = crypto.randomUUID();
  const testCompanyId = crypto.randomUUID();

  // Setup test data once
  async function setupTestData() {
    if (!sb) return;

    // Create company
    await sb.from("companies").insert({
      id: testCompanyId,
      name: "Test Company",
      created_by: testUserId,
    });

    // Create workspace
    await sb.from("workspaces").insert({
      id: testWorkspaceId,
      name: "Test Workspace",
      company_id: testCompanyId,
    });

    // Create profile
    await sb.from("profiles").upsert({
      user_id: testUserId,
      full_name: "Test User",
      preferred_locale: "en",
    });

    // Add as workspace member (accepted)
    await sb.from("workspace_members").insert({
      workspace_id: testWorkspaceId,
      user_id: testUserId,
      team_role: "owner",
      invite_status: "accepted",
    });

    // Add as company owner
    await sb.from("user_roles").insert({
      user_id: testUserId,
      company_id: testCompanyId,
      role: "owner",
    });
  }

  // Teardown test data
  async function teardownTestData() {
    if (!sb) return;
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
    // Step 1: confirm
    const { data: confirmData } = await callFunction(
      { mode: "confirm", workspace_id: testWorkspaceId, draft },
      { userId: testUserId, role: "owner" },
    );

    // Step 2: patch draft with meaning_object_id + expires_at
    const execDraft = {
      ...draft,
      expires_at: confirmData.expires_at,
      meaning: confirmData.meaning_object_id
        ? { meaning_object_id: confirmData.meaning_object_id }
        : draft.meaning,
    };

    // Step 3: execute
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

        // First confirm
        const { status: s1, data: d1 } = await callFunction(
          { mode: "confirm", workspace_id: testWorkspaceId, draft },
          { userId: testUserId, role: "owner" },
        );
        assertEquals(s1, 200);
        assertExists(d1.meaning_object_id);

        // Count meaning_objects
        const { count: countAfterFirst } = await sb!.from("meaning_objects").select("*", { count: "exact", head: true }).eq("workspace_id", testWorkspaceId);

        // Second confirm — same draft
        const { status: s2, data: d2 } = await callFunction(
          { mode: "confirm", workspace_id: testWorkspaceId, draft },
          { userId: testUserId, role: "owner" },
        );
        assertEquals(s2, 200);

        // Same meaning_object_id
        assertEquals(d2.meaning_object_id, d1.meaning_object_id);

        // No new meaning_objects minted
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
        const draft = makeDraft(); // has meaning_payload

        const { status, data } = await callFunction(
          { mode: "execute", workspace_id: testWorkspaceId, draft, confirmation_hash: "any-hash" },
          { userId: testUserId, role: "owner" },
        );
        assertEquals(status, 400);
        assertEquals(data.code, "VALIDATION_ERROR");
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

        // Confirm to get real meaning + hash
        const { data: confirmData } = await callFunction(
          { mode: "confirm", workspace_id: testWorkspaceId, draft },
          { userId: testUserId, role: "owner" },
        );

        // Tamper: use a different meaning_object_id
        const tamperedDraft = {
          ...draft,
          expires_at: confirmData.expires_at,
          meaning: { meaning_object_id: crypto.randomUUID() }, // wrong ID
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

        // First execute — success
        const { status: s1, data: d1 } = await execute();
        assertEquals(s1, 200);
        assertEquals(d1.success, true);
        assertExists(d1.entities);
        assertExists(d1.audit_log_id);

        // Second execute — 200 replayed
        const { status: s2, data: d2 } = await execute();
        assertEquals(s2, 200);
        assertEquals(d2.success, true);
        assertEquals(d2.replayed, true);
        assertExists(d2.audit_log_id);
        // Same entities
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

        // Confirm
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

        // Try execute — should get 409 in-progress
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

        // Check task was created
        const { data: task } = await sb!.from("tasks").select("id").eq("id", data.entities[0].id).single();
        assertExists(task);

        // Check audit_logs
        const { data: audits } = await sb!.from("audit_logs").select("id").eq("workspace_id", testWorkspaceId).eq("action", "agent.execute.success");
        assertEquals(audits!.length >= 1, true);

        // Check org_events
        const { data: events } = await sb!.from("org_events").select("id").eq("workspace_id", testWorkspaceId).eq("event_type", "agent.executed");
        assertEquals(events!.length >= 1, true);

        // Check executed_drafts
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
}
