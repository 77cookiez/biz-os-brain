import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { useAuth } from '@/contexts/AuthContext';

export function useReadReceipts(threadId: string | null) {
  const { user } = useAuth();

  const markAsRead = useCallback(async () => {
    if (!threadId || !user) return;

    await supabase
      .from('chat_thread_members')
      .update({ last_read_at: new Date().toISOString() })
      .eq('thread_id', threadId)
      .eq('user_id', user.id);
  }, [threadId, user?.id]);

  return { markAsRead };
}

export function useChatAudit() {
  const { currentWorkspace } = useWorkspace();
  const { user } = useAuth();

  const logAction = useCallback(async (
    action: string,
    targetId?: string,
    metadata?: Record<string, unknown>
  ) => {
    if (!currentWorkspace || !user) return;

    await supabase.from('chat_audit_logs' as any).insert({
      workspace_id: currentWorkspace.id,
      action,
      actor_user_id: user.id,
      target_id: targetId || null,
      metadata: metadata || {},
    });
  }, [currentWorkspace?.id, user?.id]);

  return { logAction };
}
