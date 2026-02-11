import { BarChart3, TrendingUp, TrendingDown, Minus, CheckCircle2, AlertTriangle, Clock } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useTranslation } from 'react-i18next';
import { useOILIndicators, getHealthLevel, getHealthColor } from '@/hooks/useOILIndicators';
import { Progress } from '@/components/ui/progress';

interface TaskStats {
  completed: number;
  total: number;
  blocked: number;
  overdue: number;
}

interface Props {
  stats: TaskStats;
}

const trendIcon = (trend: string) => {
  if (trend === 'up') return <TrendingUp className="h-4 w-4 text-emerald-500" />;
  if (trend === 'down') return <TrendingDown className="h-4 w-4 text-destructive" />;
  return <Minus className="h-4 w-4 text-muted-foreground" />;
};

const indicatorLabel: Record<string, string> = {
  ExecutionHealth: 'oil.pulse.executionHealth',
  DeliveryRisk: 'oil.pulse.deliveryRisk',
  GoalProgress: 'oil.pulse.goalProgress',
};

export default function StepWeekGlance({ stats }: Props) {
  const { t } = useTranslation();
  const { coreIndicators, isLoading } = useOILIndicators();

  return (
    <Card className="border-border bg-card">
      <CardHeader>
        <CardTitle className="text-foreground flex items-center gap-2">
          <BarChart3 className="h-5 w-5 text-primary" />
          {t('workboard.checkinPage.weekGlance')}
        </CardTitle>
        <CardDescription>{t('workboard.checkinPage.weekGlanceDesc')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* OIL Indicators */}
        <div className="space-y-3">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            {t('workboard.checkinPage.healthIndicators')}
          </p>
          {isLoading ? (
            <div className="text-sm text-muted-foreground">{t('common.loading')}</div>
          ) : (
            coreIndicators.map(ind => {
              const level = getHealthLevel(ind.score);
              const color = getHealthColor(level);
              return (
                <div key={ind.indicator_key} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-foreground">{t(indicatorLabel[ind.indicator_key] || ind.indicator_key)}</span>
                    <div className="flex items-center gap-1.5">
                      {trendIcon(ind.trend)}
                      <span className={color}>{ind.score}/100</span>
                    </div>
                  </div>
                  <Progress value={ind.score} className="h-1.5" />
                </div>
              );
            })
          )}
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-2 gap-3">
          <div className="flex items-center gap-2 p-3 rounded-lg bg-emerald-500/10">
            <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
            <div>
              <p className="text-lg font-bold text-foreground">{stats.completed}</p>
              <p className="text-xs text-muted-foreground">{t('workboard.checkinPage.statsCompleted')}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 p-3 rounded-lg bg-primary/10">
            <Clock className="h-4 w-4 text-primary shrink-0" />
            <div>
              <p className="text-lg font-bold text-foreground">{stats.total}</p>
              <p className="text-xs text-muted-foreground">{t('workboard.checkinPage.statsTotal')}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10">
            <AlertTriangle className="h-4 w-4 text-destructive shrink-0" />
            <div>
              <p className="text-lg font-bold text-foreground">{stats.overdue}</p>
              <p className="text-xs text-muted-foreground">{t('workboard.checkinPage.statsOverdue')}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 p-3 rounded-lg bg-yellow-500/10">
            <AlertTriangle className="h-4 w-4 text-yellow-500 shrink-0" />
            <div>
              <p className="text-lg font-bold text-foreground">{stats.blocked}</p>
              <p className="text-xs text-muted-foreground">{t('workboard.checkinPage.statsBlocked')}</p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
