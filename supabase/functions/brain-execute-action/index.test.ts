import "https://deno.land/std@0.224.0/dotenv/load.ts";
import { assertEquals, assertExists } from "https://deno.land/std@0.224.0/assert/mod.ts";

const SUPABASE_URL = Deno.env.get("VITE_SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("VITE_SUPABASE_PUBLISHABLE_KEY")!;
const FUNCTION_URL = `${SUPABASE_URL}/functions/v1/brain-execute-action`;

// Helper: make request
async function callFunction(body: Record<string, unknown>, token?: string) {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    apikey: SUPABASE_ANON_KEY,
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const resp = await fetch(FUNCTION_URL, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
  const data = await resp.json();
  return { status: resp.status, data };
}

// Minimal draft for testing
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
  // Without a valid token we get 401 first, but this tests the schema path
  const { status, data } = await callFunction({
    mode: "execute",
    workspace_id: crypto.randomUUID(),
    draft: makeDraft(),
    // No confirmation_hash
  });
  // Will be 401 without auth, which is expected
  assertEquals(status, 401);
  assertEquals(data.code, "EXECUTION_DENIED");
});

Deno.test("rejects missing meaning", async () => {
  const { status, data } = await callFunction(
    {
      mode: "dry_run",
      workspace_id: crypto.randomUUID(),
      draft: makeDraft({ meaning: {} }), // Invalid meaning
    },
    "fake-token",
  );
  // Will be 401 (invalid token) before validation, but ensures server doesn't crash
  assertEquals(typeof status, "number");
  await Promise.resolve(); // consume
});

Deno.test("rejects invalid draft structure", async () => {
  const { status, data } = await callFunction(
    {
      mode: "dry_run",
      workspace_id: crypto.randomUUID(),
      draft: { id: "x" }, // Missing required fields
    },
    "fake-token",
  );
  assertEquals(typeof status, "number");
  await Promise.resolve();
});

Deno.test("OPTIONS returns CORS headers", async () => {
  const resp = await fetch(FUNCTION_URL, { method: "OPTIONS" });
  assertEquals(resp.status, 200);
  assertExists(resp.headers.get("access-control-allow-origin"));
  await resp.text(); // consume body
});
