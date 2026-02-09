import { useEffect, useCallback } from 'react';
import { Send, Loader2, Sparkles, X, Check, Pencil } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useBrainCommand } from '@/contexts/BrainCommandContext';
import { useTranslation } from 'react-i18next';
import ReactMarkdown from 'react-markdown';

export function BrainCommandBar() {
  const { t } = useTranslation();
  const {
    input, setInput, inputRef,
    messages, isLoading, sendMessage, clearMessages,
    showDraft, setShowDraft,
  } = useBrainCommand();

  // Cmd+K / Ctrl+K shortcut
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
      }
      if (e.key === 'Escape' && showDraft) {
        setShowDraft(false);
        clearMessages();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [showDraft, setShowDraft, clearMessages, inputRef]);

  const handleSend = useCallback(async () => {
    if (!input.trim() || isLoading) return;
    const text = input;
    setInput('');
    setShowDraft(true);
    await sendMessage(text);
  }, [input, isLoading, setInput, setShowDraft, sendMessage]);

  const handleConfirm = () => {
    // For now, just close the draft panel
    // TODO: Parse AI response and write to database
    setShowDraft(false);
    clearMessages();
  };

  const handleEdit = () => {
    // Put the last user message back in the input
    const lastUserMsg = [...messages].reverse().find(m => m.role === 'user');
    if (lastUserMsg) setInput(lastUserMsg.content);
    setShowDraft(false);
    clearMessages();
    inputRef.current?.focus();
  };

  const lastAssistantMsg = [...messages].reverse().find(m => m.role === 'assistant');

  return (
    <div className="relative flex-1 max-w-xl">
      {/* Input */}
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
        {input.trim() && (
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
        )}
        {!input.trim() && (
          <kbd className="hidden sm:inline-flex items-center gap-1 rounded border border-border bg-background px-1.5 py-0.5 text-[10px] text-muted-foreground">
            ⌘K
          </kbd>
        )}
      </div>

      {/* Draft Response Panel */}
      {showDraft && (isLoading || lastAssistantMsg) && (
        <div className="absolute top-full left-0 right-0 mt-2 z-50 rounded-xl border border-border bg-card shadow-lg overflow-hidden max-w-xl">
          <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-secondary/30">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              {t('brain.draftTitle')}
            </span>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={() => { setShowDraft(false); clearMessages(); }}
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>

          <ScrollArea className="max-h-[300px]">
            <div className="p-4">
              {isLoading && !lastAssistantMsg && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span className="text-sm">{t('common.loading')}</span>
                </div>
              )}
              {lastAssistantMsg && (
                <div className="prose prose-sm max-w-none text-foreground">
                  <ReactMarkdown>{lastAssistantMsg.content}</ReactMarkdown>
                </div>
              )}
            </div>
          </ScrollArea>

          {lastAssistantMsg && !isLoading && (
            <div className="flex items-center gap-2 px-4 py-3 border-t border-border bg-secondary/20">
              <Button size="sm" onClick={handleConfirm} className="gap-1.5">
                <Check className="h-3.5 w-3.5" />
                {t('brain.confirm')}
              </Button>
              <Button size="sm" variant="outline" onClick={handleEdit} className="gap-1.5">
                <Pencil className="h-3.5 w-3.5" />
                {t('brain.editDraft')}
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
