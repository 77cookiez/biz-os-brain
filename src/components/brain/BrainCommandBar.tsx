import { useEffect, useCallback } from 'react';
import { Send, Loader2, Sparkles, Mic, MicOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useVoiceInput } from '@/hooks/useVoiceInput';
import { cn } from '@/lib/utils';
import { useBrainCommand } from '@/contexts/BrainCommandContext';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

export function BrainCommandBar() {
  const { t } = useTranslation();
  const { input, setInput, inputRef, isLoading, setPendingMessage } = useBrainCommand();
  const navigate = useNavigate();

  // Voice input
  const { isListening, isSupported, startListening, stopListening } = useVoiceInput({
    onResult: (transcript) => {
      setInput(input + transcript);
    },
  });

  // Cmd+K / Ctrl+K shortcut
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [inputRef]);

  const handleSend = useCallback(() => {
    if (!input.trim() || isLoading) return;
    const text = input.trim();
    setInput('');
    setPendingMessage(text);
    navigate('/brain');
  }, [input, isLoading, setInput, setPendingMessage, navigate]);

  return (
    <div className="relative flex-1 max-w-xl">
      <div className="flex items-center gap-2 rounded-lg bg-muted px-3 py-1.5 transition-colors focus-within:ring-1 focus-within:ring-primary/50">
        <Sparkles className="h-4 w-4 shrink-0 text-primary" />
        <Input
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSend()}
          placeholder={t('topbar.askBrain')}
          className="flex-1 bg-transparent border-0 h-8 text-sm text-foreground placeholder:text-muted-foreground focus-visible:ring-0 focus-visible:ring-offset-0"
        />
        {input.trim() ? (
          <Button
            size="icon"
            variant="ghost"
            className="h-6 w-6 shrink-0"
            onClick={handleSend}
            disabled={isLoading}
          >
            {isLoading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Send className="h-3.5 w-3.5" />
            )}
          </Button>
        ) : (
          <div className="flex items-center gap-1">
            {isSupported && (
              <button
                onClick={isListening ? stopListening : startListening}
                className={cn(
                  "h-6 w-6 rounded-full flex items-center justify-center transition-colors",
                  isListening
                    ? "bg-destructive text-destructive-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-secondary"
                )}
              >
                {isListening ? <MicOff className="h-3.5 w-3.5" /> : <Mic className="h-3.5 w-3.5" />}
              </button>
            )}
            <kbd className="hidden sm:inline-flex items-center gap-1 rounded border border-border bg-background px-1.5 py-0.5 text-[10px] text-muted-foreground">
              ⌘K
            </kbd>
          </div>
        )}
      </div>
    </div>
  );
}
