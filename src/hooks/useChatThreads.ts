import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { useAuth } from '@/contexts/AuthContext';

export interface ChatThread {
  id: string;
  workspace_id: string;
  type: 'direct' | 'group';
  title: string | null;
  created_by: string;
  created_at: string;
}

export interface ChatThreadMember {
  id: string;
  thread_id: string;
  user_id: string;
  role: string;
  profile?: { full_name: string | null; avatar_url: string | null };
}

export function useChatThreads() {
  const { currentWorkspace } = useWorkspace();
  const { user } = useAuth();
  const [threads, setThreads] = useState<ChatThread[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchThreads = useCallback(async () => {
    if (!currentWorkspace || !user) return;
    setLoading(true);

    const { data, error } = await supabase
      .from('chat_threads')
      .select('*')
      .eq('workspace_id', currentWorkspace.id)
      .order('created_at', { ascending: false });

    if (!error && data) {
      setThreads(data as ChatThread[]);
    }
    setLoading(false);
  }, [currentWorkspace?.id, user?.id]);

  useEffect(() => {
    fetchThreads();
  }, [fetchThreads]);

  const createThread = useCallback(async (params: {
    type: 'direct' | 'group';
    title?: string;
    memberUserIds: string[];
  }): Promise<string | null> => {
    if (!currentWorkspace || !user) return null;

    const { data: thread, error } = await supabase
      .from('chat_threads')
      .insert({
        workspace_id: currentWorkspace.id,
        type: params.type,
        title: params.title || null,
        created_by: user.id,
      })
      .select()
      .single();

    if (error || !thread) {
      console.error('[Chat] Failed to create thread:', error?.message);
      return null;
    }

    // Add all members including creator
    const allMembers = [...new Set([user.id, ...params.memberUserIds])];
    const memberRows = allMembers.map(uid => ({
      thread_id: thread.id,
      user_id: uid,
      role: uid === user.id ? 'owner' : 'member',
    }));

    const { error: memberError } = await supabase
      .from('chat_thread_members')
      .insert(memberRows);

    if (memberError) {
      console.error('[Chat] Failed to add members:', memberError.message);
    }

    await fetchThreads();
    return thread.id;
  }, [currentWorkspace?.id, user?.id, fetchThreads]);

  return { threads, loading, createThread, refreshThreads: fetchThreads };
}
