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
  // Enriched data
  last_message?: {
    meaning_object_id: string;
    meaning_json?: Record<string, unknown>;
    sender_user_id: string;
    created_at: string;
    sender_name?: string;
  } | null;
}

export interface ChatThreadMember {
  id: string;
  thread_id: string;
  user_id: string;
  role: string;
  last_read_at: string | null;
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

    // Fetch threads
    const { data: threadData, error } = await supabase
      .from('chat_threads')
      .select('*')
      .eq('workspace_id', currentWorkspace.id)
      .order('created_at', { ascending: false });

    if (error || !threadData) {
      setLoading(false);
      return;
    }

    // For each thread, fetch last message with sender profile
    const enriched: ChatThread[] = await Promise.all(
      threadData.map(async (t: any) => {
        const { data: msgs } = await supabase
          .from('chat_messages')
          .select('id, meaning_object_id, sender_user_id, created_at, meaning_objects(meaning_json)')
          .eq('thread_id', t.id)
          .order('created_at', { ascending: false })
          .limit(1);

        let last_message: ChatThread['last_message'] = null;

        if (msgs && msgs.length > 0) {
          const m = msgs[0] as any;
          // Fetch sender name
          const { data: profile } = await supabase
            .from('profiles')
            .select('full_name')
            .eq('user_id', m.sender_user_id)
            .single();

          last_message = {
            meaning_object_id: m.meaning_object_id,
            meaning_json: m.meaning_objects?.meaning_json,
            sender_user_id: m.sender_user_id,
            created_at: m.created_at,
            sender_name: profile?.full_name || undefined,
          };
        }

        return { ...t, last_message } as ChatThread;
      })
    );

    // Sort by last message time (most recent first)
    enriched.sort((a, b) => {
      const aTime = a.last_message?.created_at || a.created_at;
      const bTime = b.last_message?.created_at || b.created_at;
      return new Date(bTime).getTime() - new Date(aTime).getTime();
    });

    setThreads(enriched);
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

    const allMembers = [...new Set([user.id, ...params.memberUserIds])];
    const memberRows = allMembers.map(uid => ({
      thread_id: thread.id,
      user_id: uid,
      role: uid === user.id ? 'owner' : 'member',
    }));

    await supabase.from('chat_thread_members').insert(memberRows);

    await fetchThreads();
    return thread.id;
  }, [currentWorkspace?.id, user?.id, fetchThreads]);

  const deleteThread = useCallback(async (threadId: string): Promise<boolean> => {
    const { error } = await supabase
      .from('chat_threads')
      .delete()
      .eq('id', threadId);

    if (error) {
      console.error('[Chat] Failed to delete thread:', error.message);
      return false;
    }

    setThreads(prev => prev.filter(t => t.id !== threadId));
    return true;
  }, []);

  return { threads, loading, createThread, deleteThread, refreshThreads: fetchThreads };
}
