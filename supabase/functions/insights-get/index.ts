import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/**
 * Determines if a meaning_json indicates "from chat" origin.
 * Single source of truth (A1):
 *  - meaning_json.links.from_message_id exists
 *  - OR meaning_json.metadata.source === 'chat'
 *  - OR meaning_json.metadata.source_message_id exists
 */
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

    // Create client with user's auth token for RLS
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { workspace_id, window_days = 7 } = await req.json();

    if (!workspace_id) {
      return new Response(JSON.stringify({ error: "workspace_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Compute rolling window (A4): last N days from now
    const now = new Date();
    const windowStart = new Date(now.getTime() - window_days * 24 * 60 * 60 * 1000);
    const windowStartISO = windowStart.toISOString();
    const windowEndISO = now.toISOString();

    // Stale threshold (A2): tasks inactive for 5+ days
    const staleThreshold = new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000).toISOString();

    // Batch all queries in parallel
    const [
      tasksCreatedRes,
      tasksCompletedRes,
      tasksBlockedRes,
      goalsCreatedRes,
      taskMeaningsRes,
      goalMeaningsRes,
      blockedTasksRes,
      staleTasksRes,
    ] = await Promise.all([
      // Weekly counts
      supabase
        .from("tasks")
        .select("id", { count: "exact", head: true })
        .eq("workspace_id", workspace_id)
        .gte("created_at", windowStartISO)
        .lte("created_at", windowEndISO),

      supabase
        .from("tasks")
        .select("id", { count: "exact", head: true })
        .eq("workspace_id", workspace_id)
        .eq("status", "done")
        .gte("completed_at", windowStartISO)
        .lte("completed_at", windowEndISO),

      supabase
        .from("tasks")
        .select("id", { count: "exact", head: true })
        .eq("workspace_id", workspace_id)
        .eq("status", "blocked"),

      supabase
        .from("goals")
        .select("id", { count: "exact", head: true })
        .eq("workspace_id", workspace_id)
        .gte("created_at", windowStartISO)
        .lte("created_at", windowEndISO),

      // Task meaning objects for "from chat" detection
      supabase
        .from("meaning_objects")
        .select("id, meaning_json, created_at")
        .eq("workspace_id", workspace_id)
        .eq("type", "task")
        .gte("created_at", windowStartISO)
        .lte("created_at", windowEndISO),

      // Goal meaning objects for "from chat" detection
      supabase
        .from("meaning_objects")
        .select("id, meaning_json, created_at")
        .eq("workspace_id", workspace_id)
        .eq("type", "goal")
        .gte("created_at", windowStartISO)
        .lte("created_at", windowEndISO),

      // Blocked tasks (A3): status = blocked OR meaning v2 state = blocked
      supabase
        .from("tasks")
        .select("id, title, status, blocked_reason, updated_at, meaning_object_id")
        .eq("workspace_id", workspace_id)
        .eq("status", "blocked")
        .limit(50),

      // Stale tasks (A2): open tasks with no activity for 5+ days
      supabase
        .from("tasks")
        .select("id, title, status, updated_at, meaning_object_id")
        .eq("workspace_id", workspace_id)
        .in("status", ["backlog", "planned", "in_progress"])
        .lt("updated_at", staleThreshold)
        .limit(50),
    ]);

    // Compute "from chat" counts (A1)
    const taskMeanings = taskMeaningsRes.data || [];
    const goalMeanings = goalMeaningsRes.data || [];

    const chatTaskMeanings = taskMeanings.filter((m: any) => isFromChat(m.meaning_json));
    const chatGoalMeanings = goalMeanings.filter((m: any) => isFromChat(m.meaning_json));

    // Build blockers list
    const blockedTasks = (blockedTasksRes.data || []).map((t: any) => ({
      task_id: t.id,
      meaning_object_id: t.meaning_object_id,
      reason_code: "blocked",
      last_activity_at: t.updated_at,
    }));

    const staleTasks = (staleTasksRes.data || []).map((t: any) => ({
      task_id: t.id,
      meaning_object_id: t.meaning_object_id,
      days_inactive: Math.floor(
        (now.getTime() - new Date(t.updated_at).getTime()) / (1000 * 60 * 60 * 24)
      ),
      last_activity_at: t.updated_at,
    }));

    // Build decisions list
    const tasksFromChatDecisions = chatTaskMeanings.map((m: any) => ({
      task_id: m.id,
      meaning_object_id: m.id,
      from_message_id: m.meaning_json?.links?.from_message_id ||
        m.meaning_json?.metadata?.source_message_id || null,
      created_at: m.created_at,
    }));

    const goalsFromChatDecisions = chatGoalMeanings.map((m: any) => ({
      goal_id: m.id,
      meaning_object_id: m.id,
      from_thread_id: m.meaning_json?.links?.from_thread_id ||
        m.meaning_json?.metadata?.source_thread_id || null,
      created_at: m.created_at,
    }));

    const result = {
      window: {
        start: windowStartISO,
        end: windowEndISO,
        days: window_days,
      },
      weekly: {
        tasks_created: tasksCreatedRes.count || 0,
        tasks_completed: tasksCompletedRes.count || 0,
        tasks_blocked: tasksBlockedRes.count || 0,
        tasks_from_chat: chatTaskMeanings.length,
        goals_created: goalsCreatedRes.count || 0,
        goals_from_chat: chatGoalMeanings.length,
      },
      blockers: {
        blocked_tasks: blockedTasks,
        stale_tasks: staleTasks,
      },
      decisions: {
        tasks_created_from_chat: tasksFromChatDecisions,
        goals_created_from_chat: goalsFromChatDecisions,
      },
    };

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("insights-get error:", error);
    return new Response(
      JSON.stringify({ error: "Failed to compute insights" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
