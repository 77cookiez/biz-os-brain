import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useWorkspace } from '@/contexts/WorkspaceContext';

export interface ChatTaskLink {
  taskId: string;
  taskTitle: string;
  taskStatus: string;
  messageId: string;
  threadId: string;
}

/**
 * Given a list of chat message IDs, finds tasks that were created from those messages.
 * Uses meaning_objects.meaning_json->metadata->source_message_id for the lookup.
 * Optimized: single query per message set, cached per thread.
 */
export function useChatTaskLinks(messageIds: string[]) {
  const { currentWorkspace } = useWorkspace();
  const [links, setLinks] = useState<Map<string, ChatTaskLink>>(new Map());
  const [loading, setLoading] = useState(false);

  const fetchLinks = useCallback(async () => {
    if (!currentWorkspace || messageIds.length === 0) {
      setLinks(new Map());
      return;
    }

    setLoading(true);
    try {
      // Query meaning_objects that have source=chat and source_message_id in our set
      // Then join to tasks via meaning_object_id
      const { data, error } = await supabase
        .from('tasks')
        .select('id, title, status, meaning_object_id, meaning_objects(meaning_json)')
        .eq('workspace_id', currentWorkspace.id)
        .not('meaning_object_id', 'is', null);

      if (error || !data) {
        setLoading(false);
        return;
      }

      const messageIdSet = new Set(messageIds);
      const newLinks = new Map<string, ChatTaskLink>();

      for (const task of data) {
        const meaningJson = (task as any).meaning_objects?.meaning_json;
        if (!meaningJson?.metadata) continue;
        const { source, source_message_id, source_thread_id } = meaningJson.metadata;
        if (source === 'chat' && source_message_id && messageIdSet.has(source_message_id)) {
          // Only keep first/latest task per message
          if (!newLinks.has(source_message_id)) {
            newLinks.set(source_message_id, {
              taskId: task.id,
              taskTitle: task.title,
              taskStatus: task.status,
              messageId: source_message_id,
              threadId: source_thread_id || '',
            });
          }
        }
      }

      setLinks(newLinks);
    } finally {
      setLoading(false);
    }
  }, [currentWorkspace?.id, messageIds.join(',')]);

  useEffect(() => {
    fetchLinks();
  }, [fetchLinks]);

  return { links, loading, refetch: fetchLinks };
}

/**
 * For a single task, get its chat source info from meaning_json metadata.
 */
export function getTaskChatSource(meaningJson: Record<string, unknown> | null | undefined): {
  sourceMessageId: string;
  sourceThreadId: string;
} | null {
  if (!meaningJson?.metadata) return null;
  const meta = meaningJson.metadata as Record<string, unknown>;
  if (meta.source !== 'chat' || !meta.source_message_id) return null;
  return {
    sourceMessageId: meta.source_message_id as string,
    sourceThreadId: (meta.source_thread_id as string) || '',
  };
}
