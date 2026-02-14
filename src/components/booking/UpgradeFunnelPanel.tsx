import { useEffect, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { ArrowUpCircle, Check, X, Zap } from 'lucide-react';
import { useUpgradeFunnel } from '@/hooks/useUpgradeFunnel';
import { BillingPlan } from '@/hooks/useBilling';
import { GrowthReason } from '@/hooks/useGrowthInsights';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

export function UpgradeFunnelPanel() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const {
    shouldShow,
    insights,
    recommendedPlan,
    comparisonPlans,
    currentPlan,
    isLoading,
    requestUpgrade,
    logFunnelView,
    logCtaClick,
    logRequestSubmit,
    handleSnooze,
  } = useUpgradeFunnel();

  const [dismissed, setDismissed] = useState(false);

  // Log funnel view on mount
  useEffect(() => {
    if (shouldShow && !dismissed) {
      logFunnelView();
    }
  }, [shouldShow, dismissed, logFunnelView]);

  const onRequestUpgrade = useCallback(async () => {
    if (!recommendedPlan || !insights) return;
    logCtaClick();

    const reasonsSummary = insights.reasons
      .map(r => r.code)
      .join(', ');

    const notes = `Auto-generated: confidence=${insights.confidence_score}%, reasons=[${reasonsSummary}], utilization=${JSON.stringify(insights.utilization_percent)}`;

    try {
      await requestUpgrade.mutateAsync({
        planId: recommendedPlan.id,
        notes,
      });
      logRequestSubmit(recommendedPlan.id);
      toast.success(t('upgradeFunnel.requestSuccess'));
      setDismissed(true);
    } catch {
      // error handled by mutation
    }
  }, [recommendedPlan, insights, requestUpgrade, logCtaClick, logRequestSubmit, t]);

  const onSnooze = useCallback(() => {
    handleSnooze();
    setDismissed(true);
  }, [handleSnooze]);

  if (isLoading || !shouldShow || dismissed || !insights || !recommendedPlan) {
    return null;
  }

  // Deduplicate reasons
  const uniqueReasons = insights.reasons.filter((r, idx, arr) => {
    const k = `${r.code}:${r.metric ?? ''}`;
    return arr.findIndex(x => `${x.code}:${x.metric ?? ''}` === k) === idx;
  });

  return (
    <Card className="border-destructive/30 bg-destructive/5">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <ArrowUpCircle className="h-4 w-4 text-destructive" />
          {t('upgradeFunnel.title')}
        </CardTitle>
        <button
          onClick={onSnooze}
          className="text-muted-foreground hover:text-foreground transition-colors"
          aria-label={t('upgradeFunnel.notNow')}
        >
          <X className="h-4 w-4" />
        </button>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Headline */}
        <p className="text-sm text-foreground font-medium">
          {t('upgradeFunnel.headline')}
        </p>

        {/* Reasons */}
        {uniqueReasons.length > 0 && (
          <ul className="list-disc list-inside text-sm text-destructive space-y-1">
            {uniqueReasons.map((r: GrowthReason, idx: number) => (
              <ReasonBullet key={`${r.code}:${r.metric ?? idx}`} reason={r} />
            ))}
          </ul>
        )}

        <Separator />

        {/* Plan comparison */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {comparisonPlans.map(plan => (
            <PlanColumn
              key={plan.id}
              plan={plan}
              isCurrent={plan.id === currentPlan?.id}
              isRecommended={plan.id === recommendedPlan.id}
            />
          ))}
        </div>

        {/* CTAs */}
        <div className="flex flex-col sm:flex-row gap-2">
          <Button
            className="flex-1"
            onClick={onRequestUpgrade}
            disabled={requestUpgrade.isPending}
          >
            <Zap className="h-4 w-4 mr-2" />
            {requestUpgrade.isPending
              ? t('common.loading')
              : t('upgradeFunnel.ctaRequest', { plan: recommendedPlan.name })}
          </Button>
          <Button
            variant="outline"
            className="flex-1"
            onClick={() => {
              logCtaClick();
              navigate('/apps/booking/billing');
            }}
          >
            {t('upgradeFunnel.ctaViewPlans')}
          </Button>
        </div>

        <button
          onClick={onSnooze}
          className="text-xs text-muted-foreground hover:text-foreground transition-colors w-full text-center"
        >
          {t('upgradeFunnel.notNow')}
        </button>
      </CardContent>
    </Card>
  );
}

/* ── Sub-components ──────────────────────────────── */

function ReasonBullet({ reason }: { reason: GrowthReason }) {
  const { t } = useTranslation();
  const metricLabel = reason.metric
    ? t(`growth.metrics.${reason.metric}`, reason.metric)
    : '';

  let text: string;
  if (reason.code === 'PROJECTED_BREACH' && reason.projected != null && reason.limit != null) {
    text = t('growth.reasons.PROJECTED_BREACH', {
      metric: metricLabel,
      projected: String(reason.projected),
      limit: String(reason.limit),
    });
  } else if (reason.code === 'PROJECTED_BREACH') {
    text = t('growth.reasons.PROJECTED_BREACH_generic');
  } else if (reason.code === 'HIGH_UTILIZATION') {
    text = t('growth.reasons.HIGH_UTILIZATION', { metric: metricLabel });
  } else {
    text = (t as Function)(`growth.reasons.${reason.code}`, {
      count: String(reason.count ?? ''),
    });
  }

  return <li>{text}</li>;
}

function PlanColumn({
  plan,
  isCurrent,
  isRecommended,
}: {
  plan: BillingPlan;
  isCurrent: boolean;
  isRecommended: boolean;
}) {
  const { t } = useTranslation();

  const limits: { key: string; value: number | null }[] = [
    { key: 'vendors', value: plan.vendors_limit },
    { key: 'services', value: plan.services_limit },
    { key: 'bookings', value: plan.bookings_limit },
    { key: 'quotes', value: plan.quotes_limit },
    { key: 'seats', value: plan.seats_limit },
  ];

  return (
    <div
      className={cn(
        'rounded-lg border p-3 space-y-2 transition-colors',
        isRecommended && 'border-primary bg-primary/5 ring-1 ring-primary/20',
        isCurrent && !isRecommended && 'border-border bg-muted/30',
      )}
    >
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-foreground">{plan.name}</p>
        {isCurrent && (
          <Badge variant="secondary" className="text-[10px]">
            {t('upgradeFunnel.currentPlan')}
          </Badge>
        )}
        {isRecommended && !isCurrent && (
          <Badge variant="default" className="text-[10px]">
            {t('upgradeFunnel.recommended')}
          </Badge>
        )}
      </div>

      <p className="text-lg font-bold text-foreground">
        {plan.price_monthly > 0
          ? `${plan.currency} ${plan.price_monthly}`
          : t('upgradeFunnel.free')}
        {plan.price_monthly > 0 && (
          <span className="text-xs font-normal text-muted-foreground">
            /{t('upgradeFunnel.month')}
          </span>
        )}
      </p>

      <ul className="space-y-1 text-xs text-muted-foreground">
        {limits.map(l => (
          <li key={l.key} className="flex items-center gap-1.5">
            <Check className="h-3 w-3 text-primary shrink-0" />
            {t(`growth.metrics.${l.key}`)}: {l.value ?? t('usage.unlimited', 'Unlimited')}
          </li>
        ))}
      </ul>
    </div>
  );
}
