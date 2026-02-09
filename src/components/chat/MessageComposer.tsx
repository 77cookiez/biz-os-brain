import { useState, useCallback, KeyboardEvent } from 'react';
import { Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';

interface MessageComposerProps {
  onSend: (text: string) => Promise<boolean>;
  disabled?: boolean;
}

export function MessageComposer({ onSend, disabled }: MessageComposerProps) {
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);

  const handleSend = useCallback(async () => {
    if (!text.trim() || sending) return;
    setSending(true);
    const ok = await onSend(text.trim());
    if (ok) setText('');
    setSending(false);
  }, [text, onSend, sending]);

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="border-t border-border p-3 bg-card">
      <div className="flex items-end gap-2 max-w-2xl mx-auto">
        <Textarea
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type a message…"
          disabled={disabled || sending}
          className="min-h-[44px] max-h-[120px] resize-none bg-background"
          rows={1}
        />
        <Button
          size="icon"
          onClick={handleSend}
          disabled={!text.trim() || sending || disabled}
          className="shrink-0 h-[44px] w-[44px]"
        >
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
