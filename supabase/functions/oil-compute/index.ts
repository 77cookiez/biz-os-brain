import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/**
 * OIL Compute — Pattern Mining + Indicator Computation + Memory Updates
 *
 * AUDIT RULES ENFORCED:
 * - No individual profiling (all analysis is org-level)
 * - Compute is throttled (min 6h between runs per workspace)
 * - AI calls are gated (min 5 events required)
 * - All indicator/memory changes are audit-logged
 * - Indicators are 2-tier: 3 Core + 2 Secondary
 *
 * GET ?workspace_id=xxx — Returns current indicators + active memory
 * POST { workspace_id, recompute: true } — Triggers full recomputation (throttled)
 */

interface ComputeRequest {
  workspace_id: string;
  recompute?: boolean;
}

/** Core indicators — always surfaced in briefs */
const CORE_INDICATOR_KEYS = [
  "ExecutionHealth",
  "DeliveryRisk",
  "GoalProgress",
];

/** Secondary indicators — shown in detail views only */
const SECONDARY_INDICATOR_KEYS = [
  "FinancialPressure",
  "TeamAlignment",
];

const ALL_INDICATOR_KEYS = [...CORE_INDICATOR_KEYS, ...SECONDARY_INDICATOR_KEYS];

/** Minimum hours between recompute runs per workspace */
const RECOMPUTE_COOLDOWN_HOURS = 6;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const apiKey = Deno.env.get("LOVABLE_API_KEY");
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    let workspaceId: string;
    let recompute = false;

    if (req.method === "GET") {
      const url = new URL(req.url);
      workspaceId = url.searchParams.get("workspace_id") || "";
    } else {
      const body = (await req.json()) as ComputeRequest;
      workspaceId = body.workspace_id;
      recompute = body.recompute || false;
    }

    if (!workspaceId) {
      return new Response(
        JSON.stringify({ error: "workspace_id is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let skippedRecompute = false;

    // If recompute requested, check cooldown first
    if (recompute && apiKey) {
      const canRun = await checkCooldown(supabase, workspaceId);
      if (canRun) {
        await computeIndicators(supabase, workspaceId, apiKey);
      } else {
        skippedRecompute = true;
      }
    }

    // Return current state with tier info
    const [{ data: indicators }, { data: memory }] = await Promise.all([
      supabase
        .from("org_indicators")
        .select("*")
        .eq("workspace_id", workspaceId)
        .order("indicator_key"),
      supabase
        .from("company_memory")
        .select("*")
        .eq("workspace_id", workspaceId)
        .eq("status", "active")
        .order("confidence", { ascending: false })
        .limit(20),
    ]);

    // Tag indicators with tier
    const taggedIndicators = (indicators || []).map(ind => ({
      ...ind,
      tier: CORE_INDICATOR_KEYS.includes(ind.indicator_key) ? "core" : "secondary",
    }));

    return new Response(
      JSON.stringify({
        indicators: taggedIndicators,
        memory: memory || [],
        last_computed: indicators?.[0]?.updated_at || null,
        skipped_recompute: skippedRecompute,
        cooldown_hours: RECOMPUTE_COOLDOWN_HOURS,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("oil-compute error:", error);
    return new Response(
      JSON.stringify({ error: "An error occurred processing your request" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

// ═══ Cooldown Check ═══

async function checkCooldown(
  supabase: ReturnType<typeof createClient>,
  workspaceId: string
): Promise<boolean> {
  const { data } = await supabase
    .from("org_indicators")
    .select("updated_at")
    .eq("workspace_id", workspaceId)
    .order("updated_at", { ascending: false })
    .limit(1);

  if (!data || data.length === 0) return true; // First run

  const lastUpdate = new Date(data[0].updated_at);
  const hoursSince = (Date.now() - lastUpdate.getTime()) / (1000 * 60 * 60);
  return hoursSince >= RECOMPUTE_COOLDOWN_HOURS;
}

// ═══ Audit Logger ═══

async function logAudit(
  supabase: ReturnType<typeof createClient>,
  workspaceId: string,
  action: string,
  metadata: Record<string, unknown>
) {
  try {
    await supabase.from("org_events").insert({
      workspace_id: workspaceId,
      event_type: `oil.${action}`,
      object_type: "oil_system",
      severity_hint: "info",
      metadata: {
        ...metadata,
        audit: true,
        computed_at: new Date().toISOString(),
      },
    });
  } catch (err) {
    console.warn("OIL audit log failed:", err);
  }
}

// ═══ Indicator Computation Pipeline ═══

async function computeIndicators(
  supabase: ReturnType<typeof createClient>,
  workspaceId: string,
  apiKey: string
) {
  // 1. Gather data from the last 14 days
  const twoWeeksAgo = new Date();
  twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);

  const [
    { data: events },
    { data: tasks },
    { data: goals },
  ] = await Promise.all([
    supabase
      .from("org_events")
      .select("event_type, object_type, severity_hint, created_at, metadata")
      .eq("workspace_id", workspaceId)
      .gte("created_at", twoWeeksAgo.toISOString())
      .order("created_at", { ascending: false })
      .limit(500),
    supabase
      .from("tasks")
      .select("id, status, is_priority, due_date, blocked_reason, created_at, completed_at")
      .eq("workspace_id", workspaceId)
      .in("status", ["backlog", "planned", "in_progress", "blocked", "done"]),
    supabase
      .from("goals")
      .select("id, status, due_date, kpi_current, kpi_target, created_at")
      .eq("workspace_id", workspaceId),
  ]);

  // NOTE: We intentionally do NOT select assigned_to, created_by, or any actor fields.
  // OIL operates at the organizational level only — no individual profiling.

  const allTasks = tasks || [];
  const allGoals = goals || [];
  const allEvents = events || [];

  // 2. Compute each indicator deterministically
  const indicators: Record<string, { score: number; trend: string; drivers: string[] }> = {};

  // ── ExecutionHealth (Core) ──
  const openTasks = allTasks.filter(t => t.status !== "done");
  const completedRecently = allTasks.filter(
    t => t.status === "done" && t.completed_at && new Date(t.completed_at) >= twoWeeksAgo
  );
  const blockedTasks = allTasks.filter(t => t.status === "blocked");
  const overdueTasks = openTasks.filter(
    t => t.due_date && new Date(t.due_date) < new Date()
  );

  const executionDrivers: string[] = [];
  let executionScore = 50;

  if (allTasks.length > 0) {
    const completionRate = completedRecently.length / Math.max(openTasks.length + completedRecently.length, 1);
    executionScore = Math.round(completionRate * 100);
    if (blockedTasks.length > 0) {
      executionScore = Math.max(executionScore - blockedTasks.length * 10, 0);
      executionDrivers.push(`${blockedTasks.length} tasks blocked`);
    }
    if (overdueTasks.length > 0) {
      executionScore = Math.max(executionScore - overdueTasks.length * 5, 0);
      executionDrivers.push(`${overdueTasks.length} tasks overdue`);
    }
    if (completedRecently.length > 0) {
      executionDrivers.push(`${completedRecently.length} tasks completed recently`);
    }
  }
  indicators.ExecutionHealth = {
    score: Math.min(executionScore, 100),
    trend: "stable",
    drivers: executionDrivers.slice(0, 3),
  };

  // ── DeliveryRisk (Core) ──
  const riskDrivers: string[] = [];
  let riskScore = 20;
  if (overdueTasks.length > 3) {
    riskScore += 30;
    riskDrivers.push(`${overdueTasks.length} overdue tasks`);
  }
  if (blockedTasks.length > 2) {
    riskScore += 25;
    riskDrivers.push(`${blockedTasks.length} blocked tasks`);
  }
  const rescheduleEvents = allEvents.filter(e => e.event_type === "task.rescheduled");
  if (rescheduleEvents.length > 5) {
    riskScore += 15;
    riskDrivers.push(`${rescheduleEvents.length} tasks rescheduled recently`);
  }
  indicators.DeliveryRisk = {
    score: Math.min(riskScore, 100),
    trend: "stable",
    drivers: riskDrivers.slice(0, 3),
  };

  // ── GoalProgress (Core) ──
  const goalDrivers: string[] = [];
  let goalScore = 50;
  const activeGoals = allGoals.filter(g => g.status === "active");
  if (activeGoals.length > 0) {
    const withKpi = activeGoals.filter(g => g.kpi_target && g.kpi_target > 0);
    if (withKpi.length > 0) {
      const avgProgress =
        withKpi.reduce((sum, g) => sum + ((g.kpi_current || 0) / g.kpi_target!) * 100, 0) /
        withKpi.length;
      goalScore = Math.round(avgProgress);
      goalDrivers.push(`${withKpi.length} goals with KPI tracking`);
    }
    const overdueGoals = activeGoals.filter(
      g => g.due_date && new Date(g.due_date) < new Date()
    );
    if (overdueGoals.length > 0) {
      goalScore = Math.max(goalScore - overdueGoals.length * 15, 0);
      goalDrivers.push(`${overdueGoals.length} goals past due date`);
    }
  } else {
    goalDrivers.push("No active goals defined");
  }
  indicators.GoalProgress = {
    score: Math.min(goalScore, 100),
    trend: "stable",
    drivers: goalDrivers.slice(0, 3),
  };

  // ── FinancialPressure (Secondary — placeholder) ──
  indicators.FinancialPressure = {
    score: 30,
    trend: "stable",
    drivers: ["Finance app not yet active — baseline score"],
  };

  // ── TeamAlignment (Secondary — placeholder) ──
  indicators.TeamAlignment = {
    score: 50,
    trend: "stable",
    drivers: ["Baseline — more data needed for accurate scoring"],
  };

  // 3. Determine trends by comparing to existing indicators
  const { data: existing } = await supabase
    .from("org_indicators")
    .select("indicator_key, score")
    .eq("workspace_id", workspaceId);

  const existingMap = new Map((existing || []).map(e => [e.indicator_key, e.score]));
  for (const [key, val] of Object.entries(indicators)) {
    const prev = existingMap.get(key);
    if (prev !== undefined) {
      if (val.score > prev + 5) val.trend = "up";
      else if (val.score < prev - 5) val.trend = "down";
    }
  }

  // 4. Upsert indicators + audit log changes
  for (const [key, val] of Object.entries(indicators)) {
    const prev = existingMap.get(key);
    await supabase.from("org_indicators").upsert(
      {
        workspace_id: workspaceId,
        indicator_key: key,
        score: val.score,
        trend: val.trend,
        drivers: val.drivers,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "workspace_id,indicator_key" }
    );

    // Audit: log every indicator change
    if (prev !== undefined && prev !== val.score) {
      await logAudit(supabase, workspaceId, "indicator_updated", {
        indicator_key: key,
        previous_score: prev,
        new_score: val.score,
        trend: val.trend,
        drivers: val.drivers,
      });
    }
  }

  // 5. Pattern Mining → company_memory via AI (gated: min 5 events)
  if (allEvents.length >= 5) {
    await minePatterns(supabase, workspaceId, allEvents, indicators, apiKey);
  }

  // 6. Audit log the compute run itself
  await logAudit(supabase, workspaceId, "compute_completed", {
    event_count: allEvents.length,
    task_count: allTasks.length,
    goal_count: allGoals.length,
    indicators_computed: Object.keys(indicators),
  });
}

// ═══ Pattern Mining Agent ═══

async function minePatterns(
  supabase: ReturnType<typeof createClient>,
  workspaceId: string,
  events: any[],
  indicators: Record<string, { score: number; trend: string; drivers: string[] }>,
  apiKey: string
) {
  // Build a factual summary for AI — NO actor/individual data
  const eventSummary = events.reduce((acc: Record<string, number>, e: any) => {
    acc[e.event_type] = (acc[e.event_type] || 0) + 1;
    return acc;
  }, {});

  const indicatorSummary = Object.entries(indicators)
    .map(([k, v]) => `${k}: ${v.score}/100 (${v.trend}) — ${v.drivers.join(", ")}`)
    .join("\n");

  const prompt = `You are an organizational intelligence analyst. Given the following event counts and indicator scores for a business workspace over the last 14 days, identify 1-3 organizational patterns or risks.

EVENT COUNTS:
${Object.entries(eventSummary).map(([k, v]) => `${k}: ${v}`).join("\n")}

INDICATORS:
${indicatorSummary}

CRITICAL RULES:
- Each pattern must be ORGANIZATIONAL-LEVEL only
- NEVER mention, reference, or imply any individual person, user, team member, or role holder
- Each must be a short, abstracted statement (1 sentence)
- Include a memory_type: PROCESS, RISK, FINANCE, OPERATIONS, or CULTURE
- Include confidence (0.0-1.0)
- Return ONLY a JSON array, no other text

Example output:
[
  {"memory_type": "PROCESS", "statement": "Tasks are frequently rescheduled before completion, suggesting estimation gaps.", "confidence": 0.7},
  {"memory_type": "RISK", "statement": "Blocked tasks accumulate without resolution within 5 days.", "confidence": 0.85}
]`;

  try {
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-lite",
        messages: [
          { role: "system", content: prompt },
          { role: "user", content: "Analyze and return patterns." },
        ],
      }),
    });

    if (!response.ok) return;

    const aiResult = await response.json();
    const rawContent = aiResult.choices?.[0]?.message?.content || "[]";

    let patterns: Array<{
      memory_type: string;
      statement: string;
      confidence: number;
    }>;

    try {
      const jsonMatch = rawContent.match(/\[[\s\S]*\]/);
      patterns = jsonMatch ? JSON.parse(jsonMatch[0]) : [];
    } catch {
      console.error("OIL: Failed to parse pattern mining result");
      return;
    }

    // Validate and sanitize: reject any pattern mentioning individuals
    const individualPatterns = /\b(user|person|employee|member|manager|he |she |his |her |their name)\b/i;

    for (const p of patterns) {
      if (!p.statement || !p.memory_type) continue;
      if (individualPatterns.test(p.statement)) {
        console.warn("OIL: Rejected pattern referencing individual:", p.statement);
        continue;
      }

      // Check if similar memory exists
      const { data: existing } = await supabase
        .from("company_memory")
        .select("id, statement")
        .eq("workspace_id", workspaceId)
        .eq("memory_type", p.memory_type)
        .eq("status", "active")
        .limit(10);

      const duplicate = existing?.find(
        (e) => e.statement.toLowerCase().includes(p.statement.toLowerCase().slice(0, 30))
      );

      if (duplicate) {
        const newConfidence = Math.min(p.confidence + 0.1, 1);
        await supabase
          .from("company_memory")
          .update({
            confidence: newConfidence,
            last_seen_at: new Date().toISOString(),
          })
          .eq("id", duplicate.id);

        await logAudit(supabase, workspaceId, "memory_reinforced", {
          memory_id: duplicate.id,
          memory_type: p.memory_type,
          new_confidence: newConfidence,
        });
      } else {
        const { data: inserted } = await supabase.from("company_memory").insert({
          workspace_id: workspaceId,
          memory_type: p.memory_type,
          statement: p.statement,
          confidence: p.confidence,
          evidence_refs: [],
        }).select("id").single();

        await logAudit(supabase, workspaceId, "memory_created", {
          memory_id: inserted?.id,
          memory_type: p.memory_type,
          confidence: p.confidence,
          statement_preview: p.statement.slice(0, 60),
        });
      }
    }
  } catch (error) {
    console.error("OIL pattern mining error:", error);
  }
}
