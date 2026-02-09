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
  // Joined data
  meaning_json?: Record<string, unknown>;
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
      setMessages(data.map((m: any) => ({
        ...m,
        meaning_json: m.meaning_objects?.meaning_json,
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
          // Fetch the full message with meaning_json
          const { data } = await supabase
            .from('chat_messages')
            .select('*, meaning_objects(meaning_json)')
            .eq('id', (payload.new as any).id)
            .single();

          if (data) {
            setMessages(prev => [...prev, {
              ...data,
              meaning_json: (data as any).meaning_objects?.meaning_json,
            } as ChatMessage]);
          }
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

    // 1. Create meaning object
    const meaningJson: MeaningJsonV1 = {
      version: 'v1',
      type: 'MESSAGE',
      intent: 'communicate',
      subject: 'chat_message',
      description: text.trim(),
      metadata: {
        created_from: 'user',
      },
    };

    const meaningId = await createMeaningObject({
      workspaceId: currentWorkspace.id,
      createdBy: user.id,
      type: 'MESSAGE',
      sourceLang,
      meaningJson,
    });

    if (!meaningId) {
      console.error('[Chat] Failed to create meaning object');
      return false;
    }

    // 2. Insert chat message
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

  return { messages, loading, sendMessage, refreshMessages: fetchMessages };
}
