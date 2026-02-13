import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function computeRiskLevel(score: number): string {
  if (score <= 20) return "low";
  if (score <= 40) return "moderate";
  if (score <= 60) return "elevated";
  if (score <= 80) return "high";
  return "critical";
}

interface WorkspaceRiskResult {
  workspace_id: string;
  workspace_name: string;
  member_count: number;
  risks: Record<string, { score: number; level: string; drivers: any[] }>;
  snapshot_metrics: Record<string, number>;
}

async function computeWorkspaceRisk(
  adminClient: any,
  workspaceId: string,
  windowDays: number,
  now: Date
): Promise<WorkspaceRiskResult> {
  const windowAgo = new Date(
    now.getTime() - windowDays * 86400000
  ).toISOString();
  const stagnationDays = 5;
  const stagnationThreshold = new Date(
    now.getTime() - stagnationDays * 86400000
  );

  // Workspace name + member count
  const { data: wsData } = await adminClient
    .from("workspaces")
    .select("name")
    .eq("id", workspaceId)
    .single();
  const { count: memberCount } = await adminClient
    .from("workspace_members")
    .select("id", { count: "exact", head: true })
    .eq("workspace_id", workspaceId)
    .eq("invite_status", "accepted");

  // ===== EXECUTION RISK =====
  const { data: allTasks } = await adminClient
    .from("tasks")
    .select("id, status, due_date, assigned_to, updated_at, goal_id")
    .eq("workspace_id", workspaceId)
    .is("deleted_at", null);

  const tasks = allTasks || [];
  const totalTasks = tasks.length;
  const activeTasks = tasks.filter((t: any) => t.status !== "done");
  const overdueTasks = activeTasks.filter(
    (t: any) => t.due_date && new Date(t.due_date) < now
  );
  const unassignedTasks = activeTasks.filter((t: any) => !t.assigned_to);
  const stagnantTasks = activeTasks.filter(
    (t: any) => new Date(t.updated_at) < stagnationThreshold
  );

  const executionDrivers: any[] = [];
  let executionScore = 0;
  if (totalTasks > 0) {
    const overdueRate = overdueTasks.length / totalTasks;
    const unassignedRate = unassignedTasks.length / totalTasks;
    const stagnationRate = stagnantTasks.length / totalTasks;
    executionScore = Math.min(
      100,
      Math.round(overdueRate * 40 + unassignedRate * 30 + stagnationRate * 30)
    );
    if (overdueRate > 0.1)
      executionDrivers.push({
        factor: "overdue_tasks",
        value: overdueTasks.length,
        total: totalTasks,
        rate: Math.round(overdueRate * 100),
      });
    if (unassignedRate > 0.2)
      executionDrivers.push({
        factor: "unassigned_tasks",
        value: unassignedTasks.length,
        rate: Math.round(unassignedRate * 100),
      });
    if (stagnationRate > 0.15)
      executionDrivers.push({
        factor: "stagnant_tasks",
        value: stagnantTasks.length,
        rate: Math.round(stagnationRate * 100),
      });
  }

  // ===== ALIGNMENT RISK =====
  const { data: goals } = await adminClient
    .from("goals")
    .select("id")
    .eq("workspace_id", workspaceId)
    .is("deleted_at", null)
    .eq("status", "active");

  const { data: plans } = await adminClient
    .from("plans")
    .select("id, goal_id")
    .eq("workspace_id", workspaceId)
    .is("deleted_at", null);

  const goalIds = (goals || []).map((g: any) => g.id);
  const goalsWithPlans = new Set(
    (plans || []).filter((p: any) => p.goal_id).map((p: any) => p.goal_id)
  );
  const goalsWithoutPlans = goalIds.filter(
    (id: string) => !goalsWithPlans.has(id)
  );
  const tasksWithGoals = tasks.filter((t: any) => t.goal_id).length;
  const tasksWithoutGoals = Math.max(0, totalTasks - tasksWithGoals);

  const alignmentDrivers: any[] = [];
  let alignmentScore = 0;
  if (goalIds.length > 0) {
    const ratio = goalsWithoutPlans.length / goalIds.length;
    alignmentScore += Math.round(ratio * 50);
    if (ratio > 0.3)
      alignmentDrivers.push({
        factor: "goals_without_plans",
        value: goalsWithoutPlans.length,
        total: goalIds.length,
      });
  }
  if (totalTasks > 0) {
    const ratio = tasksWithoutGoals / totalTasks;
    alignmentScore += Math.round(ratio * 50);
    if (ratio > 0.5)
      alignmentDrivers.push({
        factor: "tasks_without_goals",
        value: tasksWithoutGoals,
        total: totalTasks,
      });
  }
  alignmentScore = Math.min(100, alignmentScore);

  // ===== ENGAGEMENT RISK =====
  const { count: recentEvents } = await adminClient
    .from("org_events")
    .select("id", { count: "exact", head: true })
    .eq("workspace_id", workspaceId)
    .gte("created_at", windowAgo);

  const { count: recentMessages } = await adminClient
    .from("chat_messages")
    .select("id", { count: "exact", head: true })
    .eq("workspace_id", workspaceId)
    .gte("created_at", windowAgo);

  const engagementDrivers: any[] = [];
  let engagementScore = 0;
  const evtCount = recentEvents || 0;
  const msgCount = recentMessages || 0;

  if (evtCount < 5) {
    engagementScore += 50;
    engagementDrivers.push({ factor: "low_org_events", value: evtCount });
  } else if (evtCount < 15) {
    engagementScore += 20;
  }
  if (msgCount < 3) {
    engagementScore += 50;
    engagementDrivers.push({ factor: "low_chat_activity", value: msgCount });
  } else if (msgCount < 10) {
    engagementScore += 20;
  }
  engagementScore = Math.min(100, engagementScore);

  // ===== GOVERNANCE RISK =====
  const { count: auditCount } = await adminClient
    .from("audit_logs")
    .select("id", { count: "exact", head: true })
    .eq("workspace_id", workspaceId)
    .gte("created_at", windowAgo);

  const { count: memberChanges } = await adminClient
    .from("audit_logs")
    .select("id", { count: "exact", head: true })
    .eq("workspace_id", workspaceId)
    .in("action", [
      "member_role_changed",
      "member_removed",
      "member_invited",
    ])
    .gte("created_at", windowAgo);

  const governanceDrivers: any[] = [];
  let governanceScore = 0;
  const adminActions = auditCount || 0;
  const roleChanges = memberChanges || 0;

  if (adminActions > 50) {
    governanceScore += 40;
    governanceDrivers.push({
      factor: "high_admin_activity",
      value: adminActions,
    });
  }
  if (roleChanges > 5) {
    governanceScore += 60;
    governanceDrivers.push({
      factor: "frequent_role_changes",
      value: roleChanges,
    });
  } else if (roleChanges > 2) {
    governanceScore += 30;
  }
  governanceScore = Math.min(100, governanceScore);

  return {
    workspace_id: workspaceId,
    workspace_name: wsData?.name || workspaceId,
    member_count: memberCount || 1,
    risks: {
      execution: {
        score: executionScore,
        level: computeRiskLevel(executionScore),
        drivers: executionDrivers,
      },
      alignment: {
        score: alignmentScore,
        level: computeRiskLevel(alignmentScore),
        drivers: alignmentDrivers,
      },
      engagement: {
        score: engagementScore,
        level: computeRiskLevel(engagementScore),
        drivers: engagementDrivers,
      },
      governance: {
        score: governanceScore,
        level: computeRiskLevel(governanceScore),
        drivers: governanceDrivers,
      },
    },
    snapshot_metrics: {
      total_tasks: totalTasks,
      overdue_tasks: overdueTasks.length,
      unassigned_tasks: unassignedTasks.length,
      stagnant_tasks: stagnantTasks.length,
      total_goals: goalIds.length,
      goals_without_plans: goalsWithoutPlans.length,
      org_events: evtCount,
      chat_messages: msgCount,
      audit_actions: adminActions,
      role_changes: roleChanges,
    },
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Auth
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } =
      await supabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = claimsData.claims.sub as string;

    const body = await req.json();
    const { company_id, window_days = 7 } = body;
    if (!company_id) {
      return new Response(
        JSON.stringify({ error: "company_id required" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Verify caller is owner/admin of company
    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: roleCheck } = await adminClient
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("company_id", company_id)
      .in("role", ["owner", "admin"])
      .limit(1);

    if (!roleCheck || roleCheck.length === 0) {
      return new Response(
        JSON.stringify({ error: "Forbidden: owner/admin role required" }),
        {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Get all workspaces in this company
    const { data: companyWorkspaces } = await adminClient
      .from("workspaces")
      .select("id, name")
      .eq("company_id", company_id);

    const workspaces = companyWorkspaces || [];
    const now = new Date();
    const today = now.toISOString().split("T")[0];
    const RISK_TYPES = ["execution", "alignment", "engagement", "governance"];

    // Compute per-workspace risks
    const wsResults: WorkspaceRiskResult[] = [];
    for (const ws of workspaces) {
      const result = await computeWorkspaceRisk(
        adminClient,
        ws.id,
        window_days,
        now
      );
      wsResults.push(result);

      // Upsert workspace_risk_scores
      for (const riskType of RISK_TYPES) {
        const r = result.risks[riskType];
        await adminClient.from("workspace_risk_scores").upsert(
          {
            company_id,
            workspace_id: ws.id,
            risk_type: riskType,
            risk_score: r.score,
            risk_level: r.level,
            computed_at: now.toISOString(),
            window_days,
            metadata: { drivers: r.drivers },
          },
          { onConflict: "workspace_id,risk_type" }
        );
      }

      // Upsert workspace snapshot
      await adminClient.from("risk_snapshots").upsert(
        {
          company_id,
          workspace_id: ws.id,
          snapshot_date: today,
          metrics: {
            ...result.snapshot_metrics,
            risks: Object.fromEntries(
              RISK_TYPES.map((t) => [t, result.risks[t].score])
            ),
          },
        },
        {
          onConflict: "company_id,workspace_id,snapshot_date",
          ignoreDuplicates: false,
        }
      );

      // Workspace-level forecasts
      for (const riskType of RISK_TYPES) {
        // Get history
        const { data: history } = await adminClient
          .from("risk_snapshots")
          .select("metrics, snapshot_date")
          .eq("workspace_id", ws.id)
          .order("snapshot_date", { ascending: true })
          .limit(30);

        const scores = (history || [])
          .map((h: any) => h.metrics?.risks?.[riskType])
          .filter((s: any) => s !== undefined);
        const currentScore = result.risks[riskType].score;

        let slope = 0;
        if (scores.length >= 2) {
          slope = (scores[scores.length - 1] - scores[0]) / scores.length;
        }

        const forecastPoints = Array.from({ length: 30 }, (_, d) => {
          const date = new Date(now.getTime() + (d + 1) * 86400000);
          return {
            date: date.toISOString().split("T")[0],
            score: Math.max(
              0,
              Math.min(100, Math.round(currentScore + slope * (d + 1)))
            ),
            confidence: Math.round(Math.max(10, 100 - (d + 1) * 2.5)),
          };
        });

        await adminClient.from("risk_forecasts").upsert(
          {
            company_id,
            workspace_id: ws.id,
            risk_type: riskType,
            horizon_days: 30,
            forecast: forecastPoints,
            model_meta: {
              method: "linear_slope",
              data_points: scores.length,
              slope,
            },
            computed_at: now.toISOString(),
          },
          {
            onConflict: "company_id,workspace_id,risk_type",
            ignoreDuplicates: false,
          }
        );
      }
    }

    // ===== COMPANY AGGREGATE =====
    // Weighted average by member count
    const totalMembers = wsResults.reduce(
      (sum, ws) => sum + ws.member_count,
      0
    );

    const companyRisks: Record<string, any> = {};
    for (const riskType of RISK_TYPES) {
      let weightedSum = 0;
      let worstWs = { name: "", score: 0 };
      const wsBreakdown: any[] = [];

      for (const ws of wsResults) {
        const r = ws.risks[riskType];
        const weight = totalMembers > 0 ? ws.member_count / totalMembers : 1 / wsResults.length;
        weightedSum += r.score * weight;
        wsBreakdown.push({
          workspace_id: ws.workspace_id,
          name: ws.workspace_name,
          score: r.score,
          level: r.level,
          weight: Math.round(weight * 100),
        });
        if (r.score > worstWs.score) {
          worstWs = { name: ws.workspace_name, score: r.score };
        }
      }

      const companyScore = Math.round(weightedSum);
      const companyLevel = computeRiskLevel(companyScore);

      companyRisks[riskType] = {
        score: companyScore,
        level: companyLevel,
        worst_workspace: worstWs,
        workspace_breakdown: wsBreakdown,
      };

      // Upsert company_risk_scores
      await adminClient.from("company_risk_scores").upsert(
        {
          company_id,
          risk_type: riskType,
          risk_score: companyScore,
          risk_level: companyLevel,
          computed_at: now.toISOString(),
          window_days,
          metadata: {
            worst_workspace: worstWs,
            workspace_breakdown: wsBreakdown,
            total_workspaces: workspaces.length,
            total_members: totalMembers,
          },
        },
        { onConflict: "company_id,risk_type" }
      );
    }

    // Company-level snapshot
    const companyMetrics: Record<string, number> = {};
    for (const key of Object.keys(wsResults[0]?.snapshot_metrics || {})) {
      companyMetrics[key] = wsResults.reduce(
        (sum, ws) => sum + (ws.snapshot_metrics[key] || 0),
        0
      );
    }
    companyMetrics.workspace_count = workspaces.length;
    companyMetrics.total_members = totalMembers;

    // Company snapshot (workspace_id = null) — use raw SQL approach via insert
    const { data: existingSnap } = await adminClient
      .from("risk_snapshots")
      .select("id")
      .eq("company_id", company_id)
      .is("workspace_id", null)
      .eq("snapshot_date", today)
      .limit(1);

    if (existingSnap && existingSnap.length > 0) {
      await adminClient
        .from("risk_snapshots")
        .update({
          metrics: {
            ...companyMetrics,
            risks: Object.fromEntries(
              RISK_TYPES.map((t) => [t, companyRisks[t].score])
            ),
          },
        })
        .eq("id", existingSnap[0].id);
    } else {
      await adminClient.from("risk_snapshots").insert({
        company_id,
        workspace_id: null,
        snapshot_date: today,
        metrics: {
          ...companyMetrics,
          risks: Object.fromEntries(
            RISK_TYPES.map((t) => [t, companyRisks[t].score])
          ),
        },
      });
    }

    // Company-level forecasts
    for (const riskType of RISK_TYPES) {
      const { data: history } = await adminClient
        .from("risk_snapshots")
        .select("metrics, snapshot_date")
        .eq("company_id", company_id)
        .is("workspace_id", null)
        .order("snapshot_date", { ascending: true })
        .limit(30);

      const scores = (history || [])
        .map((h: any) => h.metrics?.risks?.[riskType])
        .filter((s: any) => s !== undefined);
      const currentScore = companyRisks[riskType].score;

      let slope = 0;
      if (scores.length >= 2) {
        slope = (scores[scores.length - 1] - scores[0]) / scores.length;
      }

      const forecastPoints = Array.from({ length: 30 }, (_, d) => ({
        date: new Date(now.getTime() + (d + 1) * 86400000)
          .toISOString()
          .split("T")[0],
        score: Math.max(
          0,
          Math.min(100, Math.round(currentScore + slope * (d + 1)))
        ),
        confidence: Math.round(Math.max(10, 100 - (d + 1) * 2.5)),
      }));

      // Upsert company forecast
      const { data: existingFc } = await adminClient
        .from("risk_forecasts")
        .select("id")
        .eq("company_id", company_id)
        .is("workspace_id", null)
        .eq("risk_type", riskType)
        .limit(1);

      if (existingFc && existingFc.length > 0) {
        await adminClient
          .from("risk_forecasts")
          .update({
            forecast: forecastPoints,
            model_meta: {
              method: "linear_slope",
              data_points: scores.length,
              slope,
            },
            computed_at: now.toISOString(),
          })
          .eq("id", existingFc[0].id);
      } else {
        await adminClient.from("risk_forecasts").insert({
          company_id,
          workspace_id: null,
          risk_type: riskType,
          horizon_days: 30,
          forecast: forecastPoints,
          model_meta: {
            method: "linear_slope",
            data_points: scores.length,
            slope,
          },
          computed_at: now.toISOString(),
        });
      }
    }

    // Audit log
    await adminClient.from("audit_logs").insert({
      workspace_id: workspaces[0]?.id || company_id,
      actor_user_id: userId,
      action: "risk.compute",
      entity_type: "company",
      entity_id: company_id,
      metadata: {
        risk_types: RISK_TYPES,
        window_days,
        workspaces_computed: workspaces.length,
      },
    });

    return new Response(
      JSON.stringify({
        success: true,
        computed_at: now.toISOString(),
        company: companyRisks,
        workspaces: wsResults.map((ws) => ({
          workspace_id: ws.workspace_id,
          name: ws.workspace_name,
          member_count: ws.member_count,
          risks: ws.risks,
        })),
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (err) {
    console.error("enterprise-risk-compute error:", err);
    return new Response(
      JSON.stringify({ error: (err as Error).message || "Internal error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
