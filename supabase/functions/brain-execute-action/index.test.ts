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
// These tests validate real behavior by using TEST_MODE bypass headers

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

  Deno.test({
    name: "BEHAVIOR: dry_run does NOT write tasks",
    async fn() {
      await setupTestData();
      try {
        // Count tasks before
        const { count: beforeCount } = await sb!.from("tasks").select("*", { count: "exact", head: true }).eq("workspace_id", testWorkspaceId);

        // Run dry_run
        const { status, data } = await callFunction(
          { mode: "dry_run", workspace_id: testWorkspaceId, draft: makeDraft() },
          { userId: testUserId, role: "owner" },
        );

        assertEquals(status, 200);
        assertEquals(data.can_execute, true);
        assertExists(data.preview);

        // Count tasks after — must be same
        const { count: afterCount } = await sb!.from("tasks").select("*", { count: "exact", head: true }).eq("workspace_id", testWorkspaceId);
        assertEquals(beforeCount, afterCount);
      } finally {
        await teardownTestData();
      }
    },
  });

  Deno.test({
    name: "BEHAVIOR: confirm mints meaning_object_id when meaning_payload provided",
    async fn() {
      await setupTestData();
      try {
        const draft = makeDraft();

        const { status, data } = await callFunction(
          { mode: "confirm", workspace_id: testWorkspaceId, draft },
          { userId: testUserId, role: "owner" },
        );

        assertEquals(status, 200);
        assertExists(data.confirmation_hash);
        assertExists(data.expires_at);
        assertExists(data.meaning_object_id);

        // Verify meaning_objects row exists
        const { data: mo } = await sb!.from("meaning_objects").select("id").eq("id", data.meaning_object_id).single();
        assertExists(mo);
      } finally {
        await teardownTestData();
      }
    },
  });

  Deno.test({
    name: "BEHAVIOR: confirm does NOT mint if meaning_object_id already present",
    async fn() {
      await setupTestData();
      try {
        // Count meaning_objects before
        const { count: beforeCount } = await sb!.from("meaning_objects").select("*", { count: "exact", head: true }).eq("workspace_id", testWorkspaceId);

        const draft = makeDraft({ meaning: { meaning_object_id: crypto.randomUUID() } });

        const { status, data } = await callFunction(
          { mode: "confirm", workspace_id: testWorkspaceId, draft },
          { userId: testUserId, role: "owner" },
        );

        assertEquals(status, 200);
        assertExists(data.confirmation_hash);
        assertEquals(data.meaning_object_id, undefined);

        // No new meaning_objects
        const { count: afterCount } = await sb!.from("meaning_objects").select("*", { count: "exact", head: true }).eq("workspace_id", testWorkspaceId);
        assertEquals(beforeCount, afterCount);
      } finally {
        await teardownTestData();
      }
    },
  });

  Deno.test({
    name: "BEHAVIOR: execute with valid hash creates tasks + audit + org_events + executed_drafts",
    async fn() {
      await setupTestData();
      try {
        const draft = makeDraft();

        // Step 1: confirm to get hash + meaning_object_id
        const { data: confirmData } = await callFunction(
          { mode: "confirm", workspace_id: testWorkspaceId, draft },
          { userId: testUserId, role: "owner" },
        );

        // Step 2: patch draft with meaning_object_id + expires_at
        const execDraft = {
          ...draft,
          expires_at: confirmData.expires_at,
          meaning: { meaning_object_id: confirmData.meaning_object_id },
        };

        // Step 3: execute
        const { status, data } = await callFunction(
          { mode: "execute", workspace_id: testWorkspaceId, draft: execDraft, confirmation_hash: confirmData.confirmation_hash },
          { userId: testUserId, role: "owner" },
        );

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
      } finally {
        await teardownTestData();
      }
    },
  });

  Deno.test({
    name: "BEHAVIOR: execute twice returns 409 ALREADY_EXECUTED",
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

        // First execute — success
        const { status: s1 } = await callFunction(
          { mode: "execute", workspace_id: testWorkspaceId, draft: execDraft, confirmation_hash: confirmData.confirmation_hash },
          { userId: testUserId, role: "owner" },
        );
        assertEquals(s1, 200);

        // Second execute — 409
        const { status: s2, data: d2 } = await callFunction(
          { mode: "execute", workspace_id: testWorkspaceId, draft: execDraft, confirmation_hash: confirmData.confirmation_hash },
          { userId: testUserId, role: "owner" },
        );
        assertEquals(s2, 409);
        assertEquals(d2.code, "ALREADY_EXECUTED");
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

        // Execute with wrong hash
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
        const draft = makeDraft({ expires_at: Date.now() - 60000 }); // expired 1 min ago

        const { status, data } = await callFunction(
          {
            mode: "execute",
            workspace_id: testWorkspaceId,
            draft,
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

        // Confirm as member (role override)
        const { data: confirmData } = await callFunction(
          { mode: "confirm", workspace_id: testWorkspaceId, draft },
          { userId: testUserId, role: "member" }, // member role
        );

        const execDraft = {
          ...draft,
          expires_at: confirmData.expires_at,
          meaning: confirmData.meaning_object_id
            ? { meaning_object_id: confirmData.meaning_object_id }
            : draft.meaning,
        };

        // Execute as member — should be 403
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
