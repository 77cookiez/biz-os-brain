import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useWorkspace } from '@/contexts/WorkspaceContext';

export interface WeeklySummary {
  tasksCreated: number;
  tasksCompleted: number;
  tasksBlocked: number;
  tasksFromChat: number;
  goalsCreated: number;
  goalsFromChat: number;
}

export interface BlockerInsight {
  id: string;
  title: string;
  status: string;
  blocked_reason: string | null;
  days_inactive: number;
  discussed_in_chat: boolean;
}

export interface DecisionInsight {
  id: string;
  type: 'task' | 'goal';
  title: string;
  source_thread_id: string | null;
  created_at: string;
  confidence: number | null;
}

export interface InsightsData {
  weeklySummary: WeeklySummary;
  blockers: BlockerInsight[];
  decisions: DecisionInsight[];
  loading: boolean;
  error: string | null;
  weekStart: string;
  weekEnd: string;
}

export function useInsights(): InsightsData {
  const { currentWorkspace } = useWorkspace();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [weeklySummary, setWeeklySummary] = useState<WeeklySummary>({
    tasksCreated: 0, tasksCompleted: 0, tasksBlocked: 0,
    tasksFromChat: 0, goalsCreated: 0, goalsFromChat: 0,
  });
  const [blockers, setBlockers] = useState<BlockerInsight[]>([]);
  const [decisions, setDecisions] = useState<DecisionInsight[]>([]);

  // Calculate week boundaries (Monday to Sunday)
  const now = new Date();
  const dayOfWeek = now.getDay();
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const weekStartDate = new Date(now);
  weekStartDate.setDate(now.getDate() + mondayOffset);
  weekStartDate.setHours(0, 0, 0, 0);
  const weekEndDate = new Date(weekStartDate);
  weekEndDate.setDate(weekStartDate.getDate() + 6);
  weekEndDate.setHours(23, 59, 59, 999);

  const weekStart = weekStartDate.toISOString();
  const weekEnd = weekEndDate.toISOString();
  const weekStartDisplay = weekStartDate.toISOString().split('T')[0];
  const weekEndDisplay = weekEndDate.toISOString().split('T')[0];

  const fetchInsights = useCallback(async () => {
    if (!currentWorkspace) return;
    setLoading(true);
    setError(null);

    try {
      const wsId = currentWorkspace.id;

      // 1. Weekly Summary
      const [
        tasksCreatedRes,
        tasksCompletedRes,
        tasksBlockedRes,
        goalsCreatedRes,
      ] = await Promise.all([
        supabase.from('tasks').select('id', { count: 'exact', head: true })
          .eq('workspace_id', wsId).gte('created_at', weekStart).lte('created_at', weekEnd),
        supabase.from('tasks').select('id', { count: 'exact', head: true })
          .eq('workspace_id', wsId).eq('status', 'done')
          .gte('completed_at', weekStart).lte('completed_at', weekEnd),
        supabase.from('tasks').select('id', { count: 'exact', head: true })
          .eq('workspace_id', wsId).eq('status', 'blocked'),
        supabase.from('goals').select('id', { count: 'exact', head: true })
          .eq('workspace_id', wsId).gte('created_at', weekStart).lte('created_at', weekEnd),
      ]);

      // Tasks from chat: meaning_objects with metadata.source = 'chat' and type = 'task'
      const { data: chatTaskMeanings } = await supabase
        .from('meaning_objects')
        .select('id, meaning_json')
        .eq('workspace_id', wsId)
        .eq('type', 'task')
        .gte('created_at', weekStart)
        .lte('created_at', weekEnd);

      const tasksFromChat = (chatTaskMeanings || []).filter((m: any) => {
        const mj = m.meaning_json;
        return mj?.metadata?.source === 'chat';
      }).length;

      // Goals from chat
      const { data: chatGoalMeanings } = await supabase
        .from('meaning_objects')
        .select('id, meaning_json')
        .eq('workspace_id', wsId)
        .eq('type', 'goal')
        .gte('created_at', weekStart)
        .lte('created_at', weekEnd);

      const goalsFromChat = (chatGoalMeanings || []).filter((m: any) => {
        const mj = m.meaning_json;
        return mj?.metadata?.source === 'chat';
      }).length;

      setWeeklySummary({
        tasksCreated: tasksCreatedRes.count || 0,
        tasksCompleted: tasksCompletedRes.count || 0,
        tasksBlocked: tasksBlockedRes.count || 0,
        tasksFromChat,
        goalsCreated: goalsCreatedRes.count || 0,
        goalsFromChat,
      });

      // 2. Blockers — blocked tasks + stale tasks (no update in 5 days)
      const fiveDaysAgo = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString();
      const { data: blockedTasks } = await supabase
        .from('tasks')
        .select('id, title, status, blocked_reason, updated_at, meaning_object_id')
        .eq('workspace_id', wsId)
        .or('status.eq.blocked,updated_at.lt.' + fiveDaysAgo)
        .in('status', ['backlog', 'planned', 'in_progress', 'blocked'])
        .limit(20);

      const blockerResults: BlockerInsight[] = (blockedTasks || []).map((t: any) => ({
        id: t.id,
        title: t.title,
        status: t.status,
        blocked_reason: t.blocked_reason,
        days_inactive: Math.floor((Date.now() - new Date(t.updated_at).getTime()) / (1000 * 60 * 60 * 24)),
        discussed_in_chat: false, // Will enrich below
      }));

      // Check which blocked tasks were discussed in chat (have chat-sourced meaning)
      if (blockerResults.length > 0) {
        const blockerMeaningIds = (blockedTasks || [])
          .filter((t: any) => t.meaning_object_id)
          .map((t: any) => t.meaning_object_id);

        if (blockerMeaningIds.length > 0) {
          const { data: chatMentions } = await supabase
            .from('meaning_objects')
            .select('id, meaning_json')
            .in('id', blockerMeaningIds);

          const chatDiscussedIds = new Set(
            (chatMentions || [])
              .filter((m: any) => m.meaning_json?.metadata?.source === 'chat')
              .map((m: any) => m.id)
          );

          blockerResults.forEach(b => {
            const task = (blockedTasks || []).find((t: any) => t.id === b.id);
            if (task?.meaning_object_id && chatDiscussedIds.has(task.meaning_object_id)) {
              b.discussed_in_chat = true;
            }
          });
        }
      }

      setBlockers(blockerResults);

      // 3. Decisions — tasks/goals created from chat this week
      const decisionResults: DecisionInsight[] = [];

      (chatTaskMeanings || [])
        .filter((m: any) => m.meaning_json?.metadata?.source === 'chat')
        .forEach((m: any) => {
          decisionResults.push({
            id: m.id,
            type: 'task',
            title: m.meaning_json?.subject || 'Task',
            source_thread_id: m.meaning_json?.metadata?.source_thread_id || null,
            created_at: m.created_at || '',
            confidence: m.meaning_json?.signals?.confidence ??
              m.meaning_json?.metadata?.confidence ?? null,
          });
        });

      (chatGoalMeanings || [])
        .filter((m: any) => m.meaning_json?.metadata?.source === 'chat')
        .forEach((m: any) => {
          decisionResults.push({
            id: m.id,
            type: 'goal',
            title: m.meaning_json?.subject || 'Goal',
            source_thread_id: m.meaning_json?.metadata?.source_thread_id || null,
            created_at: m.created_at || '',
            confidence: m.meaning_json?.signals?.confidence ??
              m.meaning_json?.metadata?.confidence ?? null,
          });
        });

      setDecisions(decisionResults);
    } catch (err: any) {
      setError(err.message || 'Failed to load insights');
    } finally {
      setLoading(false);
    }
  }, [currentWorkspace?.id, weekStart, weekEnd]);

  useEffect(() => {
    fetchInsights();
  }, [fetchInsights]);

  return {
    weeklySummary, blockers, decisions, loading, error,
    weekStart: weekStartDisplay, weekEnd: weekEndDisplay,
  };
}
