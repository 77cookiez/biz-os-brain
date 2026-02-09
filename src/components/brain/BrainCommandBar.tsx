import { useEffect, useCallback, useState } from 'react';
import { Send, Loader2, Sparkles, FileOutput, Pencil } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { useBrainCommand } from '@/contexts/BrainCommandContext';
import { useTranslation } from 'react-i18next';
import ReactMarkdown from 'react-markdown';
import { useBrainWorkboardIntegration } from '@/hooks/useBrainWorkboardIntegration';
import { WorkboardInstallPrompt } from '@/components/brain/WorkboardInstallPrompt';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

export function BrainCommandBar() {
  const { t } = useTranslation();
  const {
    input, setInput, inputRef,
    messages, isLoading, sendMessage, clearMessages,
    showDraft, setShowDraft,
  } = useBrainCommand();
  const { isWorkboardInstalled, installWorkboard, createTasksFromPlan } = useBrainWorkboardIntegration();
  const navigate = useNavigate();
  const [showInstallPrompt, setShowInstallPrompt] = useState(false);
  const [pendingPlanContent, setPendingPlanContent] = useState<string | null>(null);
  const [sentDraftFingerprint, setSentDraftFingerprint] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);

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

  const handleSend = useCallback(async () => {
    if (!input.trim() || isLoading) return;
    const text = input;
    setInput('');
    setShowDraft(true);
    setShowInstallPrompt(false);
    setSentDraftFingerprint(null); // Reset dedup for new conversation
    await sendMessage(text);
  }, [input, isLoading, setInput, setShowDraft, sendMessage]);

  // Parse AI response to extract actionable tasks
  const extractTasksFromResponse = useCallback((content: string) => {
    const lines = content.split('\n');
    const tasks: { title: string; description?: string }[] = [];
    for (const line of lines) {
      // Match numbered or bulleted task-like lines
      const match = line.match(/^[\s]*[-•*]\s+(.+)|^[\s]*\d+[.)]\s+(.+)/);
      if (match) {
        const title = (match[1] || match[2]).replace(/\*\*/g, '').trim();
        if (title.length > 5 && title.length < 200) {
          tasks.push({ title });
        }
      }
    }
    return tasks;
  }, []);

  // Generate a fingerprint from task titles for dedup
  const generateFingerprint = useCallback((tasks: { title: string }[]) => {
    return tasks.map(t => t.title).sort().join('|');
  }, []);

  const handleConfirm = useCallback(async () => {
    if (isSending) return;

    const lastAssistant = [...messages].reverse().find(m => m.role === 'assistant');
    if (!lastAssistant) {
      setShowDraft(false);
      clearMessages();
      return;
    }

    const tasks = extractTasksFromResponse(lastAssistant.content);
    
    if (tasks.length === 0) {
      setShowDraft(false);
      clearMessages();
      toast.success(t('brain.noted'));
      return;
    }

    // Dedup: check if we already sent this exact set of drafts
    const fingerprint = generateFingerprint(tasks);
    if (fingerprint === sentDraftFingerprint) {
      toast.info(t('brain.draftsAlreadySent'));
      return;
    }

    if (!isWorkboardInstalled) {
      setPendingPlanContent(lastAssistant.content);
      setShowInstallPrompt(true);
      return;
    }

    setIsSending(true);
    try {
      const items = tasks.map(t => ({
        type: 'task' as const,
        title: t.title,
        description: t.description,
        status: 'backlog' as const,
      }));
      await createTasksFromPlan(items);
      setSentDraftFingerprint(fingerprint);
      setShowDraft(false);
      clearMessages();
      navigate('/apps/workboard/today');
    } finally {
      setIsSending(false);
    }
  }, [messages, isWorkboardInstalled, createTasksFromPlan, clearMessages, setShowDraft, navigate, extractTasksFromResponse, isSending, sentDraftFingerprint, generateFingerprint]);

  const handleInstallAndResume = useCallback(async () => {
    await installWorkboard();
    setShowInstallPrompt(false);

    if (pendingPlanContent) {
      const tasks = extractTasksFromResponse(pendingPlanContent);
      const fingerprint = generateFingerprint(tasks);
      const items = tasks.map(t => ({
        type: 'task' as const,
        title: t.title,
        status: 'backlog' as const,
      }));
      await createTasksFromPlan(items);
      setSentDraftFingerprint(fingerprint);
      setPendingPlanContent(null);
      setShowDraft(false);
      clearMessages();
      navigate('/apps/workboard/today');
    }
  }, [installWorkboard, pendingPlanContent, extractTasksFromResponse, createTasksFromPlan, setShowDraft, clearMessages, navigate, generateFingerprint]);

  const handleEdit = () => {
    const lastUserMsg = [...messages].reverse().find(m => m.role === 'user');
    if (lastUserMsg) setInput(lastUserMsg.content);
    setShowDraft(false);
    setShowInstallPrompt(false);
    clearMessages();
    inputRef.current?.focus();
  };

  const handleSheetClose = (open: boolean) => {
    if (!open) {
      setShowDraft(false);
      setShowInstallPrompt(false);
      clearMessages();
    }
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

      {/* Draft Response Sheet */}
      <Sheet open={showDraft && (isLoading || !!lastAssistantMsg)} onOpenChange={handleSheetClose}>
        <SheetContent side="right" className="w-full sm:max-w-[480px] flex flex-col p-0">
          <SheetHeader className="px-6 py-4 border-b border-border shrink-0">
            <SheetTitle className="text-sm font-medium uppercase tracking-wider">
              {t('brain.draftTitle')}
            </SheetTitle>
            <SheetDescription className="sr-only">
              {t('brain.draftTitle')}
            </SheetDescription>
          </SheetHeader>

          <ScrollArea className="flex-1 min-h-0">
            <div className="p-6">
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
            <div className="px-6 py-4 border-t border-border shrink-0 space-y-3">
              {showInstallPrompt && (
                <WorkboardInstallPrompt
                  onInstall={handleInstallAndResume}
                  onDismiss={() => { setShowInstallPrompt(false); setPendingPlanContent(null); }}
                />
              )}
              {!showInstallPrompt && (
                <div className="flex items-center gap-2">
                  <Button size="sm" onClick={handleConfirm} disabled={isSending} className="gap-1.5">
                    <FileOutput className="h-3.5 w-3.5" />
                    {t('brain.sendAsDraft')}
                  </Button>
                  <Button size="sm" variant="outline" onClick={handleEdit} className="gap-1.5">
                    <Pencil className="h-3.5 w-3.5" />
                    {t('brain.editDraft')}
                  </Button>
                </div>
              )}
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
