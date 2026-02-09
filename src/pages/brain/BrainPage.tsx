import { useState, useRef, useEffect, useMemo } from 'react';
import {
  Sparkles,
  Send,
  Loader2,
  User,
  Mic,
  MicOff,
  Brain,
  Target,
  Lightbulb,
  BookOpen,
  FileText,
  Eye,
  ArrowRight,
  CheckCircle2,
  XCircle,
  RefreshCw,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import ReactMarkdown from 'react-markdown';
import { useTranslation } from 'react-i18next';
import { useBrainChat } from '@/hooks/useBrainChat';
import { useVoiceInput } from '@/hooks/useVoiceInput';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { supabase } from '@/integrations/supabase/client';

// ─── Smart Suggestions Logic ───
interface SmartSuggestion {
  key: string;
  icon: React.ElementType;
}

function useSmartSuggestions(): SmartSuggestion[] {
  const { businessContext, installedApps, currentWorkspace } = useWorkspace();
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

    if (!businessContext?.setup_completed) {
      pool.push({ key: 'brainPage.suggestion.setupBusiness', icon: Target });
    }

    if (taskCounts.overdue > 0) {
      pool.push({ key: 'brainPage.suggestion.reprioritize', icon: RefreshCw });
    }

    if (taskCounts.blocked > 0) {
      pool.push({ key: 'brainPage.suggestion.unblock', icon: XCircle });
    }

    if (taskCounts.goals === 0) {
      pool.push({ key: 'brainPage.suggestion.setGoals', icon: Target });
    }

    const hour = new Date().getHours();
    if (hour < 12) {
      pool.push({ key: 'brainPage.suggestion.planDay', icon: BookOpen });
    } else {
      pool.push({ key: 'brainPage.suggestion.reviewProgress', icon: Eye });
    }

    pool.push({ key: 'brainPage.suggestion.strategize', icon: Lightbulb });

    return pool.slice(0, 3);
  }, [businessContext, taskCounts]);
}

// ─── Decision Panel ───
function DecisionPanel({ content, t }: { content: string; t: (k: string) => string }) {
  // Only show decision panel when the response contains structured suggestions
  const hasMeaning = content.includes('ULL_MEANING_V1');
  if (!hasMeaning) return null;

  return (
    <Card className="border-primary/20 bg-card">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center gap-2">
          <FileText className="h-4 w-4 text-primary" />
          <span className="text-sm font-medium text-foreground">{t('brainPage.decisionPanel.title')}</span>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" className="text-xs">
            <FileText className="h-3 w-3 mr-1" />
            {t('brainPage.decisionPanel.saveAsDraft')}
          </Button>
          <Button variant="outline" size="sm" className="text-xs">
            <Eye className="h-3 w-3 mr-1" />
            {t('brainPage.decisionPanel.dryRun')}
          </Button>
          <Button variant="outline" size="sm" className="text-xs">
            <ArrowRight className="h-3 w-3 mr-1" />
            {t('brainPage.decisionPanel.sendToWorkboard')}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Context Strip ───
function ContextStrip({ t }: { t: (k: string) => string }) {
  const { businessContext, installedApps } = useWorkspace();
  const activeApps = installedApps.filter(a => a.is_active);

  return (
    <div className="flex items-center gap-3 px-4 py-2 rounded-lg bg-secondary/50 border border-border text-xs text-muted-foreground overflow-x-auto">
      <div className="flex items-center gap-1.5 shrink-0">
        <div className={`h-2 w-2 rounded-full ${businessContext?.setup_completed ? 'bg-emerald-500' : 'bg-amber-500'}`} />
        <span>{t('brainPage.context.status')}</span>
      </div>
      <span className="text-border">|</span>
      <div className="flex items-center gap-1.5 shrink-0">
        <span>{activeApps.length} {t('brainPage.context.appsConnected')}</span>
      </div>
      <span className="text-border">|</span>
      <div className="flex items-center gap-1.5 shrink-0">
        <CheckCircle2 className="h-3 w-3 text-primary" />
        <span>{t('brainPage.context.dataFresh')}</span>
      </div>
    </div>
  );
}

// ─── Empty State ───
function EmptyState({ t }: { t: (k: string) => string }) {
  const capabilities = [
    { icon: Brain, titleKey: 'brainPage.capability.advisor', descKey: 'brainPage.capability.advisorDesc' },
    { icon: Target, titleKey: 'brainPage.capability.planning', descKey: 'brainPage.capability.planningDesc' },
    { icon: Lightbulb, titleKey: 'brainPage.capability.coaching', descKey: 'brainPage.capability.coachingDesc' },
  ];

  return (
    <div className="flex flex-col items-center justify-center py-16 space-y-8">
      <div className="text-center space-y-3">
        <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto brain-glow">
          <Sparkles className="h-8 w-8 text-primary" />
        </div>
        <h2 className="text-xl font-semibold text-foreground">{t('brainPage.empty.title')}</h2>
        <p className="text-sm text-muted-foreground max-w-md">{t('brainPage.empty.subtitle')}</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 w-full max-w-2xl">
        {capabilities.map((cap) => (
          <Card key={cap.titleKey} className="border-border bg-card hover:border-primary/30 transition-colors">
            <CardContent className="p-5 text-center space-y-2">
              <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center mx-auto">
                <cap.icon className="h-5 w-5 text-primary" />
              </div>
              <h3 className="text-sm font-medium text-foreground">{t(cap.titleKey)}</h3>
              <p className="text-xs text-muted-foreground">{t(cap.descKey)}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

// ─── Main Page ───
export default function BrainPage() {
  const { t } = useTranslation();
  const { messages, isLoading, sendMessage } = useBrainChat();
  const [input, setInput] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const suggestions = useSmartSuggestions();

  // Voice input
  const { isListening, isSupported, confidence, startListening, stopListening } = useVoiceInput({
    onResult: (transcript) => {
      setInput(prev => prev + transcript);
    },
    onInterimResult: (interim) => {
      // Could show interim in a separate UI element if desired
    },
  });

  // Auto-scroll
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;
    const message = input;
    setInput('');
    if (isListening) stopListening();
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
  };

  const hasMessages = messages.length > 0;

  // Strip ULL_MEANING blocks from displayed content
  const cleanContent = (content: string) => {
    return content.replace(/```ULL_MEANING_V1[\s\S]*?```/g, '').trim();
  };

  return (
    <div className="flex flex-col h-[calc(100vh-3.5rem)] max-w-4xl mx-auto">
      {/* Header + Context Strip */}
      <div className="space-y-3 pt-4 pb-3 px-1">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center brain-glow">
            <Sparkles className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-foreground">{t('brainPage.title')}</h1>
            <p className="text-xs text-muted-foreground">{t('brainPage.subtitle')}</p>
          </div>
        </div>
        <ContextStrip t={t} />
      </div>

      {/* Smart Quick Actions */}
      {!hasMessages && suggestions.length > 0 && (
        <div className="flex gap-2 px-1 pb-3 overflow-x-auto">
          {suggestions.map((s) => (
            <button
              key={s.key}
              onClick={() => handleSuggestionClick(s.key)}
              className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-xs text-secondary-foreground hover:bg-secondary hover:border-primary/30 transition-all shrink-0 group"
            >
              <s.icon className="h-3.5 w-3.5 text-primary" />
              <span>{t(s.key)}</span>
              <ArrowRight className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
            </button>
          ))}
        </div>
      )}

      {/* Reasoning Stream */}
      <ScrollArea className="flex-1 px-1" ref={scrollRef}>
        {!hasMessages ? (
          <EmptyState t={t} />
        ) : (
          <div className="space-y-4 pb-4">
            {messages.map((message, i) => (
              <div key={i}>
                <div className={`flex gap-3 ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  {message.role === 'assistant' && (
                    <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 mt-1">
                      <Sparkles className="h-4 w-4 text-primary" />
                    </div>
                  )}

                  <div
                    className={`max-w-[85%] rounded-xl px-4 py-3 ${
                      message.role === 'user'
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-card border border-border'
                    }`}
                  >
                    {message.role === 'user' ? (
                      <p className="text-sm">{message.content}</p>
                    ) : (
                      <div className="prose prose-sm max-w-none text-foreground [&_h1]:text-foreground [&_h2]:text-foreground [&_h3]:text-foreground [&_p]:text-foreground [&_li]:text-foreground [&_strong]:text-foreground [&_a]:text-primary [&_code]:text-primary [&_blockquote]:border-primary/30 [&_blockquote]:text-muted-foreground">
                        <ReactMarkdown>{cleanContent(message.content)}</ReactMarkdown>
                      </div>
                    )}
                  </div>

                  {message.role === 'user' && (
                    <div className="h-8 w-8 rounded-lg bg-secondary flex items-center justify-center shrink-0 mt-1">
                      <User className="h-4 w-4 text-secondary-foreground" />
                    </div>
                  )}
                </div>

                {/* Decision Panel after assistant messages */}
                {message.role === 'assistant' && i === messages.length - 1 && (
                  <div className="mt-3 ml-11">
                    <DecisionPanel content={message.content} t={t} />
                  </div>
                )}
              </div>
            ))}

            {isLoading && messages[messages.length - 1]?.role !== 'assistant' && (
              <div className="flex gap-3">
                <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <Sparkles className="h-4 w-4 text-primary" />
                </div>
                <div className="bg-card border border-border rounded-xl px-4 py-3">
                  <div className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">{t('brainPage.thinking')}</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </ScrollArea>

      {/* Input Bar */}
      <div className="border-t border-border p-4">
        {/* Voice confidence indicator */}
        {isListening && (
          <div className="flex items-center gap-2 mb-2 text-xs">
            <span className="flex items-center gap-1 text-destructive">
              <span className="h-2 w-2 rounded-full bg-destructive animate-pulse" />
              {t('brainPage.voice.listening')}
            </span>
            <Badge variant="outline" className="text-[10px]">
              {t(`brainPage.voice.confidence.${confidence}`)}
            </Badge>
          </div>
        )}

        <div className="flex gap-2 items-end">
          {/* Mic button */}
          {isSupported && (
            <Button
              variant={isListening ? 'destructive' : 'outline'}
              size="icon"
              className="h-[44px] w-[44px] shrink-0"
              onClick={isListening ? stopListening : startListening}
            >
              {isListening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
            </Button>
          )}

          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={t('brainPage.inputPlaceholder')}
            className="min-h-[44px] max-h-[120px] bg-input border-border text-foreground resize-none flex-1"
            rows={1}
          />

          <Button
            onClick={handleSend}
            disabled={!input.trim() || isLoading}
            size="icon"
            className="h-[44px] w-[44px] shrink-0"
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
