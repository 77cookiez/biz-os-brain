import { supabase } from '@/integrations/supabase/client';
import type { SnapshotProvider, ProviderFragment } from '../types';

const MAX_MESSAGES_PER_SNAPSHOT = 5000;

export const TeamChatProvider: SnapshotProvider = {
  id: 'team_chat',
  version: 1,

  async capture(workspaceId: string): Promise<ProviderFragment> {
    const [threads, members, messages, attachments] = await Promise.all([
      (supabase as any)
        .from('chat_threads')
        .select('*')
        .eq('workspace_id', workspaceId),
      (supabase as any)
        .from('chat_thread_members')
        .select('*')
        .eq('workspace_id', workspaceId),
      supabase
        .from('chat_messages')
        .select('*')
        .eq('workspace_id', workspaceId)
        .order('created_at', { ascending: false })
        .limit(MAX_MESSAGES_PER_SNAPSHOT),
      supabase
        .from('chat_attachments')
        .select('id, message_id, workspace_id, file_name, file_type, file_size, file_url, storage_path, uploaded_by, created_at')
        .eq('workspace_id', workspaceId),
    ]);

    const t = threads.data || [];
    const m = members.data || [];
    const msg = messages.data || [];
    const att = attachments.data || [];

    return {
      provider_id: 'team_chat',
      version: 1,
      data: {
        threads: t,
        thread_members: m,
        messages: msg,
        attachments_refs: att, // references only — no file blobs
      },
      metadata: {
        entity_count: t.length + m.length + msg.length + att.length,
      },
    };
  },

  async restore(workspaceId: string, fragment: ProviderFragment): Promise<void> {
    const { threads, thread_members, messages, attachments_refs } = fragment.data as {
      threads: any[];
      thread_members: any[];
      messages: any[];
      attachments_refs: any[];
    };

    // Delete in reverse-dependency order
    const { error: attErr } = await supabase
      .from('chat_attachments')
      .delete()
      .eq('workspace_id', workspaceId);
    if (attErr) throw new Error(`Failed to clear chat_attachments: ${attErr.message}`);

    const { error: msgErr } = await supabase
      .from('chat_messages')
      .delete()
      .eq('workspace_id', workspaceId);
    if (msgErr) throw new Error(`Failed to clear chat_messages: ${msgErr.message}`);

    const { error: memErr } = await (supabase as any)
      .from('chat_thread_members')
      .delete()
      .eq('workspace_id', workspaceId);
    if (memErr) throw new Error(`Failed to clear chat_thread_members: ${memErr.message}`);

    const { error: thrErr } = await (supabase as any)
      .from('chat_threads')
      .delete()
      .eq('workspace_id', workspaceId);
    if (thrErr) throw new Error(`Failed to clear chat_threads: ${thrErr.message}`);

    // Restore in dependency order
    if (threads?.length) {
      const { error } = await (supabase as any).from('chat_threads').insert(threads);
      if (error) throw new Error(`Failed to restore chat_threads: ${error.message}`);
    }
    if (thread_members?.length) {
      const { error } = await (supabase as any).from('chat_thread_members').insert(thread_members);
      if (error) throw new Error(`Failed to restore chat_thread_members: ${error.message}`);
    }
    if (messages?.length) {
      const { error } = await supabase.from('chat_messages').insert(messages as any);
      if (error) throw new Error(`Failed to restore chat_messages: ${error.message}`);
    }
    if (attachments_refs?.length) {
      const { error } = await supabase.from('chat_attachments').insert(attachments_refs as any);
      if (error) throw new Error(`Failed to restore chat_attachments: ${error.message}`);
    }
  },

  describe() {
    return {
      name: 'Team Chat',
      description: 'Channels, messages, threads, attachment references (no file blobs)',
      critical: false,
    };
  },
};
