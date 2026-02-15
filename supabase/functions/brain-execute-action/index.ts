import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version, x-test-user-id, x-test-workspace-id, x-test-role",
};

// ─── Constants ───
const SIGNING_SECRET = () => Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const PROPOSAL_TTL_MS = 10 * 60 * 1000; // 10 minutes
const DRAFT_CONFIRM_TTL_MS = 20 * 60 * 1000; // 20 minutes
const IS_TEST_MODE = () => Deno.env.get("TEST_MODE") === "true";

// ─── Types ───

type WorkspaceRole = "member" | "owner";

interface MeaningPayload {
  type: string;
  subject: string;
  description?: string;
  source_lang: string;
  workspace_id: string;
}

type DraftMeaning =
  | { meaning_object_id: string }
  | { meaning_payload: MeaningPayload };

interface DraftScope {
  affected_modules: string[];
  affected_entities: AffectedEntity[];
  impact_summary: string;
}

interface AffectedEntity {
  entity_type: string;
  entity_id?: string;
  action: "create" | "update" | "delete";
  diff?: Record<string, { before: unknown; after: unknown }>;
}

interface DraftObject {
  id: string;
  type: string;
  title: string;
  description?: string;
  target_module: string;
  agent_type: string;
  payload: Record<string, unknown>;
  required_role: WorkspaceRole;
  intent: string;
  scope: DraftScope;
  risks: string[];
  rollback_possible: boolean;
  confirmation_hash?: string;
  expires_at?: number;
  meaning: DraftMeaning;
}

interface DryRunResult {
  can_execute: boolean;
  preview: DraftScope;
  warnings: string[];
  errors: string[];
  estimated_duration_ms?: number;
}

interface ExecuteResult {
  success: boolean;
  entities: { type: string; id: string; action: string }[];
  audit_log_id?: string;
  error?: string;
}

// Legacy types
interface LegacyProposal {
  id: string;
  type: "task" | "goal" | "plan" | "idea" | "update";
  title: string;
  payload: Record<string, unknown>;
  required_role: WorkspaceRole;
  confirmation_hash?: string;
  expires_at?: number;
}

// Request bodies
type RequestBody =
  | { action: "sign"; proposals: LegacyProposal[]; workspace_id: string }
  | { action: "execute"; proposal: LegacyProposal; workspace_id: string }
  | { mode: "dry_run"; workspace_id: string; draft: DraftObject }
  | { mode: "confirm"; workspace_id: string; draft: DraftObject }
  | { mode: "execute"; workspace_id: string; draft: DraftObject; confirmation_hash: string };

// Agent context
interface AgentContext {
  sbService: ReturnType<typeof createClient>;
  sbUser: ReturnType<typeof createClient>;
  workspace_id: string;
  user_id: string;
  role: WorkspaceRole;
  nowISO: string;
  request_id: string;
  source_lang: string;
}

// Agent module interface
interface AgentModule {
  dryRun(draft: DraftObject, ctx: AgentContext): Promise<DryRunResult>;
  execute(draft: DraftObject, ctx: AgentContext): Promise<ExecuteResult>;
}

// ─── HMAC Utilities ───

async function getHmacKey(): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(SIGNING_SECRET()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

function toHex(buf: ArrayBuffer): string {
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

// Legacy proposal signing
async function signProposal(
  key: CryptoKey,
  payload: { userId: string; workspaceId: string; proposalId: string; expiresAt: number },
): Promise<string> {
  const data = JSON.stringify(payload);
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(data));
  return toHex(sig);
}

async function verifyProposal(
  key: CryptoKey,
  payload: { userId: string; workspaceId: string; proposalId: string; expiresAt: number },
  hash: string,
): Promise<boolean> {
  const data = JSON.stringify(payload);
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(data));
  return toHex(sig) === hash;
}

// ─── Draft Confirmation Hash (Milestone 2) ───

function stableStringify(obj: unknown): string {
  if (obj === null || obj === undefined) return "";
  if (typeof obj !== "object") return String(obj);
  if (Array.isArray(obj)) return "[" + obj.map(stableStringify).join(",") + "]";
  const sorted = Object.keys(obj as Record<string, unknown>).sort();
  return "{" + sorted.map((k) => `"${k}":${stableStringify((obj as Record<string, unknown>)[k])}`).join(",") + "}";
}

async function sha256Hex(input: string): Promise<string> {
  const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return toHex(hash);
}

async function signDraftConfirmation(
  hmacKey: CryptoKey,
  draftId: string,
  workspaceId: string,
  userId: string,
  expiresAt: number,
  payload: Record<string, unknown>,
): Promise<string> {
  const payloadHash = await sha256Hex(stableStringify(payload));
  const toSign = `${draftId}:${workspaceId}:${userId}:${expiresAt}:${payloadHash}`;
  const sig = await crypto.subtle.sign("HMAC", hmacKey, new TextEncoder().encode(toSign));
  return toHex(sig);
}

async function verifyDraftConfirmation(
  hmacKey: CryptoKey,
  draftId: string,
  workspaceId: string,
  userId: string,
  expiresAt: number,
  payload: Record<string, unknown>,
  providedHash: string,
): Promise<boolean> {
  const expected = await signDraftConfirmation(hmacKey, draftId, workspaceId, userId, expiresAt, payload);
  if (expected.length !== providedHash.length) return false;
  let result = 0;
  for (let i = 0; i < expected.length; i++) {
    result |= expected.charCodeAt(i) ^ providedHash.charCodeAt(i);
  }
  return result === 0;
}

// ─── Role Check ───

async function getUserWorkspaceRole(
  sb: ReturnType<typeof createClient>,
  userId: string,
  workspaceId: string,
): Promise<WorkspaceRole | null> {
  const { data: member } = await sb
    .from("workspace_members")
    .select("team_role")
    .eq("workspace_id", workspaceId)
    .eq("user_id", userId)
    .eq("invite_status", "accepted")
    .maybeSingle();

  if (!member) return null;

  const { data: workspace } = await sb
    .from("workspaces")
    .select("company_id")
    .eq("id", workspaceId)
    .single();

  if (!workspace) return "member";

  const { data: companyRole } = await sb
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("company_id", workspace.company_id)
    .maybeSingle();

  if (companyRole?.role === "owner") return "owner";
  return "member";
}

function hasRequiredRole(userRole: WorkspaceRole, requiredRole: WorkspaceRole): boolean {
  const hierarchy: Record<WorkspaceRole, number> = { owner: 2, member: 1 };
  return hierarchy[userRole] >= hierarchy[requiredRole];
}

// ─── Validation ───

function isLegacyRequest(body: Record<string, unknown>): boolean {
  return "action" in body && !("mode" in body);
}

function isDraftRequest(body: Record<string, unknown>): boolean {
  return "mode" in body;
}

function validateDraft(draft: unknown): { valid: true; draft: DraftObject } | { valid: false; error: string } {
  if (!draft || typeof draft !== "object") return { valid: false, error: "Draft is required" };
  const d = draft as Record<string, unknown>;
  if (!d.id || typeof d.id !== "string") return { valid: false, error: "draft.id required" };
  if (!d.type || typeof d.type !== "string") return { valid: false, error: "draft.type required" };
  if (!d.title || typeof d.title !== "string") return { valid: false, error: "draft.title required" };
  if (!d.target_module || typeof d.target_module !== "string") return { valid: false, error: "draft.target_module required" };
  if (!d.payload || typeof d.payload !== "object") return { valid: false, error: "draft.payload required" };
  if (!d.required_role || !["member", "owner"].includes(d.required_role as string)) return { valid: false, error: "draft.required_role must be member|owner" };
  if (!d.intent || typeof d.intent !== "string") return { valid: false, error: "draft.intent required" };
  if (!d.scope || typeof d.scope !== "object") return { valid: false, error: "draft.scope required" };
  if (!d.meaning || typeof d.meaning !== "object") return { valid: false, error: "draft.meaning required (ULL: No Meaning, No Content)" };
  const m = d.meaning as Record<string, unknown>;
  if (!("meaning_object_id" in m) && !("meaning_payload" in m)) {
    return { valid: false, error: "draft.meaning must have meaning_object_id or meaning_payload" };
  }
  return { valid: true, draft: d as unknown as DraftObject };
}

// ─── Agent Modules (Hybrid: in-process) ───

function resolveAgentType(draft: DraftObject): string {
  if (draft.agent_type) return draft.agent_type;
  const mapping: Record<string, string> = {
    task: "teamwork", goal: "teamwork", plan: "teamwork", update: "teamwork",
    draft_task_set: "teamwork", draft_plan: "teamwork",
    draft_message: "chat",
    draft_design_change: "bookivo",
    idea: "brain",
  };
  return mapping[draft.type] || "unknown";
}

// ── Teamwork Agent ──

const teamworkAgent: AgentModule = {
  async dryRun(draft: DraftObject, _ctx: AgentContext): Promise<DryRunResult> {
    const warnings: string[] = [];
    const errors: string[] = [];

    if (draft.type === "draft_task_set") {
      const tasks = (draft.payload.tasks as Array<Record<string, unknown>>) || [];
      if (tasks.length === 0) {
        errors.push("No tasks provided in draft_task_set");
        return { can_execute: false, preview: draft.scope, warnings, errors };
      }
      return {
        can_execute: true,
        preview: {
          affected_modules: ["teamwork"],
          affected_entities: tasks.map((_t, _i) => ({
            entity_type: "task",
            action: "create" as const,
            entity_id: undefined,
            diff: undefined,
          })),
          impact_summary: `Will create ${tasks.length} task(s)`,
        },
        warnings,
        errors,
      };
    }

    if (draft.type === "draft_plan") {
      const steps = (draft.payload.steps as unknown[]) || [];
      return {
        can_execute: true,
        preview: {
          affected_modules: ["teamwork"],
          affected_entities: [{ entity_type: "plan", action: "create" as const }],
          impact_summary: `Will create a plan with ${steps.length} step(s)`,
        },
        warnings,
        errors,
      };
    }

    return {
      can_execute: true,
      preview: draft.scope,
      warnings,
      errors,
    };
  },

  async execute(draft: DraftObject, ctx: AgentContext): Promise<ExecuteResult> {
    const entities: { type: string; id: string; action: string }[] = [];

    // Resolve meaning_object_id
    let meaningObjectId: string;
    if ("meaning_object_id" in draft.meaning) {
      meaningObjectId = draft.meaning.meaning_object_id;
    } else {
      const mp = draft.meaning.meaning_payload;
      const meaningJson = {
        version: "v1",
        type: mp.type,
        intent: draft.intent,
        subject: mp.subject,
        description: mp.description || "",
        constraints: {},
        metadata: { created_from: "agent_execution", draft_id: draft.id },
      };
      const { data: mo, error: moErr } = await ctx.sbService
        .from("meaning_objects")
        .insert({
          workspace_id: ctx.workspace_id,
          created_by: ctx.user_id,
          type: mp.type,
          source_lang: mp.source_lang,
          meaning_json: meaningJson,
        })
        .select("id")
        .single();
      if (moErr || !mo) return { success: false, entities, error: `Meaning mint failed: ${moErr?.message}` };
      meaningObjectId = mo.id;
    }

    if (draft.type === "draft_task_set") {
      const tasks = (draft.payload.tasks as Array<Record<string, unknown>>) || [];
      for (const t of tasks) {
        const { data, error } = await ctx.sbService
          .from("tasks")
          .insert({
            workspace_id: ctx.workspace_id,
            created_by: ctx.user_id,
            title: (t.title as string) || draft.title,
            description: (t.description as string) || null,
            status: "backlog",
            due_date: (t.due_at as string) || null,
            assigned_to: (t.assignee_user_id as string) || null,
            meaning_object_id: meaningObjectId,
            source_lang: ctx.source_lang,
          })
          .select("id")
          .single();
        if (error) return { success: false, entities, error: `Task insert failed: ${error.message}` };
        entities.push({ type: "task", id: data.id, action: "create" });
      }
      return { success: true, entities };
    }

    if (draft.type === "draft_plan") {
      const { data, error } = await ctx.sbService
        .from("plans")
        .insert({
          workspace_id: ctx.workspace_id,
          created_by: ctx.user_id,
          title: draft.title,
          description: (draft.payload.description as string) || null,
          plan_type: (draft.payload.plan_type as string) || "custom",
          goal_id: (draft.payload.goal_id as string) || null,
          ai_generated: true,
          meaning_object_id: meaningObjectId,
          source_lang: ctx.source_lang,
        })
        .select("id")
        .single();
      if (error) return { success: false, entities, error: `Plan insert failed: ${error.message}` };
      entities.push({ type: "plan", id: data.id, action: "create" });
      return { success: true, entities };
    }

    return { success: false, entities, error: `Teamwork agent: unsupported type ${draft.type}` };
  },
};

// ── Chat Agent ──

const chatAgent: AgentModule = {
  async dryRun(draft: DraftObject, _ctx: AgentContext): Promise<DryRunResult> {
    return {
      can_execute: true,
      preview: {
        affected_modules: ["chat"],
        affected_entities: [{ entity_type: "message", action: "create" as const }],
        impact_summary: "Will send a chat message (draft preview)",
      },
      warnings: ["Chat agent execution is not yet implemented"],
      errors: [],
    };
  },

  async execute(_draft: DraftObject, _ctx: AgentContext): Promise<ExecuteResult> {
    return { success: false, entities: [], error: "Chat agent execute not yet implemented" };
  },
};

// ── Bookivo Agent (stub) ──

const bookivoAgent: AgentModule = {
  async dryRun(_draft: DraftObject, _ctx: AgentContext): Promise<DryRunResult> {
    return {
      can_execute: false,
      preview: { affected_modules: ["bookivo"], affected_entities: [], impact_summary: "Bookivo agent not yet available" },
      warnings: [],
      errors: ["Bookivo agent is not yet implemented"],
    };
  },

  async execute(_draft: DraftObject, _ctx: AgentContext): Promise<ExecuteResult> {
    return { success: false, entities: [], error: "Bookivo agent not yet implemented" };
  },
};

// ── Brain Agent (ideas) ──

const brainAgent: AgentModule = {
  async dryRun(draft: DraftObject, _ctx: AgentContext): Promise<DryRunResult> {
    return {
      can_execute: true,
      preview: {
        affected_modules: ["brain"],
        affected_entities: [{ entity_type: "idea", action: "create" as const }],
        impact_summary: "Will save an idea",
      },
      warnings: [],
      errors: [],
    };
  },

  async execute(draft: DraftObject, ctx: AgentContext): Promise<ExecuteResult> {
    let meaningObjectId: string;
    if ("meaning_object_id" in draft.meaning) {
      meaningObjectId = draft.meaning.meaning_object_id;
    } else {
      const mp = draft.meaning.meaning_payload;
      const { data: mo, error: moErr } = await ctx.sbService
        .from("meaning_objects")
        .insert({
          workspace_id: ctx.workspace_id,
          created_by: ctx.user_id,
          type: mp.type,
          source_lang: mp.source_lang,
          meaning_json: { version: "v1", type: mp.type, subject: mp.subject, description: mp.description || "" },
        })
        .select("id")
        .single();
      if (moErr || !mo) return { success: false, entities: [], error: `Meaning mint failed: ${moErr?.message}` };
      meaningObjectId = mo.id;
    }

    const { data, error } = await ctx.sbService
      .from("ideas")
      .insert({
        workspace_id: ctx.workspace_id,
        created_by: ctx.user_id,
        title: draft.title,
        description: (draft.payload.description as string) || null,
        source: "brain",
        meaning_object_id: meaningObjectId,
        source_lang: ctx.source_lang,
      })
      .select("id")
      .single();
    if (error) return { success: false, entities: [], error: error.message };
    return { success: true, entities: [{ type: "idea", id: data.id, action: "create" }] };
  },
};

const AGENTS: Record<string, AgentModule> = {
  teamwork: teamworkAgent,
  chat: chatAgent,
  bookivo: bookivoAgent,
  brain: brainAgent,
};

// ─── Legacy Execution (from Milestone 0) ───

async function executeLegacyProposal(
  sb: ReturnType<typeof createClient>,
  proposal: LegacyProposal,
  userId: string,
  workspaceId: string,
  sourceLang: string,
): Promise<{ success: boolean; result?: unknown; error?: string }> {
  const meaningJson = {
    version: "v1",
    type: proposal.type.toLowerCase(),
    intent: proposal.type === "update" ? "update" : "create",
    subject: proposal.title,
    description: (proposal.payload.description as string) || "",
    constraints: {},
    metadata: { created_from: "brain_execution", proposal_id: proposal.id, confidence: 0.9 },
  };

  const { data: meaningObj, error: meaningErr } = await sb
    .from("meaning_objects")
    .insert({ workspace_id: workspaceId, created_by: userId, type: proposal.type.toLowerCase(), source_lang: sourceLang, meaning_json: meaningJson })
    .select("id")
    .single();

  if (meaningErr || !meaningObj) return { success: false, error: `Meaning object failed: ${meaningErr?.message}` };
  const meaningObjectId = meaningObj.id;

  switch (proposal.type) {
    case "task": {
      const { data, error } = await sb.from("tasks").insert({
        workspace_id: workspaceId, created_by: userId, title: proposal.title,
        description: (proposal.payload.description as string) || null,
        status: (proposal.payload.status as string) || "backlog",
        due_date: (proposal.payload.due_date as string) || null,
        is_priority: (proposal.payload.is_priority as boolean) || false,
        goal_id: (proposal.payload.goal_id as string) || null,
        meaning_object_id: meaningObjectId, source_lang: sourceLang,
      }).select("id").single();
      if (error) return { success: false, error: error.message };
      return { success: true, result: { type: "task", id: data.id } };
    }
    case "goal": {
      const { data, error } = await sb.from("goals").insert({
        workspace_id: workspaceId, created_by: userId, title: proposal.title,
        description: (proposal.payload.description as string) || null, status: "active",
        due_date: (proposal.payload.due_date as string) || null,
        kpi_name: (proposal.payload.kpi_name as string) || null,
        kpi_target: (proposal.payload.kpi_target as number) || null,
        meaning_object_id: meaningObjectId, source_lang: sourceLang,
      }).select("id").single();
      if (error) return { success: false, error: error.message };
      return { success: true, result: { type: "goal", id: data.id } };
    }
    case "plan": {
      const { data, error } = await sb.from("plans").insert({
        workspace_id: workspaceId, created_by: userId, title: proposal.title,
        description: (proposal.payload.description as string) || null,
        plan_type: (proposal.payload.plan_type as string) || "custom",
        goal_id: (proposal.payload.goal_id as string) || null,
        ai_generated: true, meaning_object_id: meaningObjectId, source_lang: sourceLang,
      }).select("id").single();
      if (error) return { success: false, error: error.message };
      return { success: true, result: { type: "plan", id: data.id } };
    }
    case "idea": {
      const { data, error } = await sb.from("ideas").insert({
        workspace_id: workspaceId, created_by: userId, title: proposal.title,
        description: (proposal.payload.description as string) || null,
        source: "brain", meaning_object_id: meaningObjectId, source_lang: sourceLang,
      }).select("id").single();
      if (error) return { success: false, error: error.message };
      return { success: true, result: { type: "idea", id: data.id } };
    }
    case "update": {
      const entityType = proposal.payload.entity_type as string;
      const entityId = proposal.payload.entity_id as string;
      const updates = proposal.payload.updates as Record<string, unknown>;
      if (!entityType || !entityId || !updates) return { success: false, error: "Update requires entity_type, entity_id, and updates" };
      const allowedTables = ["tasks", "goals", "plans", "ideas"];
      if (!allowedTables.includes(entityType)) return { success: false, error: `Cannot update entity type: ${entityType}` };
      const allowedFields: Record<string, string[]> = {
        tasks: ["title", "description", "status", "due_date", "is_priority", "assigned_to", "blocked_reason"],
        goals: ["title", "description", "status", "due_date", "kpi_current"],
        plans: ["title", "description"],
        ideas: ["title", "description", "status"],
      };
      const safeUpdates: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(updates)) {
        if (allowedFields[entityType]?.includes(k)) safeUpdates[k] = v;
      }
      if (Object.keys(safeUpdates).length === 0) return { success: false, error: "No valid fields to update" };
      const { error } = await sb.from(entityType).update(safeUpdates).eq("id", entityId).eq("workspace_id", workspaceId);
      if (error) return { success: false, error: error.message };
      return { success: true, result: { type: "update", entity_type: entityType, id: entityId } };
    }
    default:
      return { success: false, error: `Unknown proposal type: ${proposal.type}` };
  }
}

// ─── Audit & Org Event helpers ───

async function writeAudit(
  sb: ReturnType<typeof createClient>,
  params: { workspace_id: string; actor_user_id: string; action: string; entity_type: string; entity_id?: string; metadata?: Record<string, unknown> },
): Promise<string | undefined> {
  const { data, error } = await sb.from("audit_logs").insert({
    workspace_id: params.workspace_id,
    actor_user_id: params.actor_user_id,
    action: params.action,
    entity_type: params.entity_type,
    entity_id: params.entity_id || null,
    metadata: (params.metadata || {}) as Record<string, unknown>,
  }).select("id").single();
  if (error) console.warn("[brain-execute] audit write warning:", error.message);
  return data?.id;
}

async function emitOrgEvent(
  sb: ReturnType<typeof createClient>,
  params: { workspace_id: string; event_type: string; metadata: Record<string, unknown> },
): Promise<void> {
  const { error } = await sb.from("org_events").insert({
    workspace_id: params.workspace_id,
    event_type: params.event_type,
    object_type: "agent",
    severity_hint: "info",
    metadata: params.metadata as Record<string, unknown>,
  });
  if (error) console.warn("[brain-execute] org_event write warning:", error.message);
}

// ─── Meaning Minting (for confirm step) ───

async function mintMeaningObject(
  sb: ReturnType<typeof createClient>,
  params: { workspace_id: string; user_id: string; meaning_payload: MeaningPayload; draft_id: string; intent: string },
): Promise<{ meaning_object_id: string } | { error: string }> {
  const mp = params.meaning_payload;
  const meaningJson = {
    version: "v1",
    type: mp.type,
    intent: params.intent,
    subject: mp.subject,
    description: mp.description || "",
    constraints: {},
    metadata: { created_from: "draft_confirm", draft_id: params.draft_id },
  };

  const { data, error } = await sb
    .from("meaning_objects")
    .insert({
      workspace_id: params.workspace_id,
      created_by: params.user_id,
      type: mp.type,
      source_lang: mp.source_lang,
      meaning_json: meaningJson,
    })
    .select("id")
    .single();

  if (error || !data) return { error: `Meaning mint failed: ${error?.message}` };
  return { meaning_object_id: data.id };
}

// ─── Draft Idempotency Reservation ───

interface ExecutedDraftRow {
  draft_id: string;
  status: string;
  entity_refs: unknown[];
  error: string | null;
  audit_log_id: string | null;
  confirmed_meaning_object_id: string | null;
  request_id: string | null;
}

async function reserveDraftExecution(
  sb: ReturnType<typeof createClient>,
  params: { draft_id: string; workspace_id: string; agent_type: string; draft_type: string; executed_by: string; request_id: string },
): Promise<{ status: "ok" } | { status: "duplicate"; row: ExecutedDraftRow } | { status: "error" }> {
  const { error } = await sb.from("executed_drafts").insert({
    draft_id: params.draft_id,
    workspace_id: params.workspace_id,
    agent_type: params.agent_type,
    draft_type: params.draft_type,
    executed_by: params.executed_by,
    status: "reserved",
    request_id: params.request_id,
  });

  if (error) {
    const isDuplicate = error.code === "23505" || error.message?.includes("duplicate");
    if (isDuplicate) {
      // Fetch existing row for replay
      const { data: existing } = await sb.from("executed_drafts")
        .select("draft_id, status, entity_refs, error, audit_log_id, confirmed_meaning_object_id, request_id")
        .eq("draft_id", params.draft_id)
        .maybeSingle();
      return { status: "duplicate", row: existing as ExecutedDraftRow };
    }
    console.error("[brain-execute] reservation error:", error.message);
    return { status: "error" };
  }
  return { status: "ok" };
}

async function finalizeDraftReservation(
  sb: ReturnType<typeof createClient>,
  draftId: string,
  status: "success" | "failed",
  entityRefs: unknown[],
  auditLogId?: string,
  errorMsg?: string,
): Promise<void> {
  await sb.from("executed_drafts").update({
    status,
    entity_refs: entityRefs,
    error: errorMsg || null,
    audit_log_id: auditLogId || null,
  }).eq("draft_id", draftId);
}

// ─── Confirm Idempotency via draft_confirmations (Plan B) ───

interface DraftConfirmationRow {
  draft_id: string;
  confirmed_meaning_object_id: string;
  confirmation_hash: string;
  expires_at: number;
}

async function getConfirmation(
  sb: ReturnType<typeof createClient>,
  draftId: string,
): Promise<DraftConfirmationRow | null> {
  const { data } = await sb.from("draft_confirmations")
    .select("draft_id, confirmed_meaning_object_id, confirmation_hash, expires_at")
    .eq("draft_id", draftId)
    .maybeSingle();
  return data as DraftConfirmationRow | null;
}

async function storeConfirmation(
  sb: ReturnType<typeof createClient>,
  params: {
    draft_id: string;
    workspace_id: string;
    confirmed_meaning_object_id: string;
    confirmed_by: string;
    confirmation_hash: string;
    expires_at: number;
  },
): Promise<void> {
  await sb.from("draft_confirmations").upsert({
    draft_id: params.draft_id,
    workspace_id: params.workspace_id,
    confirmed_meaning_object_id: params.confirmed_meaning_object_id,
    confirmed_by: params.confirmed_by,
    confirmation_hash: params.confirmation_hash,
    expires_at: params.expires_at,
  }, { onConflict: "draft_id", ignoreDuplicates: true });
}

// ─── Main Handler ───

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const sbService = createClient(supabaseUrl, serviceKey);

    // ─── Auth (with TEST_MODE bypass) ───
    let userId: string;
    let authHeader: string;

    if (IS_TEST_MODE() && req.headers.get("x-test-user-id")) {
      userId = req.headers.get("x-test-user-id")!;
      authHeader = `Bearer test-token-${userId}`;
    } else {
      authHeader = req.headers.get("Authorization") || "";
      if (!authHeader.startsWith("Bearer ")) {
        return new Response(
          JSON.stringify({ code: "EXECUTION_DENIED", reason: "Missing authorization", suggested_action: "login" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      const authClient = createClient(supabaseUrl, supabaseAnonKey, {
        global: { headers: { Authorization: authHeader } },
      });

      const token = authHeader.replace("Bearer ", "");
      const { data: { user }, error: userError } = await authClient.auth.getUser(token);
      if (userError || !user) {
        return new Response(
          JSON.stringify({ code: "EXECUTION_DENIED", reason: "Invalid token", suggested_action: "login" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      userId = user.id;
    }

    const body = await req.json();

    if (!body.workspace_id) {
      return new Response(
        JSON.stringify({ code: "EXECUTION_DENIED", reason: "Missing workspace_id", suggested_action: "regenerate proposal" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const hmacKey = await getHmacKey();

    // ═══════════════════════════════════════════
    // DRAFT MODE ROUTING (Milestone 2+3)
    // ═══════════════════════════════════════════
    if (isDraftRequest(body)) {
      const mode = body.mode as string;
      const workspaceId = body.workspace_id as string;

      // Validate draft
      const validation = validateDraft(body.draft);
      if (!validation.valid) {
        return new Response(
          JSON.stringify({ code: "VALIDATION_ERROR", reason: validation.error }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      const draft = validation.draft;

      // Check workspace membership (TEST_MODE can use x-test-role header)
      let userRole: WorkspaceRole | null;
      if (IS_TEST_MODE() && req.headers.get("x-test-role")) {
        userRole = req.headers.get("x-test-role") as WorkspaceRole;
      } else {
        userRole = await getUserWorkspaceRole(sbService, userId, workspaceId);
      }

      if (!userRole) {
        return new Response(
          JSON.stringify({ code: "EXECUTION_DENIED", reason: "Not a workspace member", suggested_action: "request access" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      // Resolve agent
      const agentType = resolveAgentType(draft);
      const agent = AGENTS[agentType];
      if (!agent) {
        return new Response(
          JSON.stringify({ code: "AGENT_NOT_FOUND", reason: `No agent for type: ${agentType}` }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      // Get source lang
      const { data: profile } = await sbService.from("profiles").select("preferred_locale").eq("user_id", userId).maybeSingle();
      const sourceLang = profile?.preferred_locale || "en";

      const userClient = IS_TEST_MODE()
        ? sbService // In test mode, use service client as user client
        : createClient(supabaseUrl, supabaseAnonKey, { global: { headers: { Authorization: authHeader } } });

      const requestId = (body.request_id as string) || crypto.randomUUID();
      const ctx: AgentContext = {
        sbService,
        sbUser: userClient,
        workspace_id: workspaceId,
        user_id: userId,
        role: userRole,
        nowISO: new Date().toISOString(),
        request_id: requestId,
        source_lang: sourceLang,
      };

      // ─── MODE: dry_run ───
      if (mode === "dry_run") {
        const result = await agent.dryRun(draft, ctx);
        return new Response(JSON.stringify({ ...result, request_id: requestId }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // ─── MODE: confirm (M4: idempotent via draft_confirmations) ───
      if (mode === "confirm") {
        const expiresAt = draft.expires_at || (Date.now() + DRAFT_CONFIRM_TTL_MS);

        // If meaning_object_id already present, skip minting entirely
        if ("meaning_object_id" in draft.meaning) {
          const hash = await signDraftConfirmation(hmacKey, draft.id, workspaceId, userId, expiresAt, draft.payload);
          // Store confirmation for binding check at execute time
          await storeConfirmation(sbService, {
            draft_id: draft.id,
            workspace_id: workspaceId,
            confirmed_meaning_object_id: draft.meaning.meaning_object_id,
            confirmed_by: userId,
            confirmation_hash: hash,
            expires_at: expiresAt,
          });
          return new Response(
            JSON.stringify({ confirmation_hash: hash, expires_at: expiresAt }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } },
          );
        }

        // meaning_payload path: idempotent minting
        const existing = await getConfirmation(sbService, draft.id);
        if (existing) {
          // Already confirmed — replay same response (idempotent)
          const hash = await signDraftConfirmation(hmacKey, draft.id, workspaceId, userId, existing.expires_at, draft.payload);
          return new Response(
            JSON.stringify({
              confirmation_hash: hash,
              expires_at: existing.expires_at,
              meaning_object_id: existing.confirmed_meaning_object_id,
            }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } },
          );
        }

        // First confirm: mint meaning
        const mintResult = await mintMeaningObject(sbService, {
          workspace_id: workspaceId,
          user_id: userId,
          meaning_payload: (draft.meaning as { meaning_payload: MeaningPayload }).meaning_payload,
          draft_id: draft.id,
          intent: draft.intent,
        });
        if ("error" in mintResult) {
          return new Response(
            JSON.stringify({ code: "MEANING_MINT_FAILED", reason: mintResult.error }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
          );
        }

        const hash = await signDraftConfirmation(hmacKey, draft.id, workspaceId, userId, expiresAt, draft.payload);

        // Store confirmation for idempotency + binding
        await storeConfirmation(sbService, {
          draft_id: draft.id,
          workspace_id: workspaceId,
          confirmed_meaning_object_id: mintResult.meaning_object_id,
          confirmed_by: userId,
          confirmation_hash: hash,
          expires_at: expiresAt,
        });

        return new Response(
          JSON.stringify({
            confirmation_hash: hash,
            expires_at: expiresAt,
            meaning_object_id: mintResult.meaning_object_id,
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      // ─── MODE: execute (Milestone 3+: strong idempotency + meaning_object_id required) ───
      if (mode === "execute") {
        const confirmationHash = (body as { confirmation_hash?: string }).confirmation_hash;
        if (!confirmationHash) {
          return new Response(
            JSON.stringify({ code: "EXECUTION_DENIED", reason: "Missing confirmation_hash", suggested_action: "call confirm first" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
          );
        }

        // Enforce: execute requires meaning_object_id (not meaning_payload)
        if (!("meaning_object_id" in draft.meaning)) {
          return new Response(
            JSON.stringify({ code: "VALIDATION_ERROR", reason: "Execute requires meaning_object_id. Call confirm first to mint meaning." }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
          );
        }

        // ── Meaning binding check: server verifies client-sent meaning_object_id ──
        const confirmation = await getConfirmation(sbService, draft.id);
        if (!confirmation) {
          return new Response(
            JSON.stringify({ code: "VALIDATION_ERROR", reason: "Draft must be confirmed before execute", suggested_action: "call confirm" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
          );
        }
        if (confirmation.confirmed_meaning_object_id !== (draft.meaning as { meaning_object_id: string }).meaning_object_id) {
          return new Response(
            JSON.stringify({ code: "EXECUTION_DENIED", reason: "Meaning mismatch — draft tampered", suggested_action: "reconfirm" }),
            { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } },
          );
        }

        // Expiry
        if (draft.expires_at && Date.now() > draft.expires_at) {
          return new Response(
            JSON.stringify({ code: "EXECUTION_DENIED", reason: "Draft expired", suggested_action: "regenerate draft" }),
            { status: 410, headers: { ...corsHeaders, "Content-Type": "application/json" } },
          );
        }

        // HMAC verify
        const expiresAt = draft.expires_at || 0;
        const isValid = await verifyDraftConfirmation(hmacKey, draft.id, workspaceId, userId, expiresAt, draft.payload, confirmationHash);
        if (!isValid) {
          return new Response(
            JSON.stringify({ code: "EXECUTION_DENIED", reason: "Hash mismatch — draft tampered or user changed", suggested_action: "regenerate draft" }),
            { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } },
          );
        }

        // RBAC
        if (!hasRequiredRole(userRole, draft.required_role)) {
          return new Response(
            JSON.stringify({ code: "EXECUTION_DENIED", reason: `Requires ${draft.required_role}, you have ${userRole}`, suggested_action: "request elevated permission" }),
            { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } },
          );
        }

        // ── Atomic execution via RPC (Milestone 5) ──
        const { data: rpcResult, error: rpcError } = await sbService.rpc("execute_draft_atomic", {
          _workspace_id: workspaceId,
          _draft_id: draft.id,
          _draft_type: draft.type,
          _agent_type: agentType,
          _user_id: userId,
          _request_id: requestId,
          _meaning_object_id: (draft.meaning as { meaning_object_id: string }).meaning_object_id,
          _payload: draft.payload,
          _source_lang: sourceLang,
          _draft_title: draft.title,
          _draft_intent: draft.intent,
        });

        if (rpcError) {
          console.error("[brain-execute] RPC error:", rpcError.message, "request_id:", requestId);
          // RPC raised an exception — entire transaction was rolled back (true atomicity).
          // No partial writes exist. Return error to client.
          return new Response(
            JSON.stringify({ code: "EXECUTION_FAILED", reason: rpcError.message, request_id: requestId }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
          );
        }

        const result = rpcResult as Record<string, unknown>;

        // RPC returns structured jsonb — map to HTTP
        if (result.success === true) {
          return new Response(
            JSON.stringify({
              success: true,
              entities: result.entities,
              audit_log_id: result.audit_log_id,
              replayed: result.replayed || false,
              request_id: requestId,
            }),
            { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
          );
        }

        // Failure responses from RPC (idempotency: replay failed/in-progress)
        const code = (result.code as string) || "EXECUTION_FAILED";
        const reason = (result.reason as string) || "Unknown error";
        const httpStatus = code === "ALREADY_EXECUTED"
          ? 409
          : code === "EXECUTION_DENIED"
          ? 403
          : 400;

        return new Response(
          JSON.stringify({
            code,
            reason,
            request_id: requestId,
            ...(result.previous_error ? { previous_error: result.previous_error } : {}),
            ...(result.status ? { status: result.status } : {}),
          }),
          { status: httpStatus, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      return new Response(
        JSON.stringify({ error: "Invalid mode. Use dry_run, confirm, or execute." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ═══════════════════════════════════════════
    // LEGACY PROPOSAL ROUTING (Milestone 0)
    // ═══════════════════════════════════════════
    if (isLegacyRequest(body)) {
      const legacyBody = body as { action: string; workspace_id: string; proposals?: LegacyProposal[]; proposal?: LegacyProposal };

      // ─── ACTION: SIGN ───
      if (legacyBody.action === "sign") {
        const { proposals, workspace_id } = legacyBody;
        if (!Array.isArray(proposals) || proposals!.length === 0 || proposals!.length > 20) {
          return new Response(
            JSON.stringify({ error: "proposals must be 1-20 items" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
          );
        }

        const role = await getUserWorkspaceRole(sbService, userId, workspace_id);
        if (!role) {
          return new Response(
            JSON.stringify({ code: "EXECUTION_DENIED", reason: "Not a workspace member", suggested_action: "request elevated permission" }),
            { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } },
          );
        }

        const expiresAt = Date.now() + PROPOSAL_TTL_MS;
        const signedProposals: LegacyProposal[] = [];

        for (const p of proposals!) {
          const proposalId = p.id || crypto.randomUUID();
          const hash = await signProposal(hmacKey, { userId, workspaceId: workspace_id, proposalId, expiresAt });
          signedProposals.push({ ...p, id: proposalId, confirmation_hash: hash, expires_at: expiresAt });
        }

        return new Response(JSON.stringify({ proposals: signedProposals }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // ─── ACTION: EXECUTE ───
      if (legacyBody.action === "execute") {
        const { proposal, workspace_id } = legacyBody;
        if (!proposal || !proposal!.id || !proposal!.confirmation_hash || !proposal!.expires_at) {
          return new Response(
            JSON.stringify({ code: "EXECUTION_DENIED", reason: "Invalid proposal structure", suggested_action: "regenerate proposal" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
          );
        }

        if (Date.now() > proposal!.expires_at!) {
          return new Response(
            JSON.stringify({ code: "EXECUTION_DENIED", reason: "Proposal expired", suggested_action: "regenerate proposal" }),
            { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } },
          );
        }

        const isValid = await verifyProposal(hmacKey, { userId, workspaceId: workspace_id, proposalId: proposal!.id, expiresAt: proposal!.expires_at! }, proposal!.confirmation_hash!);
        if (!isValid) {
          return new Response(
            JSON.stringify({ code: "EXECUTION_DENIED", reason: "Hash mismatch — proposal tampered or user changed", suggested_action: "regenerate proposal" }),
            { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } },
          );
        }

        const userRole = await getUserWorkspaceRole(sbService, userId, workspace_id);
        if (!userRole) {
          return new Response(
            JSON.stringify({ code: "EXECUTION_DENIED", reason: "Not a workspace member", suggested_action: "request elevated permission" }),
            { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } },
          );
        }

        if (!hasRequiredRole(userRole, proposal!.required_role)) {
          return new Response(
            JSON.stringify({ code: "EXECUTION_DENIED", reason: `Requires ${proposal!.required_role} role, you have ${userRole}`, suggested_action: "request elevated permission" }),
            { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } },
          );
        }

        // Idempotency reservation
        const { error: reserveErr } = await sbService.from("executed_proposals").insert({
          proposal_id: proposal!.id,
          workspace_id: workspace_id,
          entity_type: proposal!.type,
          entity_id: "",
        });

        if (reserveErr) {
          const isDuplicate = reserveErr.code === "23505" || reserveErr.message?.includes("duplicate");
          if (isDuplicate) {
            return new Response(
              JSON.stringify({ code: "ALREADY_EXECUTED", reason: "This proposal has already been executed", suggested_action: "none" }),
              { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } },
            );
          }
          console.error("[brain-execute] reservation error:", reserveErr.message);
          return new Response(
            JSON.stringify({ code: "EXECUTION_DENIED", reason: "Internal server error", suggested_action: "regenerate proposal" }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
          );
        }

        const { data: profile } = await sbService.from("profiles").select("preferred_locale").eq("user_id", userId).maybeSingle();
        const sourceLang = profile?.preferred_locale || "en";

        const userClient = createClient(supabaseUrl, supabaseAnonKey, {
          global: { headers: { Authorization: authHeader } },
        });

        const result = await executeLegacyProposal(userClient, proposal!, userId, workspace_id, sourceLang);

        // Finalize or rollback reservation
        if (result.success && result.result && typeof result.result === "object") {
          const r = result.result as Record<string, string>;
          if (r.id) {
            await sbService.from("executed_proposals").update({ entity_id: r.id, entity_type: r.type || proposal!.type }).eq("proposal_id", proposal!.id);
          }
        } else {
          await sbService.from("executed_proposals").delete().eq("proposal_id", proposal!.id);
        }

        await sbService.from("audit_logs").insert({
          workspace_id,
          actor_user_id: userId,
          action: result.success ? "brain_execute_success" : "brain_execute_failure",
          entity_type: proposal!.type,
          entity_id: typeof result.result === "object" && result.result !== null ? (result.result as Record<string, string>).id || proposal!.id : proposal!.id,
          metadata: { proposal_id: proposal!.id, proposal_type: proposal!.type, proposal_title: proposal!.title, error: result.error || null },
        });

        if (!result.success) {
          return new Response(
            JSON.stringify({ code: "EXECUTION_DENIED", reason: result.error, suggested_action: "regenerate proposal" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
          );
        }

        return new Response(JSON.stringify({ success: true, result: result.result }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    return new Response(
      JSON.stringify({ error: 'Invalid request. Use action:"sign"|"execute" or mode:"dry_run"|"confirm"|"execute".' }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("brain-execute-action error:", error);
    return new Response(
      JSON.stringify({ code: "EXECUTION_DENIED", reason: "Internal server error", suggested_action: "regenerate proposal" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
