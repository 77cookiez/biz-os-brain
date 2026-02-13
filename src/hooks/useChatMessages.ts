import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { createMeaningObject } from '@/lib/meaningObject';
import { guardMeaningInsert } from '@/lib/meaningGuard';
import type { MeaningJsonV1 } from '@/lib/meaningObject';

const PAGE_SIZE = 50;

export interface ChatAttachment {
  id: string;
  file_name: string;
  file_type: string;
  file_size: number;
  file_url: string;
}

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
  attachments?: ChatAttachment[];
}

export function useChatMessages(threadId: string | null) {
  const { currentWorkspace } = useWorkspace();
  const { user } = useAuth();
  const { currentLanguage } = useLanguage();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const oldestTimestampRef = useRef<string | null>(null);

  // Fetch attachments for a list of message IDs
  const fetchAttachments = useCallback(async (messageIds: string[]): Promise<Map<string, ChatAttachment[]>> => {
    if (messageIds.length === 0) return new Map();
    const { data } = await supabase
      .from('chat_attachments')
      .select('id, message_id, file_name, file_type, file_size, file_url')
      .in('message_id', messageIds);

    const map = new Map<string, ChatAttachment[]>();
    data?.forEach((a: any) => {
      const list = map.get(a.message_id) || [];
      list.push({ id: a.id, file_name: a.file_name, file_type: a.file_type, file_size: a.file_size, file_url: a.file_url });
      map.set(a.message_id, list);
    });
    return map;
  }, []);

  // Fetch profiles for sender IDs
  const fetchProfiles = useCallback(async (senderIds: string[]): Promise<Map<string, string>> => {
    if (senderIds.length === 0) return new Map();
    const { data: profiles } = await supabase
      .from('profiles')
      .select('user_id, full_name')
      .in('user_id', senderIds);

    const nameMap = new Map<string, string>();
    profiles?.forEach((p: any) => {
      if (p.full_name) nameMap.set(p.user_id, p.full_name);
    });
    return nameMap;
  }, []);

  // Transform raw DB rows into ChatMessage objects
  const transformMessages = useCallback(async (data: any[]): Promise<ChatMessage[]> => {
    const senderIds = [...new Set(data.map((m: any) => m.sender_user_id))];
    const messageIds = data.map((m: any) => m.id);

    const [nameMap, attachMap] = await Promise.all([
      fetchProfiles(senderIds),
      fetchAttachments(messageIds),
    ]);

    return data.map((m: any) => ({
      ...m,
      meaning_json: m.meaning_objects?.meaning_json,
      sender_name: nameMap.get(m.sender_user_id) || undefined,
      attachments: attachMap.get(m.id) || undefined,
    }));
  }, [fetchProfiles, fetchAttachments]);

  // Initial load — latest PAGE_SIZE messages
  const fetchMessages = useCallback(async () => {
    if (!threadId || !currentWorkspace) return;
    setLoading(true);
    setHasMore(true);
    oldestTimestampRef.current = null;

    const { data, error } = await supabase
      .from('chat_messages')
      .select('*, meaning_objects(meaning_json)')
      .eq('thread_id', threadId)
      .order('created_at', { ascending: false })
      .limit(PAGE_SIZE);

    if (!error && data) {
      const reversed = data.reverse(); // oldest first for display
      if (reversed.length > 0) {
        oldestTimestampRef.current = reversed[0].created_at;
      }
      setHasMore(data.length === PAGE_SIZE);
      const transformed = await transformMessages(reversed);
      setMessages(transformed);
    }
    setLoading(false);
  }, [threadId, currentWorkspace?.id, transformMessages]);

  // Load older messages (pagination)
  const loadMore = useCallback(async () => {
    if (!threadId || !currentWorkspace || !hasMore || loadingMore || !oldestTimestampRef.current) return;
    setLoadingMore(true);

    const { data, error } = await supabase
      .from('chat_messages')
      .select('*, meaning_objects(meaning_json)')
      .eq('thread_id', threadId)
      .lt('created_at', oldestTimestampRef.current)
      .order('created_at', { ascending: false })
      .limit(PAGE_SIZE);

    if (!error && data) {
      const reversed = data.reverse();
      if (reversed.length > 0) {
        oldestTimestampRef.current = reversed[0].created_at;
      }
      setHasMore(data.length === PAGE_SIZE);
      const transformed = await transformMessages(reversed);
      setMessages(prev => [...transformed, ...prev]);
    }
    setLoadingMore(false);
  }, [threadId, currentWorkspace?.id, hasMore, loadingMore, transformMessages]);

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

            // Fetch attachments for this new message
            const attachMap = await fetchAttachments([data.id]);

            setMessages(prev => [...prev, {
              ...data,
              meaning_json: (data as any).meaning_objects?.meaning_json,
              sender_name: profile?.full_name || undefined,
              attachments: attachMap.get(data.id) || undefined,
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
  }, [threadId, fetchAttachments]);

  const sendMessage = useCallback(async (text: string, files?: File[]): Promise<boolean> => {
    if (!threadId || !currentWorkspace || !user) return false;
    if (!text.trim() && (!files || files.length === 0)) return false;

    const sourceLang = currentLanguage.code;

    const meaningJson: MeaningJsonV1 = {
      version: 'v1',
      type: 'MESSAGE',
      intent: 'communicate',
      subject: 'chat_message',
      description: text.trim() || (files ? `[${files.length} file(s)]` : ''),
      metadata: { 
        created_from: 'user',
        ...(files && files.length > 0 ? { has_attachments: true } : {}),
      },
    };

    const meaningId = await createMeaningObject({
      workspaceId: currentWorkspace.id,
      createdBy: user.id,
      type: 'MESSAGE',
      sourceLang,
      meaningJson,
    });

    if (!meaningId) return false;

    const insertPayload = {
      workspace_id: currentWorkspace.id,
      thread_id: threadId,
      sender_user_id: user.id,
      meaning_object_id: meaningId,
      source_lang: sourceLang,
    };

    guardMeaningInsert('chat_messages', insertPayload, { block: true });

    const { data: messageData, error } = await supabase
      .from('chat_messages')
      .insert(insertPayload)
      .select('id')
      .single();

    if (error || !messageData) {
      console.error('[Chat] Failed to send message:', error?.message);
      return false;
    }

    // Upload files if any
    if (files && files.length > 0) {
      const messageId = messageData.id;
      const uploadPromises = files.map(async (file) => {
        const fileExt = file.name.split('.').pop() || 'bin';
        const storagePath = `${user.id}/${threadId}/${messageId}/${crypto.randomUUID()}.${fileExt}`;

        const { error: uploadError } = await supabase.storage
          .from('chat-attachments')
          .upload(storagePath, file, {
            cacheControl: '3600',
            upsert: false,
          });

        if (uploadError) {
          console.error('[Chat] File upload failed:', uploadError.message);
          return null;
        }

        const { data: urlData } = supabase.storage
          .from('chat-attachments')
          .getPublicUrl(storagePath);

        // Insert attachment record
        await supabase.from('chat_attachments').insert({
          message_id: messageId,
          workspace_id: currentWorkspace.id,
          uploaded_by: user.id,
          file_name: file.name,
          file_type: file.type || 'application/octet-stream',
          file_size: file.size,
          storage_path: storagePath,
          file_url: urlData.publicUrl,
        });

        return urlData.publicUrl;
      });

      await Promise.all(uploadPromises);
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

  return { messages, loading, loadingMore, hasMore, loadMore, sendMessage, deleteMessage, refreshMessages: fetchMessages };
}
