import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/**
 * Decision Signal Types:
 * - repeated_blocker: same task blocked > 2 times (by checking blocked_reason changes)
 * - stale_discussed: tasks with chat origin but not completed
 * - dormant_goal: goals created but no linked tasks have progress
 * - work_imbalance: many tasks created vs few completed
 * - chat_without_followup: decisions from chat with no task progress
 */

interface DecisionSignal {
  id: string;
  signal_type: string;
  explanation_data: Record<string, any>; // factual data for Brain to narrate
  context_refs: { task_ids?: string[]; goal_ids?: string[]; thread_ids?: string[] };
  confidence_level: "low" | "medium" | "high";
}

function isFromChat(mj: any): boolean {
  if (!mj || typeof mj !== "object") return false;
  if (mj.links?.from_message_id) return true;
  if (mj.metadata?.source === "chat") return true;
  if (mj.metadata?.source_message_id) return true;
  return false;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { workspace_id, content_locale } = await req.json();

    if (!workspace_id) {
      return new Response(JSON.stringify({ error: "workspace_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const now = new Date();
    const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000).toISOString();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const staleDays = 5;
    const staleThreshold = new Date(now.getTime() - staleDays * 24 * 60 * 60 * 1000).toISOString();

    // Batch queries
    const [
      allOpenTasksRes,
      completedRecentRes,
      createdRecentRes,
      blockedTasksRes,
      goalsRes,
      taskMeaningsRes,
    ] = await Promise.all([
      // All open tasks
      supabase
        .from("tasks")
        .select("id, title, status, blocked_reason, updated_at, created_at, meaning_object_id, goal_id")
        .eq("workspace_id", workspace_id)
        .in("status", ["backlog", "planned", "in_progress", "blocked"])
        .limit(200),

      // Tasks completed in last 14 days
      supabase
        .from("tasks")
        .select("id", { count: "exact", head: true })
        .eq("workspace_id", workspace_id)
        .eq("status", "done")
        .gte("completed_at", fourteenDaysAgo),

      // Tasks created in last 14 days
      supabase
        .from("tasks")
        .select("id", { count: "exact", head: true })
        .eq("workspace_id", workspace_id)
        .gte("created_at", fourteenDaysAgo),

      // Currently blocked tasks
      supabase
        .from("tasks")
        .select("id, title, status, blocked_reason, updated_at, meaning_object_id")
        .eq("workspace_id", workspace_id)
        .eq("status", "blocked")
        .limit(50),

      // All active goals
      supabase
        .from("goals")
        .select("id, title, status, created_at, meaning_object_id")
        .eq("workspace_id", workspace_id)
        .eq("status", "active")
        .limit(50),

      // Task meaning objects for chat origin detection
      supabase
        .from("meaning_objects")
        .select("id, meaning_json")
        .eq("workspace_id", workspace_id)
        .eq("type", "task")
        .gte("created_at", fourteenDaysAgo)
        .limit(200),
    ]);

    const openTasks = allOpenTasksRes.data || [];
    const blockedTasks = blockedTasksRes.data || [];
    const goals = goalsRes.data || [];
    const taskMeanings = taskMeaningsRes.data || [];
    const createdCount = createdRecentRes.count || 0;
    const completedCount = completedRecentRes.count || 0;

    // Build chat-origin task ID set
    const chatTaskMeaningIds = new Set(
      taskMeanings.filter((m: any) => isFromChat(m.meaning_json)).map((m: any) => m.id)
    );

    const signals: DecisionSignal[] = [];
    let signalIdx = 0;

    // ─── Signal 1: Repeated Blockers ───
    // Tasks blocked for > 6 days
    const longBlockedTasks = blockedTasks.filter((t: any) => {
      const blockedDays = Math.floor(
        (now.getTime() - new Date(t.updated_at).getTime()) / (1000 * 60 * 60 * 24)
      );
      return blockedDays >= 6;
    });

    for (const task of longBlockedTasks.slice(0, 2)) {
      const blockedDays = Math.floor(
        (now.getTime() - new Date(task.updated_at).getTime()) / (1000 * 60 * 60 * 24)
      );
      signals.push({
        id: `sig_${++signalIdx}`,
        signal_type: "repeated_blocker",
        explanation_data: {
          task_id: task.id,
          task_title: task.title,
          meaning_object_id: task.meaning_object_id,
          blocked_days: blockedDays,
          blocked_reason: task.blocked_reason,
        },
        context_refs: { task_ids: [task.id] },
        confidence_level: blockedDays >= 10 ? "high" : "medium",
      });
    }

    // ─── Signal 2: Stale Discussed Tasks ───
    // Tasks that came from chat but haven't progressed
    const chatOriginOpenTasks = openTasks.filter(
      (t: any) => t.meaning_object_id && chatTaskMeaningIds.has(t.meaning_object_id)
    );
    const staleChatTasks = chatOriginOpenTasks.filter((t: any) => {
      return new Date(t.updated_at) < new Date(staleThreshold);
    });

    if (staleChatTasks.length > 0) {
      signals.push({
        id: `sig_${++signalIdx}`,
        signal_type: "stale_discussed",
        explanation_data: {
          count: staleChatTasks.length,
          tasks: staleChatTasks.slice(0, 3).map((t: any) => ({
            task_id: t.id,
            title: t.title,
            meaning_object_id: t.meaning_object_id,
            days_inactive: Math.floor(
              (now.getTime() - new Date(t.updated_at).getTime()) / (1000 * 60 * 60 * 24)
            ),
          })),
        },
        context_refs: { task_ids: staleChatTasks.slice(0, 3).map((t: any) => t.id) },
        confidence_level: staleChatTasks.length >= 3 ? "high" : "medium",
      });
    }

    // ─── Signal 3: Dormant Goals ───
    // Goals with no linked tasks that have made progress
    for (const goal of goals.slice(0, 10)) {
      const linkedTasks = openTasks.filter((t: any) => t.goal_id === goal.id);
      const goalAge = Math.floor(
        (now.getTime() - new Date(goal.created_at).getTime()) / (1000 * 60 * 60 * 24)
      );

      // Only flag if goal is old enough and has zero linked tasks or all are stale
      if (goalAge >= 7) {
        const hasProgress = linkedTasks.some(
          (t: any) => t.status === "in_progress" || t.status === "done"
        );

        if (linkedTasks.length === 0 || !hasProgress) {
          signals.push({
            id: `sig_${++signalIdx}`,
            signal_type: "dormant_goal",
            explanation_data: {
              goal_id: goal.id,
              goal_title: goal.title,
              meaning_object_id: goal.meaning_object_id,
              days_since_created: goalAge,
              linked_tasks_count: linkedTasks.length,
            },
            context_refs: { goal_ids: [goal.id] },
            confidence_level: goalAge >= 14 ? "high" : linkedTasks.length === 0 ? "medium" : "low",
          });
        }
      }
    }

    // ─── Signal 4: Work Imbalance ───
    // Many tasks created but few completed (ratio < 0.3 over 14 days)
    if (createdCount >= 5 && completedCount / createdCount < 0.3) {
      signals.push({
        id: `sig_${++signalIdx}`,
        signal_type: "work_imbalance",
        explanation_data: {
          tasks_created_14d: createdCount,
          tasks_completed_14d: completedCount,
          completion_ratio: Math.round((completedCount / createdCount) * 100),
        },
        context_refs: {},
        confidence_level: completedCount / createdCount < 0.15 ? "high" : "medium",
      });
    }

    // ─── Generate explanations via Brain (optional, bounded) ───
    let suggestions: any[] = [];
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const targetLang = content_locale || "en";

    if (signals.length > 0 && LOVABLE_API_KEY) {
      // Cap at 3 suggestions
      const topSignals = signals.slice(0, 3);

      const signalDescriptions = topSignals.map((s) => {
        switch (s.signal_type) {
          case "repeated_blocker":
            return `A task "${s.explanation_data.task_title}" has been blocked for ${s.explanation_data.blocked_days} days.${s.explanation_data.blocked_reason ? ` Reason: ${s.explanation_data.blocked_reason}` : ""}`;
          case "stale_discussed":
            return `${s.explanation_data.count} task(s) that emerged from team conversations have had no activity for 5+ days.`;
          case "dormant_goal":
            return `A goal "${s.explanation_data.goal_title}" was created ${s.explanation_data.days_since_created} days ago but has ${s.explanation_data.linked_tasks_count === 0 ? "no linked tasks" : "no task progress"}.`;
          case "work_imbalance":
            return `In the last 14 days, ${s.explanation_data.tasks_created_14d} tasks were created but only ${s.explanation_data.tasks_completed_14d} completed (${s.explanation_data.completion_ratio}% completion rate).`;
          default:
            return "";
        }
      });

      try {
        const brainResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${LOVABLE_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash-lite",
            messages: [
              {
                role: "system",
                content: `You explain patterns and observations. You do not instruct or act.

Given the following data observations, produce a JSON array of suggestions. Each suggestion must have:
- "title": a short, gentle observation (5-10 words). Never say "You should" or "Fix this".
- "explanation": 1-2 sentences explaining WHY this pattern exists based only on the data. Be supportive, not evaluative.

Rules:
- Write ALL text in ${targetLang}
- Do NOT give advice or action items
- Do NOT assign blame or rank people
- Do NOT use pressure language (urgent, critical, must, should)
- Be warm and supportive
- Output ONLY valid JSON array, nothing else

Observations:
${signalDescriptions.map((d, i) => `${i + 1}. ${d}`).join("\n")}`,
              },
              {
                role: "user",
                content: "Generate the suggestions array.",
              },
            ],
            stream: false,
          }),
        });

        if (brainResp.ok) {
          const brainData = await brainResp.json();
          const content = brainData.choices?.[0]?.message?.content?.trim() || "";
          // Extract JSON from response (may be wrapped in code blocks)
          const jsonMatch = content.match(/\[[\s\S]*\]/);
          if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[0]);
            suggestions = topSignals.map((signal, i) => ({
              id: signal.id,
              signal_type: signal.signal_type,
              title: parsed[i]?.title || "",
              explanation: parsed[i]?.explanation || "",
              confidence_level: signal.confidence_level,
              context_refs: signal.context_refs,
            }));
          }
        }
      } catch (e) {
        console.error("Brain explanation generation failed:", e);
        // Fallback: return signals without AI explanation
        suggestions = topSignals.map((signal) => ({
          id: signal.id,
          signal_type: signal.signal_type,
          title: "",
          explanation: "",
          confidence_level: signal.confidence_level,
          context_refs: signal.context_refs,
        }));
      }
    }

    return new Response(
      JSON.stringify({
        signals_count: signals.length,
        suggestions,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("decision-signals error:", error);
    return new Response(
      JSON.stringify({ error: "Failed to compute decision signals" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
