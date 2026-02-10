import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, BarChart3, ShieldAlert, MessageSquare, Target, CheckCircle2, AlertTriangle, Lightbulb } from 'lucide-react';
import { useInsights } from '@/hooks/useInsights';

export default function InsightsPage() {
  const { t } = useTranslation();
  const { weeklySummary, blockers, decisions, loading, error, weekStart, weekEnd } = useInsights();

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

  const isEmpty =
    weeklySummary.tasksCreated === 0 &&
    weeklySummary.tasksCompleted === 0 &&
    blockers.length === 0 &&
    decisions.length === 0;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {/* Header */}
      <div className="pt-2">
        <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
          <Lightbulb className="h-5 w-5 text-primary" />
          {t('insights.title')}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          {t('insights.subtitle', { start: weekStart, end: weekEnd })}
        </p>
      </div>

      {/* Empty State */}
      {isEmpty && (
        <Card className="border-border bg-card">
          <CardContent className="py-12 text-center">
            <Lightbulb className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground">{t('insights.empty')}</p>
          </CardContent>
        </Card>
      )}

      {/* SECTION 1: Weekly Summary */}
      {!isEmpty && (
        <Card className="border-border bg-card">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-primary" />
              {t('insights.weeklySummary')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <SummaryRow
              icon={<CheckCircle2 className="h-4 w-4 text-primary" />}
              text={t('insights.tasksCreated', { count: weeklySummary.tasksCreated })}
            />
            <SummaryRow
              icon={<CheckCircle2 className="h-4 w-4 text-green-500" />}
              text={t('insights.tasksCompleted', { count: weeklySummary.tasksCompleted })}
            />
            {weeklySummary.tasksBlocked > 0 && (
              <SummaryRow
                icon={<ShieldAlert className="h-4 w-4 text-orange-500" />}
                text={t('insights.tasksBlockedSummary', { count: weeklySummary.tasksBlocked })}
              />
            )}
            {weeklySummary.tasksFromChat > 0 && (
              <SummaryRow
                icon={<MessageSquare className="h-4 w-4 text-blue-500" />}
                text={t('insights.tasksFromChat', { count: weeklySummary.tasksFromChat })}
              />
            )}
            {weeklySummary.goalsCreated > 0 && (
              <SummaryRow
                icon={<Target className="h-4 w-4 text-primary" />}
                text={t('insights.goalsCreated', { count: weeklySummary.goalsCreated })}
              />
            )}
            {weeklySummary.goalsFromChat > 0 && (
              <SummaryRow
                icon={<MessageSquare className="h-4 w-4 text-blue-500" />}
                text={t('insights.goalsFromChat', { count: weeklySummary.goalsFromChat })}
              />
            )}
          </CardContent>
        </Card>
      )}

      {/* SECTION 2: Blockers */}
      {blockers.length > 0 && (
        <Card className="border-border bg-card">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-orange-500" />
              {t('insights.blockers')}
            </CardTitle>
            <p className="text-xs text-muted-foreground mt-1">
              {t('insights.blockersSubtitle', { count: blockers.length })}
            </p>
          </CardHeader>
          <CardContent className="space-y-2">
            {blockers.map(b => (
              <div key={b.id} className="flex items-start gap-3 p-3 rounded-lg bg-secondary/50">
                <ShieldAlert className="h-4 w-4 text-orange-500 mt-0.5 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-foreground truncate">{b.title}</p>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    <Badge variant="outline" className="text-xs">
                      {b.status === 'blocked' ? t('insights.statusBlocked') : t('insights.statusStale', { days: b.days_inactive })}
                    </Badge>
                    {b.discussed_in_chat && (
                      <Badge variant="secondary" className="text-xs">
                        <MessageSquare className="h-3 w-3 mr-1" />
                        {t('insights.discussedInChat')}
                      </Badge>
                    )}
                  </div>
                  {b.blocked_reason && (
                    <p className="text-xs text-muted-foreground mt-1">{b.blocked_reason}</p>
                  )}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* SECTION 3: Decisions from Conversations */}
      {decisions.length > 0 && (
        <Card className="border-border bg-card">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-primary" />
              {t('insights.decisions')}
            </CardTitle>
            <p className="text-xs text-muted-foreground mt-1">
              {t('insights.decisionsSubtitle', { count: decisions.length })}
            </p>
          </CardHeader>
          <CardContent className="space-y-2">
            {decisions.map(d => (
              <div key={d.id} className="flex items-center gap-3 p-3 rounded-lg bg-secondary/50">
                {d.type === 'task' ? (
                  <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />
                ) : (
                  <Target className="h-4 w-4 text-primary shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-foreground truncate">{d.title}</p>
                </div>
                <Badge variant="outline" className="text-xs shrink-0">
                  {d.type === 'task' ? t('insights.typeTask') : t('insights.typeGoal')}
                </Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function SummaryRow({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="flex items-center gap-3 p-3 rounded-lg bg-secondary/50">
      <div className="shrink-0">{icon}</div>
      <p className="text-sm text-foreground">{text}</p>
    </div>
  );
}
