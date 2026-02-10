import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useWorkspace } from '@/contexts/WorkspaceContext';

const INSIGHTS_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/insights-get`;

export interface InsightsServerResponse {
  window: { start: string; end: string; days: number };
  weekly: {
    tasks_created: number;
    tasks_completed: number;
    tasks_blocked: number;
    tasks_from_chat: number;
    goals_created: number;
    goals_from_chat: number;
  };
  blockers: {
    blocked_tasks: Array<{ task_id: string; meaning_object_id: string | null; reason_code: string; last_activity_at: string }>;
    stale_tasks: Array<{ task_id: string; meaning_object_id: string | null; days_inactive: number; last_activity_at: string }>;
  };
  decisions: {
    tasks_created_from_chat: Array<{ task_id: string; meaning_object_id: string; from_message_id: string | null; created_at: string }>;
    goals_created_from_chat: Array<{ goal_id: string; meaning_object_id: string; from_thread_id: string | null; created_at: string }>;
  };
}

async function fetchInsights(workspaceId: string): Promise<InsightsServerResponse> {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;

  const resp = await fetch(INSIGHTS_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
      apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
    },
    body: JSON.stringify({ workspace_id: workspaceId, window_days: 7 }),
  });

  if (!resp.ok) {
    const err = await resp.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(err.error || 'Failed to fetch insights');
  }

  return resp.json();
}

export function useInsights() {
  const { currentWorkspace } = useWorkspace();
  const wsId = currentWorkspace?.id;

  const { data, isLoading, error } = useQuery({
    queryKey: ['insights', wsId],
    queryFn: () => fetchInsights(wsId!),
    enabled: !!wsId,
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: false,
  });

  const windowStart = data?.window.start ? new Date(data.window.start).toISOString().split('T')[0] : '';
  const windowEnd = data?.window.end ? new Date(data.window.end).toISOString().split('T')[0] : '';

  return {
    data,
    loading: isLoading,
    error: error ? (error as Error).message : null,
    weekStart: windowStart,
    weekEnd: windowEnd,
  };
}
