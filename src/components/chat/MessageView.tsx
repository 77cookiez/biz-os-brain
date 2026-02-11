import { useRef, useEffect, useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ULLText } from '@/components/ull/ULLText';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import { MoreVertical, Trash2, CheckCheck, ListPlus, CircleCheck } from 'lucide-react';
import { useChatTaskLinks } from '@/hooks/useChatTaskLinks';
import { useNavigate } from 'react-router-dom';
import type { ChatMessage } from '@/hooks/useChatMessages';

interface MessageViewProps {
  messages: ChatMessage[];
  loading: boolean;
  typingUsers?: string[];
  onDeleteMessage?: (id: string) => void;
  onCreateTaskFromMessage?: (message: ChatMessage) => void;
  isAdmin?: boolean;
  showWelcome?: boolean;
}

function extractFallback(meaningJson?: Record<string, unknown>): string {
  if (!meaningJson) return '…';
  return (meaningJson.description as string) || (meaningJson.subject as string) || '…';
}

/** Group consecutive messages by same sender within 2 minutes */
function shouldShowMeta(msg: ChatMessage, prev?: ChatMessage): boolean {
  if (!prev) return true;
  if (prev.sender_user_id !== msg.sender_user_id) return true;
  const gap = new Date(msg.created_at).getTime() - new Date(prev.created_at).getTime();
  return gap > 2 * 60 * 1000;
}

export function MessageView({ messages, loading, typingUsers = [], onDeleteMessage, onCreateTaskFromMessage, isAdmin, showWelcome }: MessageViewProps) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const navigate = useNavigate();
  const bottomRef = useRef<HTMLDivElement>(null);
  const [createdTaskMsgIds, setCreatedTaskMsgIds] = useState<Set<string>>(new Set());

  // Chat → Task awareness: detect which messages have linked tasks
  const messageIds = useMemo(() => messages.map(m => m.id), [messages]);
  const { links: taskLinks } = useChatTaskLinks(messageIds);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length, typingUsers.length]);

  const handleCreateTask = (msg: ChatMessage) => {
    if (onCreateTaskFromMessage) {
      onCreateTaskFromMessage(msg);
      setCreatedTaskMsgIds(prev => new Set(prev).add(msg.id));
    }
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
        <div className="flex items-center gap-2">
          <div className="h-1.5 w-1.5 rounded-full bg-muted-foreground/40 animate-bounce [animation-delay:-0.3s]" />
          <div className="h-1.5 w-1.5 rounded-full bg-muted-foreground/40 animate-bounce [animation-delay:-0.15s]" />
          <div className="h-1.5 w-1.5 rounded-full bg-muted-foreground/40 animate-bounce" />
        </div>
      </div>
    );
  }

  return (
    <ScrollArea className="flex-1">
      <div className="flex flex-col px-4 py-3 max-w-2xl mx-auto">
        {/* Welcome banner */}
        {showWelcome && messages.length === 0 && (
          <div className="flex justify-center my-12">
            <div className="bg-muted/40 rounded-2xl px-6 py-5 text-center max-w-xs">
              <p className="text-base font-semibold text-foreground">👋 {t('chat.welcome')}</p>
              <p className="text-sm text-muted-foreground mt-2 leading-relaxed whitespace-pre-line">
                {t('chat.welcomeSubtitle')}
              </p>
            </div>
          </div>
        )}

        {messages.map((msg, i) => {
          const isOwn = msg.sender_user_id === user?.id;
          const fallback = extractFallback(msg.meaning_json);
          const prev = messages[i - 1];
          const showMeta = shouldShowMeta(msg, prev);
          const isFirst = showMeta;
          const isLast = !messages[i + 1] || shouldShowMeta(messages[i + 1], msg);
          const canCreateTask = isOwn && onCreateTaskFromMessage && !createdTaskMsgIds.has(msg.id) && !taskLinks.has(msg.id);
          const hasActions = (isAdmin || isOwn) && onDeleteMessage;
          const linkedTask = taskLinks.get(msg.id);

          return (
            <div
              key={msg.id}
              className={cn(
                'flex group',
                isOwn ? 'justify-end' : 'justify-start',
                showMeta ? 'mt-3' : 'mt-0.5'
              )}
            >
              <div className={cn('relative', isOwn ? 'max-w-[70%]' : 'max-w-[70%]')}>
                {/* Sender name for others — only on first of group */}
                {!isOwn && msg.sender_name && isFirst && (
                  <p className="text-[11px] font-medium text-muted-foreground mb-1 ml-3">
                    {msg.sender_name}
                  </p>
                )}
                <div
                  className={cn(
                    'relative px-3.5 py-2 text-sm leading-relaxed',
                    isOwn
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-foreground',
                    // Rounded corners — WhatsApp style grouping
                    isOwn
                      ? cn(
                          'rounded-2xl',
                          isFirst && 'rounded-tr-lg',
                          !isFirst && 'rounded-tr-lg',
                          isLast && 'rounded-br-md',
                        )
                      : cn(
                          'rounded-2xl',
                          isFirst && 'rounded-tl-lg',
                          !isFirst && 'rounded-tl-lg',
                          isLast && 'rounded-bl-md',
                        )
                  )}
                >
                  <ULLText
                    meaningId={msg.meaning_object_id}
                    fallback={fallback}
                  />
                  {/* Timestamp + read status — inline at bottom-right */}
                  <span className={cn(
                    "float-right ml-3 mt-1 flex items-center gap-0.5 text-[10px] leading-none select-none",
                    isOwn ? "text-primary-foreground/50" : "text-muted-foreground/70"
                  )}>
                    {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    {isOwn && (
                      <CheckCheck className="h-3.5 w-3.5 ml-0.5" />
                    )}
                  </span>
                </div>

                {/* Action menu — hover to reveal */}
                {(hasActions || canCreateTask) && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className={cn(
                          'h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity absolute top-1',
                          isOwn ? '-left-7' : '-right-7'
                        )}
                      >
                        <MoreVertical className="h-3.5 w-3.5 text-muted-foreground" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align={isOwn ? 'start' : 'end'} className="min-w-[140px]">
                      {canCreateTask && (
                        <DropdownMenuItem
                          className="text-xs"
                          onClick={() => handleCreateTask(msg)}
                        >
                          <ListPlus className="h-3.5 w-3.5 mr-2" />
                          {t('chat.createTask')}
                        </DropdownMenuItem>
                      )}
                      {hasActions && onDeleteMessage && (
                        <DropdownMenuItem
                          className="text-destructive focus:text-destructive text-xs"
                          onClick={() => onDeleteMessage(msg.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5 mr-2" />
                          {t('chat.deleteMessage')}
                        </DropdownMenuItem>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}

                {/* Awareness tag: "Task created" */}
                {linkedTask && (
                  <button
                    onClick={() => navigate(`/apps/workboard/backlog?task=${linkedTask.taskId}`)}
                    className={cn(
                      "flex items-center gap-1 mt-1 px-2 py-0.5 rounded-md text-[10px] text-muted-foreground hover:text-foreground hover:bg-secondary/60 transition-colors w-fit",
                      isOwn ? "ml-auto" : ""
                    )}
                  >
                    <CircleCheck className="h-3 w-3 text-emerald-500" />
                    <span>{t('chat.taskCreated')}</span>
                  </button>
                )}
              </div>
            </div>
          );
        })}

        {/* Typing indicator — animated dots */}
        {typingUsers.length > 0 && (
          <div className="flex justify-start mt-2">
            <div className="bg-muted rounded-2xl rounded-bl-md px-4 py-2.5 flex items-center gap-1">
              <div className="h-1.5 w-1.5 rounded-full bg-muted-foreground/60 animate-bounce [animation-delay:-0.3s]" />
              <div className="h-1.5 w-1.5 rounded-full bg-muted-foreground/60 animate-bounce [animation-delay:-0.15s]" />
              <div className="h-1.5 w-1.5 rounded-full bg-muted-foreground/60 animate-bounce" />
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>
    </ScrollArea>
  );
}
