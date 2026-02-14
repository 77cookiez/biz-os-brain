import { useEffect, useState, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Brain, ChevronDown, ChevronUp, ArrowRight, Shield, Sparkles } from 'lucide-react';
import { useGrowthInsights, GrowthInsights } from '@/hooks/useGrowthInsights';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { useBrainCommand } from '@/contexts/BrainCommandContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { buildDraftInsights, DraftInsight, DraftAction } from '@/lib/brainDrafts';
import { buildCommandPrompt } from '@/lib/brainDraftToCommand';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';

/* ── localStorage helpers (SSR-safe) ──────────────── */

function utcDay(): string {
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
}

function viewDayKey(wid: string) {
  return `brain_draft_view_${wid}_${utcDay()}`;
}

function isViewedToday(wid: string): boolean {
  if (typeof window === 'undefined') return false;
  return !!localStorage.getItem(viewDayKey(wid));
}

function markViewedToday(wid: string) {
  if (typeof window !== 'undefined') localStorage.setItem(viewDayKey(wid), '1');
}

/* ── Severity config ─────────────────────────────── */

const severityConfig = {
  info: { variant: 'secondary' as const, className: '' },
  warning: { variant: 'outline' as const, className: 'border-yellow-500/50 text-yellow-600 dark:text-yellow-400' },
  critical: { variant: 'destructive' as const, className: '' },
};

/* ── Main Panel ──────────────────────────────────── */

export function BrainDraftPanel() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { currentWorkspace } = useWorkspace();
  const wid = currentWorkspace?.id;
  const { insights, isLoading } = useGrowthInsights();
  const { setPendingMessage } = useBrainCommand();
  const { currentLanguage } = useLanguage();
  const [expanded, setExpanded] = useState(false);

  const drafts = useMemo(() => {
    if (!insights) return [];
    return buildDraftInsights(insights);
  }, [insights]);

  // Log view once per UTC day
  useEffect(() => {
    if (!wid || drafts.length === 0) return;
    if (isViewedToday(wid)) return;
    markViewedToday(wid);

    const severityCounts = drafts.reduce(
      (acc, d) => {
        acc[d.severity] = (acc[d.severity] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>,
    );

    supabase.rpc('log_growth_event', {
      _workspace_id: wid,
      _event_type: 'BRAIN_DRAFT_VIEW',
      _meta: { draft_count: drafts.length, severity_counts: severityCounts } as any,
    });
  }, [wid, drafts]);

  const logActionClick = useCallback(
    (analyticsCode: string, draftId: string) => {
      if (!wid) return;
      supabase.rpc('log_growth_event', {
        _workspace_id: wid,
        _event_type: 'BRAIN_DRAFT_ACTION_CLICK',
        _meta: { analyticsCode, draftId } as any,
      });
    },
    [wid],
  );

  const handleAction = useCallback(
    (action: DraftAction, draftId: string) => {
      logActionClick(action.analyticsCode, draftId);
      navigate(action.path);
    },
    [logActionClick, navigate],
  );

  const handleSendToCommand = useCallback(
    (draft: DraftInsight) => {
      if (!insights || !wid) return;
      const locale = currentLanguage.code === 'ar' ? 'ar' : 'en';
      const prompt = buildCommandPrompt(draft, insights, locale);

      // Log the event
      supabase.rpc('log_growth_event', {
        _workspace_id: wid,
        _event_type: 'BRAIN_DRAFT_TO_COMMAND',
        _meta: { draftId: draft.id, analyticsCode: `COMMAND_${draft.id.toUpperCase()}` } as any,
      });

      // Send to Brain via command bar pattern
      setPendingMessage(prompt);
      navigate('/brain');
    },
    [insights, wid, currentLanguage, setPendingMessage, navigate],
  );

  if (isLoading || !insights || drafts.length === 0) return null;

  const visible = expanded ? drafts : drafts.slice(0, 3);
  const hasMore = drafts.length > 3;

  return (
    <Card className="border-primary/20 bg-primary/5">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Brain className="h-4 w-4 text-primary" />
          {t('brainDraft.title')}
        </CardTitle>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Shield className="h-3 w-3" />
          {t('brainDraft.subtitle')}
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        {visible.map((draft) => (
          <DraftCard
            key={draft.id}
            draft={draft}
            onAction={handleAction}
            onSendToCommand={handleSendToCommand}
          />
        ))}

        {hasMore && (
          <button
            onClick={() => setExpanded(!expanded)}
            className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 transition-colors w-full justify-center pt-1"
          >
            {expanded ? (
              <>
                <ChevronUp className="h-3 w-3" />
                {t('brainDraft.showLess')}
              </>
            ) : (
              <>
                <ChevronDown className="h-3 w-3" />
                {t('brainDraft.showMore', { count: drafts.length - 3 })}
              </>
            )}
          </button>
        )}
      </CardContent>
    </Card>
  );
}

/* ── Sub-component: DraftCard ────────────────────── */

function DraftCard({
  draft,
  onAction,
  onSendToCommand,
}: {
  draft: DraftInsight;
  onAction: (action: DraftAction, draftId: string) => void;
  onSendToCommand: (draft: DraftInsight) => void;
}) {
  const { t } = useTranslation();
  const config = severityConfig[draft.severity];

  return (
    <div className="rounded-lg border border-border p-3 space-y-2 bg-background/50">
      <div className="flex items-start gap-2">
        <Badge variant={config.variant} className={cn('text-[10px] shrink-0 mt-0.5', config.className)}>
          {t(`brainDraft.severity.${draft.severity}`)}
        </Badge>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-foreground">{t(draft.titleKey)}</p>
          <p className="text-xs text-muted-foreground mt-0.5">{t(draft.bodyKey)}</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {draft.actions.map((action) => (
          <Button
            key={action.analyticsCode}
            variant="outline"
            size="sm"
            className="h-7 text-xs"
            onClick={() => onAction(action, draft.id)}
          >
            {t(action.labelKey)}
            <ArrowRight className="h-3 w-3 ml-1" />
          </Button>
        ))}
        <Button
          variant="outline"
          size="sm"
          className="h-7 text-xs border-primary/30 text-primary hover:bg-primary/10"
          onClick={() => onSendToCommand(draft)}
        >
          <Sparkles className="h-3 w-3 mr-1" />
          {t('brainDraft.actions.sendToCommand')}
        </Button>
      </div>
    </div>
  );
}
