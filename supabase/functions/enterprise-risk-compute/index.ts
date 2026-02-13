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
    const userId = claimsData.claims.sub;

    const { workspace_id } = await req.json();
    if (!workspace_id) {
      return new Response(
        JSON.stringify({ error: "workspace_id required" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Verify membership
    const { data: memberCheck } = await supabase.rpc("is_workspace_member", {
      _user_id: userId,
      _workspace_id: workspace_id,
    });
    if (!memberCheck) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Use service role for writes
    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 86400000).toISOString();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 86400000).toISOString();

    // ========== EXECUTION RISK ==========
    const { data: allTasks } = await adminClient
      .from("tasks")
      .select("id, status, due_date, assigned_to, updated_at")
      .eq("workspace_id", workspace_id)
      .is("deleted_at", null);

    const tasks = allTasks || [];
    const totalTasks = tasks.length;
    const overdueTasks = tasks.filter(
      (t) => t.due_date && new Date(t.due_date) < now && t.status !== "done"
    ).length;
    const unassignedTasks = tasks.filter(
      (t) => !t.assigned_to && t.status !== "done"
    ).length;
    const stagnantTasks = tasks.filter(
      (t) =>
        t.status !== "done" &&
        new Date(t.updated_at) < new Date(now.getTime() - 5 * 86400000)
    ).length;

    const executionDrivers = [];
    let executionScore = 0;
    if (totalTasks > 0) {
      const overdueRatio = overdueTasks / totalTasks;
      const unassignedRatio = unassignedTasks / totalTasks;
      const stagnantRatio = stagnantTasks / totalTasks;
      executionScore = Math.min(
        100,
        Math.round(overdueRatio * 40 + unassignedRatio * 30 + stagnantRatio * 30)
      );
      if (overdueRatio > 0.1)
        executionDrivers.push({
          factor: "overdue_tasks",
          value: overdueTasks,
          ratio: overdueRatio,
        });
      if (unassignedRatio > 0.2)
        executionDrivers.push({
          factor: "unassigned_tasks",
          value: unassignedTasks,
          ratio: unassignedRatio,
        });
      if (stagnantRatio > 0.15)
        executionDrivers.push({
          factor: "stagnant_tasks",
          value: stagnantTasks,
          ratio: stagnantRatio,
        });
    }

    // ========== ALIGNMENT RISK ==========
    const { data: goals } = await adminClient
      .from("goals")
      .select("id")
      .eq("workspace_id", workspace_id)
      .is("deleted_at", null)
      .eq("status", "active");

    const { data: plans } = await adminClient
      .from("plans")
      .select("id, goal_id")
      .eq("workspace_id", workspace_id)
      .is("deleted_at", null);

    const goalIds = (goals || []).map((g) => g.id);
    const goalsWithPlans = new Set(
      (plans || []).filter((p) => p.goal_id).map((p) => p.goal_id)
    );
    const goalsWithoutPlans = goalIds.filter((id) => !goalsWithPlans.has(id));

    const tasksWithGoals = tasks.filter((t: any) => t.goal_id).length;
    const tasksWithoutGoals = totalTasks > 0 ? totalTasks - tasksWithGoals : 0;

    const alignmentDrivers = [];
    let alignmentScore = 0;
    if (goalIds.length > 0) {
      const unlinkedGoalRatio = goalsWithoutPlans.length / goalIds.length;
      alignmentScore += Math.round(unlinkedGoalRatio * 50);
      if (unlinkedGoalRatio > 0.3)
        alignmentDrivers.push({
          factor: "goals_without_plans",
          value: goalsWithoutPlans.length,
        });
    }
    if (totalTasks > 0) {
      const unlinkedTaskRatio = tasksWithoutGoals / totalTasks;
      alignmentScore += Math.round(unlinkedTaskRatio * 50);
      if (unlinkedTaskRatio > 0.5)
        alignmentDrivers.push({
          factor: "tasks_without_goals",
          value: tasksWithoutGoals,
        });
    }
    alignmentScore = Math.min(100, alignmentScore);

    // ========== ENGAGEMENT RISK ==========
    const { count: recentEvents } = await adminClient
      .from("org_events")
      .select("id", { count: "exact", head: true })
      .eq("workspace_id", workspace_id)
      .gte("created_at", sevenDaysAgo);

    const { count: recentMessages } = await adminClient
      .from("chat_messages")
      .select("id", { count: "exact", head: true })
      .eq("workspace_id", workspace_id)
      .gte("created_at", sevenDaysAgo);

    const engagementDrivers = [];
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

    // ========== GOVERNANCE RISK ==========
    const { count: auditCount } = await adminClient
      .from("audit_logs")
      .select("id", { count: "exact", head: true })
      .eq("workspace_id", workspace_id)
      .gte("created_at", sevenDaysAgo);

    const { count: memberChanges } = await adminClient
      .from("audit_logs")
      .select("id", { count: "exact", head: true })
      .eq("workspace_id", workspace_id)
      .in("action", [
        "member_role_changed",
        "member_removed",
        "member_invited",
      ])
      .gte("created_at", sevenDaysAgo);

    const governanceDrivers = [];
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

    // ========== UPSERT SCORES ==========
    const riskResults = [
      {
        risk_type: "execution",
        risk_score: executionScore,
        drivers: executionDrivers,
      },
      {
        risk_type: "alignment",
        risk_score: alignmentScore,
        drivers: alignmentDrivers,
      },
      {
        risk_type: "engagement",
        risk_score: engagementScore,
        drivers: engagementDrivers,
      },
      {
        risk_type: "governance",
        risk_score: governanceScore,
        drivers: governanceDrivers,
      },
    ];

    const today = now.toISOString().split("T")[0];

    for (const r of riskResults) {
      const level = computeRiskLevel(r.risk_score);

      // Upsert current score
      await adminClient.from("enterprise_risk_scores").upsert(
        {
          workspace_id,
          risk_type: r.risk_type,
          risk_score: r.risk_score,
          risk_level: level,
          drivers: r.drivers,
          computed_at: now.toISOString(),
        },
        { onConflict: "workspace_id,risk_type" }
      );

      // Insert daily snapshot
      await adminClient.from("risk_snapshots").upsert(
        {
          workspace_id,
          risk_type: r.risk_type,
          risk_score: r.risk_score,
          risk_level: level,
          snapshot_date: today,
        },
        { onConflict: "workspace_id,risk_type,snapshot_date" }
      );

      // Simple linear forecast (last 7 snapshots → next 30 days)
      const { data: history } = await adminClient
        .from("risk_snapshots")
        .select("risk_score, snapshot_date")
        .eq("workspace_id", workspace_id)
        .eq("risk_type", r.risk_type)
        .order("snapshot_date", { ascending: true })
        .limit(30);

      const hist = history || [];
      // Calculate trend slope
      let slope = 0;
      if (hist.length >= 2) {
        const first = hist[0].risk_score;
        const last = hist[hist.length - 1].risk_score;
        slope = (last - first) / hist.length;
      }

      // Generate 30-day forecast
      for (let d = 1; d <= 30; d++) {
        const forecastDate = new Date(now.getTime() + d * 86400000);
        const predicted = Math.max(
          0,
          Math.min(100, Math.round(r.risk_score + slope * d))
        );
        const confidence = Math.max(0.1, 1 - d * 0.025); // decreasing confidence

        await adminClient.from("risk_forecasts").upsert(
          {
            workspace_id,
            risk_type: r.risk_type,
            forecast_date: forecastDate.toISOString().split("T")[0],
            predicted_score: predicted,
            confidence: Math.round(confidence * 100) / 100,
          },
          { onConflict: "workspace_id,risk_type,forecast_date" }
        );
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        computed_at: now.toISOString(),
        risks: riskResults.map((r) => ({
          ...r,
          risk_level: computeRiskLevel(r.risk_score),
        })),
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (err) {
    console.error("enterprise-risk-compute error:", err);
    return new Response(
      JSON.stringify({ error: err.message || "Internal error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
