import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { useAuth } from '@/contexts/AuthContext';

export interface DigestArchiveItem {
  id: string;
  week_start: string;
  week_end: string;
  stats: {
    tasks_created: number;
    tasks_completed: number;
    tasks_blocked: number;
    tasks_from_chat: number;
    goals_created: number;
  };
  blockers_summary: any[];
  decisions_summary: { tasks_from_chat_count: number; goals_from_chat_count: number } | null;
  narrative_text: string | null;
  read_at: string | null;
  created_at: string;
}

export function useDigestArchive() {
  const { currentWorkspace } = useWorkspace();
  const { user } = useAuth();

  const { data, isLoading, error } = useQuery({
    queryKey: ['digest-archive', currentWorkspace?.id, user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('weekly_digests')
        .select('*')
        .eq('user_id', user!.id)
        .eq('workspace_id', currentWorkspace!.id)
        .order('week_start', { ascending: false })
        .limit(52); // last year

      if (error) throw error;
      return (data || []) as unknown as DigestArchiveItem[];
    },
    enabled: !!currentWorkspace?.id && !!user?.id,
    staleTime: 5 * 60 * 1000,
  });

  return { digests: data || [], loading: isLoading, error: error ? (error as Error).message : null };
}
