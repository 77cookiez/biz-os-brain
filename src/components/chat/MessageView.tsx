import { useRef, useEffect, useState } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ULLText } from '@/components/ull/ULLText';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import { MoreVertical, Trash2, Check, CheckCheck } from 'lucide-react';
import type { ChatMessage } from '@/hooks/useChatMessages';

interface MessageViewProps {
  messages: ChatMessage[];
  loading: boolean;
  typingUsers?: string[];
  onDeleteMessage?: (id: string) => void;
  isAdmin?: boolean;
  showWelcome?: boolean;
}

function extractFallback(meaningJson?: Record<string, unknown>): string {
  if (!meaningJson) return '…';
  return (meaningJson.description as string) || (meaningJson.subject as string) || '…';
}

export function MessageView({ messages, loading, typingUsers = [], onDeleteMessage, isAdmin, showWelcome }: MessageViewProps) {
  const { user } = useAuth();
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length, typingUsers.length]);

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
        Loading messages…
      </div>
    );
  }

  return (
    <ScrollArea className="flex-1 p-4">
      <div className="flex flex-col gap-2 max-w-2xl mx-auto">
        {/* Welcome banner — shown once per thread when empty or on first open */}
        {showWelcome && messages.length === 0 && (
          <div className="flex justify-center my-8">
            <div className="bg-muted/50 border border-border rounded-xl px-5 py-4 text-center max-w-sm">
              <p className="text-sm text-foreground font-medium">👋 Welcome to Chat</p>
              <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">
                Write in your own language.{' '}
                Your teammates will read it in theirs.
              </p>
            </div>
          </div>
        )}

        {messages.map(msg => {
          const isOwn = msg.sender_user_id === user?.id;
          const fallback = extractFallback(msg.meaning_json);
          return (
            <div
              key={msg.id}
              className={cn(
                'flex group',
                isOwn ? 'justify-end' : 'justify-start'
              )}
            >
              <div className="relative">
                {/* Sender name for others */}
                {!isOwn && msg.sender_name && (
                  <p className="text-[10px] font-medium text-muted-foreground mb-0.5 ml-1">
                    {msg.sender_name}
                  </p>
                )}
                <div
                  className={cn(
                    'max-w-[75%] min-w-[100px] rounded-2xl px-4 py-2.5 text-sm',
                    isOwn
                      ? 'bg-primary text-primary-foreground rounded-br-md'
                      : 'bg-muted text-foreground rounded-bl-md'
                  )}
                >
                  <ULLText
                    meaningId={msg.meaning_object_id}
                    fallback={fallback}
                  />
                  <div className="flex items-center justify-end gap-1 mt-1">
                    <span className={cn("text-[10px]", isOwn ? "text-primary-foreground/60" : "text-muted-foreground")}>
                      {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                    {isOwn && (
                      <CheckCheck className={cn("h-3 w-3", "text-primary-foreground/60")} />
                    )}
                  </div>
                </div>

                {/* Admin/owner delete action */}
                {(isAdmin || isOwn) && onDeleteMessage && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className={cn(
                          'h-6 w-6 opacity-0 group-hover:opacity-100 absolute -top-1',
                          isOwn ? '-left-8' : '-right-8'
                        )}
                      >
                        <MoreVertical className="h-3.5 w-3.5" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align={isOwn ? 'start' : 'end'}>
                      <DropdownMenuItem
                        className="text-destructive focus:text-destructive"
                        onClick={() => onDeleteMessage(msg.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5 mr-2" />
                        Delete Message
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </div>
            </div>
          );
        })}

        {/* Typing indicator */}
        {typingUsers.length > 0 && (
          <div className="flex justify-start">
            <div className="bg-muted text-muted-foreground rounded-2xl rounded-bl-md px-4 py-2 text-xs italic">
              Someone is typing…
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>
    </ScrollArea>
  );
}
