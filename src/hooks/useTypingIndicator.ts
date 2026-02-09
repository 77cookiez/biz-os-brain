import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export function useTypingIndicator(threadId: string | null) {
  const { user } = useAuth();
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const lastBroadcast = useRef<number>(0);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  useEffect(() => {
    if (!threadId || !user) return;

    const channel = supabase.channel(`typing-${threadId}`, {
      config: { presence: { key: user.id } },
    });

    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState();
        const users = Object.keys(state).filter(id => id !== user.id);
        setTypingUsers(users);
      })
      .subscribe();

    channelRef.current = channel;

    return () => {
      channel.untrack();
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [threadId, user?.id]);

  const broadcastTyping = useCallback(() => {
    if (!channelRef.current || !user) return;
    const now = Date.now();
    // Throttle: once every 2 seconds
    if (now - lastBroadcast.current < 2000) return;
    lastBroadcast.current = now;

    channelRef.current.track({ typing: true });

    // Auto-untrack after 3 seconds of inactivity
    setTimeout(() => {
      channelRef.current?.untrack();
    }, 3000);
  }, [user?.id]);

  return { typingUsers, broadcastTyping };
}
