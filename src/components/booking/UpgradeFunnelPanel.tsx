import { useEffect, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { ArrowUpCircle, Check, X, Zap, Lightbulb, TrendingUp, ArrowRight } from 'lucide-react';
import { useUpgradeFunnel, BusinessTip } from '@/hooks/useUpgradeFunnel';
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
    tips,
    priceSuggestion,
    isLoading,
    requestUpgrade,
    logFunnelView,
    logCtaClick,
    logRequestSubmit,
    logPriceSuggestionView,
    logTipsView,
    handleSnooze,
  } = useUpgradeFunnel();

  const [dismissed, setDismissed] = useState(false);

  // Log funnel view on mount
  useEffect(() => {
    if (shouldShow && !dismissed) logFunnelView();
  }, [shouldShow, dismissed, logFunnelView]);

  // Log price suggestion view once
  useEffect(() => {
    if (priceSuggestion.show && shouldShow && !dismissed) logPriceSuggestionView();
  }, [priceSuggestion.show, shouldShow, dismissed, logPriceSuggestionView]);

  // Log tips (dedup handled inside hook via localStorage)
  useEffect(() => {
    if (tips.length > 0 && shouldShow && !dismissed) {
      logTipsView(tips.map(t => t.code));
    }
  }, [tips, shouldShow, dismissed, logTipsView]);

  const onRequestUpgrade = useCallback(async () => {
    if (!recommendedPlan || !insights) return;
    logCtaClick();
    const notes = JSON.stringify({
      recommended_plan_id: recommendedPlan.id,
      confidence: insights.confidence_score,
      utilization_percent: insights.utilization_percent,
      projected_end_of_month_usage: insights.projected_end_of_month_usage,
      reasons: insights.reasons.map(r => r.code),
    }).slice(0, 1800);
    try {
      await requestUpgrade.mutateAsync({ planId: recommendedPlan.id, notes });
      logRequestSubmit(recommendedPlan.id);
      toast.success(t('upgradeFunnel.requestSuccess'));
      setDismissed(true);
    } catch {
      // handled by mutation onError
    }
  }, [recommendedPlan, insights, requestUpgrade, logCtaClick, logRequestSubmit, t]);

  const onSnooze = useCallback(() => {
    handleSnooze();
    setDismissed(true);
  }, [handleSnooze]);

  if (isLoading || !shouldShow || dismissed || !insights) return null;

  // If optimize but no recommended plan → don't show funnel
  if (!recommendedPlan && insights.recommended_action === 'optimize') return null;

  // Deduplicate reasons
  const uniqueReasons = (insights.reasons ?? []).filter((r, idx, arr) => {
    const k = `${r.code}:${r.metric ?? ''}`;
    return arr.findIndex(x => `${x.code}:${x.metric ?? ''}` === k) === idx;
  });

  const isCritical = insights.recommended_action === 'upgrade';

  return (
    <Card className={cn(
      'transition-colors',
      isCritical ? 'border-destructive/30 bg-destructive/5' : 'border-primary/30 bg-primary/5',
    )}>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <ArrowUpCircle className={cn('h-4 w-4', isCritical ? 'text-destructive' : 'text-primary')} />
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
          <ul className={cn(
            'list-disc list-inside text-sm space-y-1',
            isCritical ? 'text-destructive' : 'text-muted-foreground',
          )}>
            {uniqueReasons.map((r: GrowthReason, idx: number) => (
              <ReasonBullet key={`${r.code}:${r.metric ?? idx}`} reason={r} />
            ))}
          </ul>
        )}

        {/* Price suggestion (Phase D) */}
        {priceSuggestion.show && recommendedPlan && (
          <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 flex items-center gap-3">
            <TrendingUp className="h-5 w-5 text-primary shrink-0" />
            <p className="text-sm text-foreground">
              {t('upgradeFunnel.priceSuggestion', { plan: recommendedPlan.name })}
            </p>
          </div>
        )}

        <Separator />

        {/* Plan comparison */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {comparisonPlans.map(plan => (
            <PlanColumn
              key={plan.id}
              plan={plan}
              isCurrent={plan.id === currentPlan?.id}
              isRecommended={plan.id === recommendedPlan?.id}
            />
          ))}
        </div>

        {/* Feature highlights */}
        <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
          {['growth_insights', 'priority_support', 'advanced_insights', 'white_label'].map(feat => (
            <div key={feat} className="flex items-center gap-1.5">
              <Check className="h-3 w-3 text-primary shrink-0" />
              {t(`upgradeFunnel.features.${feat}`)}
            </div>
          ))}
        </div>

        {/* CTAs */}
        <div className="flex flex-col sm:flex-row gap-2">
          {recommendedPlan && (
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
          )}
          <Button
            variant="outline"
            className="flex-1"
            onClick={() => { logCtaClick(); navigate('/apps/booking/billing'); }}
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

        {/* AI Business Tips (Phase E) */}
        {tips.length > 0 && (
          <>
            <Separator />
            <div className="space-y-2">
              <p className="text-sm font-medium flex items-center gap-2">
                <Lightbulb className="h-4 w-4 text-primary" />
                {t('upgradeFunnel.tips.title')}
              </p>
              <ul className="space-y-2">
                {tips.map(tip => (
                  <TipRow key={tip.code} tip={tip} />
                ))}
              </ul>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

/* ── Sub-components ──────────────────────────────── */

function ReasonBullet({ reason }: { reason: GrowthReason }) {
  const { t } = useTranslation();
  const metricLabel = reason.metric ? t(`growth.metrics.${reason.metric}`, reason.metric) : '';

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
    text = (t as Function)(`growth.reasons.${reason.code}`, { count: String(reason.count ?? '') });
  }
  return <li>{text}</li>;
}

function PlanColumn({ plan, isCurrent, isRecommended }: {
  plan: BillingPlan; isCurrent: boolean; isRecommended: boolean;
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
    <div className={cn(
      'rounded-lg border p-3 space-y-2 transition-colors',
      isRecommended && 'border-primary bg-primary/5 ring-1 ring-primary/20',
      isCurrent && !isRecommended && 'border-border bg-muted/30',
    )}>
      <div className="flex items-center justify-between gap-1">
        <p className="text-sm font-semibold text-foreground">{plan.name}</p>
        {isCurrent && <Badge variant="secondary" className="text-[10px]">{t('upgradeFunnel.currentPlan')}</Badge>}
        {isRecommended && !isCurrent && (
          <Badge variant="default" className="text-[10px]">{t('upgradeFunnel.recommended')}</Badge>
        )}
      </div>

      <p className="text-lg font-bold text-foreground">
        {plan.price_monthly > 0
          ? `${plan.currency} ${plan.price_monthly}`
          : t('upgradeFunnel.free')}
        {plan.price_monthly > 0 && (
          <span className="text-xs font-normal text-muted-foreground">/{t('upgradeFunnel.month')}</span>
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

function TipRow({ tip }: { tip: BusinessTip }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  return (
    <li
      className="flex items-start gap-3 p-2 rounded-md border border-border hover:bg-muted/40 cursor-pointer transition-colors"
      onClick={() => navigate(tip.actionPath)}
      role="button"
      tabIndex={0}
      onKeyDown={e => { if (e.key === 'Enter') navigate(tip.actionPath); }}
    >
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground">{t(`upgradeFunnel.tips.${tip.code}.title`)}</p>
        <p className="text-xs text-muted-foreground">{t(`upgradeFunnel.tips.${tip.code}.body`)}</p>
      </div>
      <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
    </li>
  );
}
