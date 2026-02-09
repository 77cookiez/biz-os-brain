import { useRef, useEffect } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ULLText } from '@/components/ull/ULLText';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import type { ChatMessage } from '@/hooks/useChatMessages';

interface MessageViewProps {
  messages: ChatMessage[];
  loading: boolean;
}

function extractFallback(meaningJson?: Record<string, unknown>): string {
  if (!meaningJson) return '…';
  return (meaningJson.description as string) || (meaningJson.subject as string) || '…';
}

export function MessageView({ messages, loading }: MessageViewProps) {
  const { user } = useAuth();
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
        Loading messages…
      </div>
    );
  }

  if (messages.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
        No messages yet. Say something!
      </div>
    );
  }

  return (
    <ScrollArea className="flex-1 p-4">
      <div className="flex flex-col gap-2 max-w-2xl mx-auto">
        {messages.map(msg => {
          const isOwn = msg.sender_user_id === user?.id;
          const fallback = extractFallback(msg.meaning_json);
          return (
            <div
              key={msg.id}
              className={cn(
                'flex',
                isOwn ? 'justify-end' : 'justify-start'
              )}
            >
              <div
                className={cn(
                  'max-w-[75%] rounded-2xl px-4 py-2.5 text-sm',
                  isOwn
                    ? 'bg-primary text-primary-foreground rounded-br-md'
                    : 'bg-muted text-foreground rounded-bl-md'
                )}
              >
                <ULLText
                  meaningId={msg.meaning_object_id}
                  fallback={fallback}
                />
                <p className="text-[10px] opacity-60 mt-1">
                  {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>
    </ScrollArea>
  );
}
