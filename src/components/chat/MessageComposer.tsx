import { useState, useCallback, useRef, useEffect, KeyboardEvent } from 'react';
import { Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface MessageComposerProps {
  onSend: (text: string) => Promise<boolean>;
  onTyping?: () => void;
  disabled?: boolean;
}

export function MessageComposer({ onSend, onTyping, disabled }: MessageComposerProps) {
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-grow textarea
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 120) + 'px';
  }, [text]);

  const handleSend = useCallback(async () => {
    if (!text.trim() || sending) return;
    setSending(true);
    const ok = await onSend(text.trim());
    if (ok) setText('');
    setSending(false);
    textareaRef.current?.focus();
  }, [text, onSend, sending]);

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setText(e.target.value);
    onTyping?.();
  };

  const canSend = text.trim().length > 0 && !sending && !disabled;

  return (
    <div className="border-t border-border px-3 py-2.5 bg-card/80 backdrop-blur-sm">
      <div className="flex items-end gap-2 max-w-2xl mx-auto">
        <textarea
          ref={textareaRef}
          value={text}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder="Write in your language…"
          disabled={disabled || sending}
          rows={1}
          className={cn(
            "flex-1 resize-none rounded-xl border border-input bg-background px-3.5 py-2.5 text-sm",
            "placeholder:text-muted-foreground/60",
            "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
            "disabled:cursor-not-allowed disabled:opacity-50",
            "min-h-[40px] max-h-[120px] leading-relaxed"
          )}
        />
        <Button
          size="icon"
          onClick={handleSend}
          disabled={!canSend}
          className={cn(
            "shrink-0 h-10 w-10 rounded-full transition-all",
            canSend ? "scale-100 opacity-100" : "scale-95 opacity-50"
          )}
        >
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
