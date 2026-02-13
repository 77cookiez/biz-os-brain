import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface ReactionGroup {
  emoji: string;
  count: number;
  userIds: string[];
  hasOwn: boolean;
}

export interface MessageReactions {
  [messageId: string]: ReactionGroup[];
}

export function useChatReactions(threadId: string | null, messageIds: string[]) {
  const { user } = useAuth();
  const [reactions, setReactions] = useState<MessageReactions>({});

  // Fetch reactions for all visible messages
  useEffect(() => {
    if (!threadId || messageIds.length === 0) return;

    const fetchReactions = async () => {
      const { data } = await supabase
        .from('chat_reactions')
        .select('id, message_id, user_id, emoji')
        .in('message_id', messageIds);

      if (data) {
        setReactions(groupReactions(data, user?.id));
      }
    };

    fetchReactions();
  }, [threadId, messageIds.join(','), user?.id]);

  // Realtime subscription for reactions
  useEffect(() => {
    if (!threadId) return;

    const channel = supabase
      .channel(`reactions-${threadId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'chat_reactions',
        },
        async () => {
          // Refetch all visible reactions on any change
          if (messageIds.length === 0) return;
          const { data } = await supabase
            .from('chat_reactions')
            .select('id, message_id, user_id, emoji')
            .in('message_id', messageIds);

          if (data) {
            setReactions(groupReactions(data, user?.id));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [threadId, messageIds.join(','), user?.id]);

  const toggleReaction = useCallback(async (messageId: string, emoji: string) => {
    if (!user) return;

    // Check if user already reacted with this emoji
    const existing = reactions[messageId]?.find(
      (r) => r.emoji === emoji && r.hasOwn
    );

    if (existing) {
      // Remove reaction
      await supabase
        .from('chat_reactions')
        .delete()
        .eq('message_id', messageId)
        .eq('user_id', user.id)
        .eq('emoji', emoji);
    } else {
      // Add reaction
      await supabase.from('chat_reactions').insert({
        message_id: messageId,
        user_id: user.id,
        emoji,
      });
    }
  }, [user?.id, reactions]);

  return { reactions, toggleReaction };
}

function groupReactions(
  data: { id: string; message_id: string; user_id: string; emoji: string }[],
  currentUserId?: string
): MessageReactions {
  const result: MessageReactions = {};

  for (const row of data) {
    if (!result[row.message_id]) {
      result[row.message_id] = [];
    }

    const group = result[row.message_id].find((g) => g.emoji === row.emoji);
    if (group) {
      group.count++;
      group.userIds.push(row.user_id);
      if (row.user_id === currentUserId) group.hasOwn = true;
    } else {
      result[row.message_id].push({
        emoji: row.emoji,
        count: 1,
        userIds: [row.user_id],
        hasOwn: row.user_id === currentUserId,
      });
    }
  }

  return result;
}
