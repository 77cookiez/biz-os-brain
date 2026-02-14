import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useGrowthInsights, GrowthInsights, GrowthReason } from '@/hooks/useGrowthInsights';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { TrendingUp, ShieldCheck, AlertTriangle, ArrowUpCircle } from 'lucide-react';
import { useRef, useEffect } from 'react';
import { toast } from 'sonner';

function getMonthKey(workspaceId: string): string {
  const now = new Date();
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, '0');
  return `growth_nudge_${workspaceId}_${y}_${m}`;
}

type Status = 'healthy' | 'at_risk' | 'critical';

function deriveStatus(insights: GrowthInsights): Status {
  if (insights.recommended_action === 'upgrade') return 'critical';
  if (insights.recommended_action === 'optimize') return 'at_risk';
  return 'healthy';
}

const STATUS_CONFIG: Record<Status, { icon: typeof ShieldCheck; variant: 'default' | 'secondary' | 'destructive'; colorClass: string }> = {
  healthy: { icon: ShieldCheck, variant: 'default', colorClass: 'text-green-600 dark:text-green-400' },
  at_risk: { icon: AlertTriangle, variant: 'secondary', colorClass: 'text-yellow-600 dark:text-yellow-400' },
  critical: { icon: ArrowUpCircle, variant: 'destructive', colorClass: 'text-destructive' },
};

export function GrowthAdvisorPanel() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { insights, isLoading } = useGrowthInsights();
  const { currentWorkspace } = useWorkspace();
  const nudgedRef = useRef(false);

  // One-time monthly nudge for upgrade
  useEffect(() => {
    if (!insights || !currentWorkspace || nudgedRef.current) return;
    if (insights.recommended_action !== 'upgrade') return;

    const key = getMonthKey(currentWorkspace.id);
    if (typeof window !== 'undefined' && localStorage.getItem(key)) return;

    nudgedRef.current = true;
    if (typeof window !== 'undefined') localStorage.setItem(key, '1');
    toast.warning(t('growth.nudgeUpgrade', 'Your workspace is approaching its limits. Consider upgrading your plan.'), {
      duration: 8000,
    });
  }, [insights, currentWorkspace, t]);

  if (isLoading) {
    return (
      <Card>
        <CardHeader><Skeleton className="h-5 w-40" /></CardHeader>
        <CardContent className="space-y-3">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
        </CardContent>
      </Card>
    );
  }

  if (!insights) return null;

  const status = deriveStatus(insights);
  const cfg = STATUS_CONFIG[status];
  const StatusIcon = cfg.icon;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
          <TrendingUp className="h-4 w-4" />
          {t('growth.title', 'Growth Advisor')}
        </CardTitle>
        <Badge variant={cfg.variant} className="text-xs">
          {t(`growth.status.${status}`)}
        </Badge>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Recommendation */}
        <div className="flex items-start gap-3">
          <StatusIcon className={`h-5 w-5 mt-0.5 shrink-0 ${cfg.colorClass}`} />
          <p className="text-sm text-foreground">
            {t(`growth.recommendation.${insights.recommended_action}`)}
          </p>
        </div>

        {/* Reasons */}
        {insights.reasons && insights.reasons.length > 0 && (
          <div className="mt-1 space-y-2">
            <p className="text-sm font-medium text-muted-foreground">
              {t('growth.reasons.title', 'Why we recommend this')}
            </p>
            <ul className={`list-disc list-inside text-sm space-y-1 ${status === 'critical' ? 'text-destructive' : 'text-muted-foreground'}`}>
              {insights.reasons.map((r: GrowthReason, idx: number) => {
                const key = `growth.reasons.${r.code}`;
                const translated = (t as Function)(key, { count: String(r.count ?? '') });
                return <li key={idx}>{translated}</li>;
              })}
            </ul>
          </div>
        )}

        {/* Projections (only for monthly metrics) */}
        {(insights.projected_end_of_month_usage.bookings > 0 || insights.projected_end_of_month_usage.quotes > 0) && (
          <div className="grid grid-cols-2 gap-3">
            <ProjectionCard
              label={t('growth.projectedBookings', 'Projected Bookings')}
              projected={insights.projected_end_of_month_usage.bookings}
              limit={insights.limits.bookings_limit}
            />
            <ProjectionCard
              label={t('growth.projectedQuotes', 'Projected Quotes')}
              projected={insights.projected_end_of_month_usage.quotes}
              limit={insights.limits.quotes_limit}
            />
          </div>
        )}

        {/* Confidence + hits */}
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>{t('growth.confidence', 'Confidence')}: {insights.confidence_score}%</span>
          {insights.limit_hits_last_30_days > 0 && (
            <span>{t('growth.limitHits', 'Limit hits (30d)')}: {insights.limit_hits_last_30_days}</span>
          )}
        </div>

        {/* CTA */}
        {insights.recommended_action === 'upgrade' && (
          <Button
            className="w-full"
            onClick={() => navigate('/apps/booking/billing')}
          >
            {t('growth.ctaUpgrade', 'Upgrade Plan')}
          </Button>
        )}
        {insights.recommended_action === 'optimize' && (
          <Button
            variant="outline"
            className="w-full"
            onClick={() => navigate('/apps/booking/billing')}
          >
            {t('growth.ctaOptimize', 'View Usage Details')}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

function ProjectionCard({ label, projected, limit }: { label: string; projected: number; limit: number | null }) {
  const { t } = useTranslation();
  const isOver = limit !== null && projected >= limit;

  return (
    <div className={`rounded-lg border p-3 ${isOver ? 'border-destructive/50 bg-destructive/5' : 'border-border'}`}>
      <p className="text-xs text-muted-foreground mb-1">{label}</p>
      <p className={`text-lg font-bold ${isOver ? 'text-destructive' : 'text-foreground'}`}>
        {projected}
        {limit !== null && (
          <span className="text-xs font-normal text-muted-foreground"> / {limit}</span>
        )}
        {limit === null && (
          <span className="text-xs font-normal text-muted-foreground"> ({t('usage.unlimited', 'Unlimited')})</span>
        )}
      </p>
    </div>
  );
}