import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ─── HMAC Utilities ───
const SIGNING_SECRET = () => Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const PROPOSAL_TTL_MS = 10 * 60 * 1000; // 10 minutes

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

// ─── Types ───
interface Proposal {
  id: string;
  type: "task" | "goal" | "plan" | "idea" | "update";
  title: string;
  payload: Record<string, unknown>;
  required_role: "member" | "admin" | "owner";
  confirmation_hash?: string;
  expires_at?: number;
}

interface SignRequest {
  action: "sign";
  proposals: Proposal[];
  workspace_id: string;
}

interface ExecuteRequest {
  action: "execute";
  proposal: Proposal;
  workspace_id: string;
}

type RequestBody = SignRequest | ExecuteRequest;

// ─── Role Check Helpers ───
async function getUserWorkspaceRole(
  sb: ReturnType<typeof createClient>,
  userId: string,
  workspaceId: string,
): Promise<"owner" | "admin" | "member" | null> {
  // Check workspace membership
  const { data: member } = await sb
    .from("workspace_members")
    .select("team_role")
    .eq("workspace_id", workspaceId)
    .eq("user_id", userId)
    .in("invite_status", ["active", "accepted"])
    .maybeSingle();

  if (!member) return null;

  // Check company role for owner/admin
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
  if (companyRole?.role === "admin") return "admin";
  return "member";
}

function hasRequiredRole(
  userRole: "owner" | "admin" | "member",
  requiredRole: "owner" | "admin" | "member",
): boolean {
  const hierarchy = { owner: 3, admin: 2, member: 1 };
  return hierarchy[userRole] >= hierarchy[requiredRole];
}

// ─── Execution Logic ───
async function executeProposal(
  sb: ReturnType<typeof createClient>,
  proposal: Proposal,
  userId: string,
  workspaceId: string,
  sourceLang: string,
): Promise<{ success: boolean; result?: unknown; error?: string }> {
  // Step 1: Create meaning object (Meaning-First enforcement)
  const meaningJson = {
    version: "v1",
    type: proposal.type.toLowerCase(),
    intent: proposal.type === "update" ? "update" : "create",
    subject: proposal.title,
    description: (proposal.payload.description as string) || "",
    constraints: {},
    metadata: {
      created_from: "brain_execution",
      proposal_id: proposal.id,
      confidence: 0.9,
    },
  };

  const { data: meaningObj, error: meaningErr } = await sb
    .from("meaning_objects")
    .insert({
      workspace_id: workspaceId,
      created_by: userId,
      type: proposal.type.toLowerCase(),
      source_lang: sourceLang,
      meaning_json: meaningJson,
    })
    .select("id")
    .single();

  if (meaningErr || !meaningObj) {
    return { success: false, error: `Failed to create meaning object: ${meaningErr?.message}` };
  }

  const meaningObjectId = meaningObj.id;

  // Step 2: Execute based on type
  switch (proposal.type) {
    case "task": {
      const { data, error } = await sb
        .from("tasks")
        .insert({
          workspace_id: workspaceId,
          created_by: userId,
          title: proposal.title,
          description: (proposal.payload.description as string) || null,
          status: (proposal.payload.status as string) || "backlog",
          due_date: (proposal.payload.due_date as string) || null,
          is_priority: (proposal.payload.is_priority as boolean) || false,
          goal_id: (proposal.payload.goal_id as string) || null,
          meaning_object_id: meaningObjectId,
          source_lang: sourceLang,
        })
        .select("id")
        .single();
      if (error) return { success: false, error: error.message };
      return { success: true, result: { type: "task", id: data.id } };
    }

    case "goal": {
      const { data, error } = await sb
        .from("goals")
        .insert({
          workspace_id: workspaceId,
          created_by: userId,
          title: proposal.title,
          description: (proposal.payload.description as string) || null,
          status: "active",
          due_date: (proposal.payload.due_date as string) || null,
          kpi_name: (proposal.payload.kpi_name as string) || null,
          kpi_target: (proposal.payload.kpi_target as number) || null,
          meaning_object_id: meaningObjectId,
          source_lang: sourceLang,
        })
        .select("id")
        .single();
      if (error) return { success: false, error: error.message };
      return { success: true, result: { type: "goal", id: data.id } };
    }

    case "plan": {
      const { data, error } = await sb
        .from("plans")
        .insert({
          workspace_id: workspaceId,
          created_by: userId,
          title: proposal.title,
          description: (proposal.payload.description as string) || null,
          plan_type: (proposal.payload.plan_type as string) || "custom",
          goal_id: (proposal.payload.goal_id as string) || null,
          ai_generated: true,
          meaning_object_id: meaningObjectId,
          source_lang: sourceLang,
        })
        .select("id")
        .single();
      if (error) return { success: false, error: error.message };
      return { success: true, result: { type: "plan", id: data.id } };
    }

    case "idea": {
      const { data, error } = await sb
        .from("ideas")
        .insert({
          workspace_id: workspaceId,
          created_by: userId,
          title: proposal.title,
          description: (proposal.payload.description as string) || null,
          source: "brain",
          meaning_object_id: meaningObjectId,
          source_lang: sourceLang,
        })
        .select("id")
        .single();
      if (error) return { success: false, error: error.message };
      return { success: true, result: { type: "idea", id: data.id } };
    }

    case "update": {
      const entityType = proposal.payload.entity_type as string;
      const entityId = proposal.payload.entity_id as string;
      const updates = proposal.payload.updates as Record<string, unknown>;

      if (!entityType || !entityId || !updates) {
        return { success: false, error: "Update requires entity_type, entity_id, and updates" };
      }

      // Only allow updating known tables
      const allowedTables = ["tasks", "goals", "plans", "ideas"];
      if (!allowedTables.includes(entityType)) {
        return { success: false, error: `Cannot update entity type: ${entityType}` };
      }

      // Whitelist allowed update fields per table
      const allowedFields: Record<string, string[]> = {
        tasks: ["title", "description", "status", "due_date", "is_priority", "assigned_to", "blocked_reason"],
        goals: ["title", "description", "status", "due_date", "kpi_current"],
        plans: ["title", "description"],
        ideas: ["title", "description", "status"],
      };

      const safeUpdates: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(updates)) {
        if (allowedFields[entityType]?.includes(k)) {
          safeUpdates[k] = v;
        }
      }

      if (Object.keys(safeUpdates).length === 0) {
        return { success: false, error: "No valid fields to update" };
      }

      const { error } = await sb
        .from(entityType)
        .update(safeUpdates)
        .eq("id", entityId)
        .eq("workspace_id", workspaceId);

      if (error) return { success: false, error: error.message };
      return { success: true, result: { type: "update", entity_type: entityType, id: entityId } };
    }

    default:
      return { success: false, error: `Unknown proposal type: ${proposal.type}` };
  }
}

// ─── Main Handler ───
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // ─── Auth ───
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ code: "EXECUTION_DENIED", reason: "Missing authorization", suggested_action: "login" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Auth client for user verification
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

    const userId = user.id;

    // Service client for DB operations (bypasses RLS for execution)
    const sbService = createClient(supabaseUrl, serviceKey);

    const body = (await req.json()) as RequestBody;

    if (!body.workspace_id) {
      return new Response(
        JSON.stringify({ code: "EXECUTION_DENIED", reason: "Missing workspace_id", suggested_action: "regenerate proposal" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const hmacKey = await getHmacKey();

    // ─── ACTION: SIGN ───
    if (body.action === "sign") {
      const { proposals, workspace_id } = body as SignRequest;

      if (!Array.isArray(proposals) || proposals.length === 0 || proposals.length > 20) {
        return new Response(
          JSON.stringify({ error: "proposals must be 1-20 items" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      // Verify user is workspace member
      const role = await getUserWorkspaceRole(sbService, userId, workspace_id);
      if (!role) {
        return new Response(
          JSON.stringify({ code: "EXECUTION_DENIED", reason: "Not a workspace member", suggested_action: "request elevated permission" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      const expiresAt = Date.now() + PROPOSAL_TTL_MS;
      const signedProposals: Proposal[] = [];

      for (const p of proposals) {
        const proposalId = p.id || crypto.randomUUID();
        const hash = await signProposal(hmacKey, {
          userId,
          workspaceId: workspace_id,
          proposalId,
          expiresAt,
        });

        signedProposals.push({
          ...p,
          id: proposalId,
          confirmation_hash: hash,
          expires_at: expiresAt,
        });
      }

      return new Response(JSON.stringify({ proposals: signedProposals }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ─── ACTION: EXECUTE ───
    if (body.action === "execute") {
      const { proposal, workspace_id } = body as ExecuteRequest;

      if (!proposal || !proposal.id || !proposal.confirmation_hash || !proposal.expires_at) {
        return new Response(
          JSON.stringify({ code: "EXECUTION_DENIED", reason: "Invalid proposal structure", suggested_action: "regenerate proposal" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      // 1. Check expiration
      if (Date.now() > proposal.expires_at) {
        return new Response(
          JSON.stringify({ code: "EXECUTION_DENIED", reason: "Proposal expired", suggested_action: "regenerate proposal" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      // 2. Verify HMAC hash
      const isValid = await verifyProposal(
        hmacKey,
        { userId, workspaceId: workspace_id, proposalId: proposal.id, expiresAt: proposal.expires_at },
        proposal.confirmation_hash,
      );

      if (!isValid) {
        return new Response(
          JSON.stringify({ code: "EXECUTION_DENIED", reason: "Hash mismatch — proposal tampered or user changed", suggested_action: "regenerate proposal" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      // 3. Check role
      const userRole = await getUserWorkspaceRole(sbService, userId, workspace_id);
      if (!userRole) {
        return new Response(
          JSON.stringify({ code: "EXECUTION_DENIED", reason: "Not a workspace member", suggested_action: "request elevated permission" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      const requiredRole = proposal.required_role || "member";
      if (!hasRequiredRole(userRole, requiredRole)) {
        return new Response(
          JSON.stringify({
            code: "EXECUTION_DENIED",
            reason: `Requires ${requiredRole} role, you have ${userRole}`,
            suggested_action: "request elevated permission",
          }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      // 4. Reservation-first idempotency — PK lock BEFORE execution
      const { error: reserveErr } = await sbService.from("executed_proposals").insert({
        proposal_id: proposal.id,
        workspace_id: workspace_id,
        entity_type: proposal.type,
        entity_id: "",  // placeholder until execution succeeds
      });

      if (reserveErr) {
        // Duplicate PK = already executed; any other error = server failure
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

      // 5. Determine source language from user profile
      const { data: profile } = await sbService
        .from("profiles")
        .select("preferred_locale")
        .eq("user_id", userId)
        .maybeSingle();
      const sourceLang = profile?.preferred_locale || "en";

      // 6. Execute with user-scoped client (RLS enforced)
      const userClient = createClient(supabaseUrl, supabaseAnonKey, {
        global: { headers: { Authorization: authHeader } },
      });

      const result = await executeProposal(userClient, proposal, userId, workspace_id, sourceLang);

      // 7. Finalize or rollback reservation
      if (result.success && result.result && typeof result.result === "object") {
        const r = result.result as Record<string, string>;
        const entityId = String(r.id || "");
        // Update placeholder with real entity_id
        await sbService.from("executed_proposals")
          .update({ entity_id: entityId, entity_type: r.type || proposal.type })
          .eq("proposal_id", proposal.id)
          .then(() => {}, (e: Error) => console.warn("[brain-execute] reservation update warning:", e.message));
      } else {
        // Execution failed — remove reservation so user can retry
        await sbService.from("executed_proposals")
          .delete()
          .eq("proposal_id", proposal.id)
          .then(() => {}, (e: Error) => console.warn("[brain-execute] reservation cleanup warning:", e.message));
      }

      await sbService.from("audit_logs").insert({
        workspace_id,
        actor_user_id: userId,
        action: result.success ? "brain_execute_success" : "brain_execute_failure",
        entity_type: proposal.type,
        entity_id: typeof result.result === "object" && result.result !== null ? (result.result as Record<string, string>).id || proposal.id : proposal.id,
        metadata: {
          proposal_id: proposal.id,
          proposal_type: proposal.type,
          proposal_title: proposal.title,
          error: result.error || null,
        },
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

    return new Response(
      JSON.stringify({ error: 'Invalid action. Use "sign" or "execute".' }),
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
