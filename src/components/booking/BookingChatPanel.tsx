import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { MessageSquare, Send, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { ULLText } from '@/components/ull/ULLText';
import { useChatMessages } from '@/hooks/useChatMessages';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';

interface BookingChatPanelProps {
  threadId: string | null;
  className?: string;
  onBack?: () => void;
  showHeader?: boolean;
}

/**
 * Inline chat panel for booking quote conversations.
 * Reuses core chat infrastructure (useChatMessages) but with a
 * compact UI suitable for embedding in quote detail views.
 */
export function BookingChatPanel({ threadId, className, onBack, showHeader = true }: BookingChatPanelProps) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { messages, loading, sendMessage } = useChatMessages(threadId);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);

  const handleSend = useCallback(async () => {
    if (!text.trim() || sending) return;
    setSending(true);
    await sendMessage(text.trim());
    setText('');
    setSending(false);
  }, [text, sending, sendMessage]);

  if (!threadId) {
    return (
      <div className={cn('flex flex-col items-center justify-center p-6 text-muted-foreground', className)}>
        <MessageSquare className="h-8 w-8 mb-2" />
        <p className="text-sm">{t('booking.chat.noThread')}</p>
      </div>
    );
  }

  return (
    <div className={cn('flex flex-col h-full border border-border rounded-lg bg-background', className)}>
      {showHeader && (
        <div className="flex items-center gap-2 p-3 border-b border-border">
          {onBack && (
            <Button variant="ghost" size="icon" onClick={onBack}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
          )}
          <MessageSquare className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium text-foreground">{t('booking.chat.title')}</span>
        </div>
      )}

      <ScrollArea className="flex-1 p-3">
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => <Skeleton key={i} className="h-10 w-3/4" />)}
          </div>
        ) : messages.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">{t('booking.chat.empty')}</p>
        ) : (
          <div className="space-y-3">
            {messages.map(msg => {
              const isOwn = msg.sender_user_id === user?.id;
              const textContent = (msg.meaning_json as any)?.description || '';
              return (
                <div key={msg.id} className={cn('flex', isOwn ? 'justify-end' : 'justify-start')}>
                  <div className={cn(
                    'max-w-[80%] rounded-lg px-3 py-2 text-sm',
                    isOwn
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-foreground'
                  )}>
                    {!isOwn && msg.sender_name && (
                      <p className="text-xs font-medium mb-1 opacity-70">{msg.sender_name}</p>
                    )}
                    <ULLText meaningId={msg.meaning_object_id} fallback={textContent} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </ScrollArea>

      <div className="flex items-center gap-2 p-3 border-t border-border">
        <Input
          placeholder={t('booking.chat.placeholder')}
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
          className="flex-1"
        />
        <Button size="icon" onClick={handleSend} disabled={!text.trim() || sending}>
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
