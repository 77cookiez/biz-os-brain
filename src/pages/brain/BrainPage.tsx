import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import {
  Sparkles,
  Loader2,
  User,
  Mic,
  MicOff,
  Target,
  Lightbulb,
  BookOpen,
  Eye,
  ArrowRight,
  ArrowUp,
  CheckCircle2,
  XCircle,
  RefreshCw,
  FileText,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import ReactMarkdown from 'react-markdown';
import { useTranslation } from 'react-i18next';
import { useBrainChat } from '@/hooks/useBrainChat';
import { useBrainCommand } from '@/contexts/BrainCommandContext';
import { useVoiceInput } from '@/hooks/useVoiceInput';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useBrainWorkboardIntegration } from '@/hooks/useBrainWorkboardIntegration';
import { createMeaningObject, MeaningJsonV1Schema } from '@/lib/meaningObject';
import type { MeaningJsonV1 } from '@/lib/meaningObject';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { OILPulseStrip } from '@/components/oil/OILPulseStrip';
import { OILInsightCard } from '@/components/oil/OILInsightCard';
import { useSmartCapabilities } from '@/hooks/useSmartCapabilities';

// ─── Smart Suggestions Logic ───
interface SmartSuggestion {
  key: string;
  icon: React.ElementType;
}

function useSmartSuggestions(): SmartSuggestion[] {
  const { businessContext, currentWorkspace } = useWorkspace();
  const [taskCounts, setTaskCounts] = useState({ overdue: 0, blocked: 0, total: 0, goals: 0 });

  useEffect(() => {
    if (!currentWorkspace) return;
    const today = new Date().toISOString().split('T')[0];

    Promise.all([
      supabase.from('tasks').select('id', { count: 'exact', head: true })
        .eq('workspace_id', currentWorkspace.id)
        .in('status', ['backlog', 'planned', 'in_progress', 'blocked'])
        .lt('due_date', today).not('due_date', 'is', null),
      supabase.from('tasks').select('id', { count: 'exact', head: true })
        .eq('workspace_id', currentWorkspace.id).eq('status', 'blocked'),
      supabase.from('goals').select('id', { count: 'exact', head: true })
        .eq('workspace_id', currentWorkspace.id),
    ]).then(([overdue, blocked, goals]) => {
      setTaskCounts({
        overdue: overdue.count || 0,
        blocked: blocked.count || 0,
        total: (overdue.count || 0) + (blocked.count || 0),
        goals: goals.count || 0,
      });
    });
  }, [currentWorkspace?.id]);

  return useMemo(() => {
    const pool: SmartSuggestion[] = [];
    if (!businessContext?.setup_completed) pool.push({ key: 'brainPage.suggestion.setupBusiness', icon: Target });
    if (taskCounts.overdue > 0) pool.push({ key: 'brainPage.suggestion.reprioritize', icon: RefreshCw });
    if (taskCounts.blocked > 0) pool.push({ key: 'brainPage.suggestion.unblock', icon: XCircle });
    if (taskCounts.goals === 0) pool.push({ key: 'brainPage.suggestion.setGoals', icon: Target });
    const hour = new Date().getHours();
    if (hour < 12) pool.push({ key: 'brainPage.suggestion.planDay', icon: BookOpen });
    else pool.push({ key: 'brainPage.suggestion.reviewProgress', icon: Eye });
    pool.push({ key: 'brainPage.suggestion.strategize', icon: Lightbulb });
    return pool.slice(0, 3);
  }, [businessContext, taskCounts]);
}

// ─── Main Page ───
export default function BrainPage() {
  const { t } = useTranslation();
  const { messages, isLoading, sendMessage } = useBrainChat();
  const [input, setInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const suggestions = useSmartSuggestions();
  const capabilities = useSmartCapabilities();
  const navigate = useNavigate();
  const { currentWorkspace } = useWorkspace();
  const { user } = useAuth();
  const { currentLanguage } = useLanguage();
  const { isWorkboardInstalled, installWorkboard, createTasksFromPlan } = useBrainWorkboardIntegration();
  const { pendingMessage, setPendingMessage } = useBrainCommand();

  // Auto-send pending message from command bar
  const pendingHandled = useRef(false);
  useEffect(() => {
    if (pendingMessage && !pendingHandled.current) {
      pendingHandled.current = true;
      const msg = pendingMessage;
      setPendingMessage(null);
      setInput('');
      sendMessage(msg);
    }
  }, [pendingMessage, setPendingMessage, sendMessage]);

  // Voice input
  const { isListening, isSupported, confidence, startListening, stopListening } = useVoiceInput({
    onResult: (transcript) => setInput(prev => prev + transcript),
    onInterimResult: () => {},
  });

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  // Auto-resize textarea
  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = 'auto';
    ta.style.height = Math.min(ta.scrollHeight, 200) + 'px';
  }, [input]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;
    const message = input;
    setInput('');
    if (isListening) stopListening();
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
    await sendMessage(message);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleSuggestionClick = (key: string) => {
    const text = t(key);
    setInput(text);
    textareaRef.current?.focus();
  };

  const handleCapabilityClick = (promptKey: string, action: string) => {
    sendMessage(t(promptKey), action);
  };

  const hasMessages = messages.length > 0;

  // Extract meaning blocks
  const extractMeaningBlocks = useCallback((content: string): MeaningJsonV1[] => {
    const regex = /```ULL_MEANING_V1\s*([\s\S]*?)```/g;
    const blocks: MeaningJsonV1[] = [];
    let match;
    while ((match = regex.exec(content)) !== null) {
      try {
        const parsed = JSON.parse(match[1].trim());
        const items = Array.isArray(parsed) ? parsed : [parsed];
        for (const item of items) {
          const validated = MeaningJsonV1Schema.safeParse(item);
          if (validated.success) blocks.push(validated.data);
        }
      } catch { /* skip */ }
    }
    return blocks;
  }, []);

  const handleSendToWorkboard = useCallback(async () => {
    const lastAssistant = [...messages].reverse().find(m => m.role === 'assistant');
    if (!lastAssistant || !currentWorkspace || !user) return;
    const meaningBlocks = extractMeaningBlocks(lastAssistant.content);
    if (meaningBlocks.length === 0) { toast.success(t('brain.noted')); return; }
    if (!isWorkboardInstalled) await installWorkboard();
    setIsSending(true);
    try {
      const items = [];
      for (const meaning of meaningBlocks) {
        const meaningId = await createMeaningObject({
          workspaceId: currentWorkspace.id, createdBy: user.id,
          type: meaning.type as any, sourceLang: 'en', meaningJson: meaning,
        });
        if (meaning.type === 'TASK') {
          items.push({ type: 'task' as const, title: meaning.subject, description: meaning.description, status: 'backlog' as const, meaning_object_id: meaningId });
        }
      }
      if (items.length > 0) {
        await createTasksFromPlan(items as any);
        navigate('/apps/workboard/backlog');
      }
    } finally { setIsSending(false); }
  }, [messages, currentWorkspace, user, extractMeaningBlocks, isWorkboardInstalled, installWorkboard, createTasksFromPlan, navigate, t]);

  const handleSaveAsDraft = useCallback(() => { toast.success(t('brain.noted')); }, [t]);

  const cleanContent = (content: string) => content.replace(/```ULL_MEANING_V1[\s\S]*?```/g, '').trim();

  return (
    <div className="flex flex-col h-[calc(100dvh-3.5rem-2rem)] max-w-3xl mx-auto w-full">
      {/* ── Messages area ── */}
      <div className="flex-1 overflow-y-auto">
        {!hasMessages ? (
          /* ── Empty / Welcome State ── */
          <div className="flex flex-col items-center justify-center min-h-full px-4 py-6">
            {/* Logo + greeting */}
            <div className="text-center mb-8">
              <div className="h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
                <Sparkles className="h-6 w-6 text-primary" />
              </div>
              <h1 className="text-xl sm:text-2xl font-semibold text-foreground">
                {t('brainPage.empty.title')}
              </h1>
              <p className="text-sm text-muted-foreground mt-1.5 max-w-sm mx-auto">
                {t('brainPage.empty.subtitle')}
              </p>
            </div>

            {/* Capability cards grid — 1 col mobile, 3 col desktop */}
            <div className="w-full max-w-xl grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-3 mb-6">
              {capabilities.map((cap) => (
                <button
                  key={cap.id}
                  onClick={() => handleCapabilityClick(cap.promptKey, cap.action)}
                  className="flex items-center gap-3 sm:flex-col sm:items-center sm:text-center rounded-xl border border-border bg-card p-3 sm:p-4 text-left hover:bg-secondary/50 hover:border-primary/30 transition-all group"
                >
                  <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <cap.icon className="h-4 w-4 text-primary" />
                  </div>
                  <div className="flex-1 sm:flex-none min-w-0">
                    <span className="text-sm font-medium text-foreground block truncate">
                      {t(cap.titleKey)}
                    </span>
                    <span className="text-xs text-muted-foreground hidden sm:block mt-0.5">
                      {t(cap.descKey)}
                    </span>
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0 opacity-40 sm:hidden" />
                </button>
              ))}
            </div>

            {/* OIL components */}
            <div className="w-full max-w-xl space-y-3">
              <OILPulseStrip />
              <OILInsightCard />
            </div>
          </div>
        ) : (
          /* ── Chat messages ── */
          <div className="px-4 py-4 space-y-5">
            {messages.map((message, i) => (
              <div key={i}>
                {/* Message row */}
                <div className={cn(
                  "flex gap-2.5",
                  message.role === 'user' ? 'justify-end' : 'justify-start'
                )}>
                  {/* AI avatar */}
                  {message.role === 'assistant' && (
                    <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                      <Sparkles className="h-3.5 w-3.5 text-primary" />
                    </div>
                  )}

                  {/* Bubble */}
                  <div className={cn(
                    "rounded-2xl px-3.5 py-2.5 max-w-[85%] sm:max-w-[75%]",
                    message.role === 'user'
                      ? 'bg-primary text-primary-foreground rounded-br-md'
                      : 'bg-card border border-border rounded-bl-md'
                  )}>
                    {message.role === 'user' ? (
                      <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                    ) : (
                      <div dir="auto" className="prose prose-sm max-w-none text-foreground leading-relaxed [&_h1]:text-foreground [&_h2]:text-foreground [&_h3]:text-foreground [&_p]:text-foreground [&_p]:leading-relaxed [&_li]:text-foreground [&_strong]:text-foreground [&_a]:text-primary [&_code]:text-primary [&_blockquote]:border-primary/30 [&_blockquote]:text-muted-foreground [&_ul]:space-y-0.5 [&_ol]:space-y-0.5">
                        <ReactMarkdown>{cleanContent(message.content)}</ReactMarkdown>
                      </div>
                    )}
                  </div>

                  {/* User avatar */}
                  {message.role === 'user' && (
                    <div className="h-7 w-7 rounded-full bg-secondary flex items-center justify-center shrink-0 mt-0.5">
                      <User className="h-3.5 w-3.5 text-secondary-foreground" />
                    </div>
                  )}
                </div>

                {/* Decision Panel after last assistant message */}
                {message.role === 'assistant' && i === messages.length - 1 && message.content.includes('ULL_MEANING_V1') && (
                  <div className="mt-2 ml-9 sm:ml-10 flex flex-wrap gap-2">
                    <Button variant="outline" size="sm" className="text-xs h-8" onClick={handleSaveAsDraft} disabled={isSending}>
                      <FileText className="h-3 w-3 mr-1" />
                      {t('brainPage.decisionPanel.saveAsDraft')}
                    </Button>
                    <Button variant="outline" size="sm" className="text-xs h-8" onClick={handleSendToWorkboard} disabled={isSending}>
                      {isSending ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <ArrowRight className="h-3 w-3 mr-1" />}
                      {t('brainPage.decisionPanel.sendToWorkboard')}
                    </Button>
                  </div>
                )}
              </div>
            ))}

            {/* Thinking indicator */}
            {isLoading && messages[messages.length - 1]?.role !== 'assistant' && (
              <div className="flex gap-2.5">
                <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <Sparkles className="h-3.5 w-3.5 text-primary" />
                </div>
                <div className="bg-card border border-border rounded-2xl rounded-bl-md px-3.5 py-2.5">
                  <div className="flex items-center gap-1.5">
                    <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground animate-bounce [animation-delay:0ms]" />
                    <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground animate-bounce [animation-delay:150ms]" />
                    <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground animate-bounce [animation-delay:300ms]" />
                  </div>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* ── Bottom pinned area ── */}
      <div className="shrink-0 px-3 sm:px-4 pb-3 pt-2 space-y-2.5">
        {/* Suggestion chips — only when empty */}
        {!hasMessages && suggestions.length > 0 && (
          <div className="flex gap-2 overflow-x-auto scrollbar-hide">
            {suggestions.map((s) => (
              <button
                key={s.key}
                onClick={() => handleSuggestionClick(s.key)}
                className="flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-xs text-secondary-foreground hover:bg-secondary hover:border-primary/30 transition-all shrink-0 whitespace-nowrap"
              >
                <s.icon className="h-3 w-3 text-primary" />
                <span>{t(s.key)}</span>
              </button>
            ))}
          </div>
        )}

        {/* Voice indicator */}
        {isListening && (
          <div className="flex items-center gap-2 px-1 text-xs">
            <span className="flex items-center gap-1 text-destructive">
              <span className="h-2 w-2 rounded-full bg-destructive animate-pulse" />
              {t('brainPage.voice.listening')}
            </span>
            <Badge variant="outline" className="text-[10px]">
              {t(`brainPage.voice.confidence.${confidence}`)}
            </Badge>
          </div>
        )}

        {/* Input bar — ChatGPT style */}
        <div className="relative flex items-end rounded-2xl border border-border bg-card shadow-sm focus-within:border-primary/50 focus-within:shadow-md transition-all">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={t('brainPage.inputPlaceholder')}
            rows={1}
            className="w-full min-h-[44px] max-h-[200px] bg-transparent text-foreground resize-none py-3 pl-4 pr-20 focus:outline-none placeholder:text-muted-foreground text-sm leading-relaxed"
          />

          <div className="absolute bottom-1.5 right-1.5 flex items-center gap-1">
            {isSupported && (
              <button
                onClick={isListening ? stopListening : startListening}
                className={cn(
                  "h-8 w-8 rounded-full flex items-center justify-center transition-colors",
                  isListening
                    ? "bg-destructive text-destructive-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-secondary"
                )}
              >
                {isListening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
              </button>
            )}

            <button
              onClick={handleSend}
              disabled={!input.trim() || isLoading}
              className={cn(
                "h-8 w-8 rounded-full flex items-center justify-center transition-colors",
                input.trim() && !isLoading
                  ? "bg-primary text-primary-foreground hover:bg-primary/90"
                  : "bg-muted text-muted-foreground cursor-not-allowed"
              )}
            >
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowUp className="h-4 w-4" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
