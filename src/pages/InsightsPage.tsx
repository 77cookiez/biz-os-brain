import { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import {
  Loader2, Lightbulb, CheckCircle2, ShieldAlert,
  MessageSquare, Target, AlertTriangle, Sparkles, Clock,
  ListChecks, TrendingUp, Archive
} from 'lucide-react';
import { useInsights } from '@/hooks/useInsights';
import { ULLText } from '@/components/ull/ULLText';
import { InsightsNarrative } from '@/components/insights/InsightsNarrative';

export default function InsightsPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { data, loading, error, weekStart, weekEnd } = useInsights();

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto max-w-3xl py-10 text-center">
        <p className="text-destructive">{error}</p>
      </div>
    );
  }

  if (!data) return null;

  const { weekly, blockers, decisions } = data;

  const isEmpty =
    weekly.tasks_created === 0 &&
    weekly.tasks_completed === 0 &&
    blockers.blocked_tasks.length === 0 &&
    blockers.stale_tasks.length === 0 &&
    decisions.tasks_created_from_chat.length === 0 &&
    decisions.goals_created_from_chat.length === 0;

  // Sort blockers: blocked first, then stale by days_inactive desc, take top 3
  const allBlockers = [
    ...blockers.blocked_tasks.map(b => ({
      ...b,
      type: 'blocked' as const,
      sort_priority: 0,
      days_inactive: 0,
    })),
    ...blockers.stale_tasks.map(b => ({
      ...b,
      type: 'stale' as const,
      reason_code: 'stale',
      sort_priority: 1,
    })),
  ]
    .sort((a, b) => {
      if (a.sort_priority !== b.sort_priority) return a.sort_priority - b.sort_priority;
      return (b.days_inactive || 0) - (a.days_inactive || 0);
    })
    .slice(0, 3);

  const allDecisions = [
    ...decisions.tasks_created_from_chat.map(d => ({ ...d, type: 'task' as const })),
    ...decisions.goals_created_from_chat.map(d => ({ ...d, type: 'goal' as const, task_id: d.goal_id })),
  ];

  return (
    <div className="mx-auto max-w-3xl space-y-6 pb-8">
      {/* Header */}
      <div className="pt-2 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
            <Lightbulb className="h-5 w-5 text-primary" />
            {t('insights.title')}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {t('insights.subtitle', { start: weekStart, end: weekEnd })}
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5"
          onClick={() => navigate('/insights/archive')}
        >
          <Archive className="h-3.5 w-3.5" />
          {t('digest.archive', 'Archive')}
        </Button>
      </div>

      {/* Empty State */}
      {isEmpty && (
        <Card className="border-border bg-card">
          <CardContent className="py-16 text-center">
            <div className="bg-muted/50 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
              <Lightbulb className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="text-base font-medium text-foreground mb-1">
              {t('insights.emptyTitle', 'Nothing to report yet')}
            </h3>
            <p className="text-sm text-muted-foreground max-w-sm mx-auto">
              {t('insights.empty')}
            </p>
          </CardContent>
        </Card>
      )}

      {!isEmpty && (
        <>
          {/* Brain Narrative — Part 4 */}
          <InsightsNarrative data={data} weekStart={weekStart} weekEnd={weekEnd} />

          {/* Section A — This Week at a Glance */}
          <Card className="border-border bg-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                <ListChecks className="h-4 w-4 text-primary" />
                {t('insights.glanceTitle', 'This Week at a Glance')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2.5">
                <GlanceBullet
                  icon={<TrendingUp className="h-3.5 w-3.5 text-primary" />}
                  count={weekly.tasks_created}
                  label={t('insights.glanceTasksCreated', '{{count}} tasks created', { count: weekly.tasks_created })}
                />
                <GlanceBullet
                  icon={<CheckCircle2 className="h-3.5 w-3.5 text-green-500" />}
                  count={weekly.tasks_completed}
                  label={t('insights.glanceTasksCompleted', '{{count}} tasks completed', { count: weekly.tasks_completed })}
                />
                {weekly.tasks_blocked > 0 && (
                  <GlanceBullet
                    icon={<ShieldAlert className="h-3.5 w-3.5 text-orange-500" />}
                    count={weekly.tasks_blocked}
                    label={t('insights.glanceTasksBlocked', '{{count}} tasks blocked', { count: weekly.tasks_blocked })}
                  />
                )}
                {weekly.tasks_from_chat > 0 && (
                  <GlanceBullet
                    icon={<MessageSquare className="h-3.5 w-3.5 text-blue-500" />}
                    count={weekly.tasks_from_chat}
                    label={t('insights.glanceTasksFromChat', '{{count}} tasks came from team conversations', { count: weekly.tasks_from_chat })}
                  />
                )}
                {weekly.goals_created > 0 && (
                  <GlanceBullet
                    icon={<Target className="h-3.5 w-3.5 text-primary" />}
                    count={weekly.goals_created}
                    label={t('insights.glanceGoalsCreated', '{{count}} goals were created', { count: weekly.goals_created })}
                  />
                )}
              </ul>
            </CardContent>
          </Card>

          {/* Section B — Top Blockers */}
          <Card className="border-border bg-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-orange-500" />
                {t('insights.topBlockers', 'Top Blockers')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {allBlockers.length === 0 ? (
                <div className="py-6 text-center">
                  <CheckCircle2 className="h-6 w-6 text-green-500 mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">
                    {t('insights.noBlockers', 'No blockers detected this week.')}
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {allBlockers.map((b, idx) => (
                    <div
                      key={b.task_id}
                      className="flex items-start gap-3 p-3 rounded-lg bg-secondary/50"
                    >
                      <span className="text-xs font-bold text-muted-foreground mt-0.5 w-5 text-center shrink-0">
                        {idx + 1}
                      </span>
                      <div className="flex-1 min-w-0">
                        <ULLText
                          meaningId={b.meaning_object_id}
                          fallback={b.task_id}
                          className="text-sm font-medium text-foreground block truncate"
                        />
                        <div className="flex items-center gap-2 mt-1.5">
                          {b.type === 'blocked' ? (
                            <Badge variant="destructive" className="text-xs gap-1">
                              <ShieldAlert className="h-3 w-3" />
                              {t('insights.statusBlocked')}
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-xs gap-1 text-orange-500 border-orange-500/30">
                              <Clock className="h-3 w-3" />
                              {t('insights.statusStale', { days: (b as any).days_inactive })}
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Section C — Decisions from Conversations */}
          {allDecisions.length > 0 && (
            <Card className="border-border bg-card">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                  <MessageSquare className="h-4 w-4 text-primary" />
                  {t('insights.decisionsTitle', 'Decisions from Conversations')}
                </CardTitle>
                <p className="text-xs text-muted-foreground mt-1">
                  {t('insights.decisionsDesc', 'Decisions that emerged from team discussions')}
                </p>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {allDecisions.map(d => (
                    <div
                      key={d.task_id}
                      className="flex items-center gap-3 p-3 rounded-lg bg-secondary/50"
                    >
                      {d.type === 'task' ? (
                        <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />
                      ) : (
                        <Target className="h-4 w-4 text-primary shrink-0" />
                      )}
                      <div className="flex-1 min-w-0">
                        <ULLText
                          meaningId={d.meaning_object_id}
                          fallback={d.task_id}
                          className="text-sm text-foreground block truncate"
                        />
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <Badge variant="outline" className="text-xs gap-1">
                          <MessageSquare className="h-3 w-3" />
                          {t('insights.fromChat', 'From chat')}
                        </Badge>
                        <Badge variant="secondary" className="text-xs">
                          {d.type === 'task' ? t('insights.typeTask') : t('insights.typeGoal')}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}

function GlanceBullet({
  icon,
  count,
  label,
}: {
  icon: React.ReactNode;
  count: number;
  label: string;
}) {
  if (count === 0) return null;
  return (
    <li className="flex items-center gap-3 text-sm text-foreground">
      <span className="shrink-0">{icon}</span>
      <span>{label}</span>
    </li>
  );
}
