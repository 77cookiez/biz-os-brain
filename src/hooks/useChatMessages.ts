import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { createMeaningObject } from '@/lib/meaningObject';
import type { MeaningJsonV1 } from '@/lib/meaningObject';

export interface ChatMessage {
  id: string;
  workspace_id: string;
  thread_id: string;
  sender_user_id: string;
  meaning_object_id: string;
  source_lang: string;
  created_at: string;
  meaning_json?: Record<string, unknown>;
  sender_name?: string;
}

export function useChatMessages(threadId: string | null) {
  const { currentWorkspace } = useWorkspace();
  const { user } = useAuth();
  const { currentLanguage } = useLanguage();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchMessages = useCallback(async () => {
    if (!threadId || !currentWorkspace) return;
    setLoading(true);

    const { data, error } = await supabase
      .from('chat_messages')
      .select('*, meaning_objects(meaning_json)')
      .eq('thread_id', threadId)
      .order('created_at', { ascending: true });

    if (!error && data) {
      // Collect unique sender IDs
      const senderIds = [...new Set(data.map((m: any) => m.sender_user_id))];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, full_name')
        .in('user_id', senderIds);

      const nameMap = new Map<string, string>();
      profiles?.forEach((p: any) => {
        if (p.full_name) nameMap.set(p.user_id, p.full_name);
      });

      setMessages(data.map((m: any) => ({
        ...m,
        meaning_json: m.meaning_objects?.meaning_json,
        sender_name: nameMap.get(m.sender_user_id) || undefined,
      })));
    }
    setLoading(false);
  }, [threadId, currentWorkspace?.id]);

  useEffect(() => {
    fetchMessages();
  }, [fetchMessages]);

  // Subscribe to realtime
  useEffect(() => {
    if (!threadId) return;

    const channel = supabase
      .channel(`chat-${threadId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'chat_messages',
          filter: `thread_id=eq.${threadId}`,
        },
        async (payload) => {
          const { data } = await supabase
            .from('chat_messages')
            .select('*, meaning_objects(meaning_json)')
            .eq('id', (payload.new as any).id)
            .single();

          if (data) {
            const { data: profile } = await supabase
              .from('profiles')
              .select('full_name')
              .eq('user_id', (data as any).sender_user_id)
              .single();

            setMessages(prev => [...prev, {
              ...data,
              meaning_json: (data as any).meaning_objects?.meaning_json,
              sender_name: profile?.full_name || undefined,
            } as ChatMessage]);
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'chat_messages',
          filter: `thread_id=eq.${threadId}`,
        },
        (payload) => {
          setMessages(prev => prev.filter(m => m.id !== (payload.old as any).id));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [threadId]);

  const sendMessage = useCallback(async (text: string): Promise<boolean> => {
    if (!threadId || !currentWorkspace || !user || !text.trim()) return false;

    const sourceLang = currentLanguage.code;

    const meaningJson: MeaningJsonV1 = {
      version: 'v1',
      type: 'MESSAGE',
      intent: 'communicate',
      subject: 'chat_message',
      description: text.trim(),
      metadata: { created_from: 'user' },
    };

    const meaningId = await createMeaningObject({
      workspaceId: currentWorkspace.id,
      createdBy: user.id,
      type: 'MESSAGE',
      sourceLang,
      meaningJson,
    });

    if (!meaningId) return false;

    const { error } = await supabase
      .from('chat_messages')
      .insert({
        workspace_id: currentWorkspace.id,
        thread_id: threadId,
        sender_user_id: user.id,
        meaning_object_id: meaningId,
        source_lang: sourceLang,
      });

    if (error) {
      console.error('[Chat] Failed to send message:', error.message);
      return false;
    }

    return true;
  }, [threadId, currentWorkspace?.id, user?.id, currentLanguage.code]);

  const deleteMessage = useCallback(async (messageId: string): Promise<boolean> => {
    const { error } = await supabase
      .from('chat_messages')
      .delete()
      .eq('id', messageId);

    if (error) {
      console.error('[Chat] Failed to delete message:', error.message);
      return false;
    }

    setMessages(prev => prev.filter(m => m.id !== messageId));
    return true;
  }, []);

  return { messages, loading, sendMessage, deleteMessage, refreshMessages: fetchMessages };
}
