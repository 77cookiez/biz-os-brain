import { useCallback, useMemo } from 'react';
import { useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useGrowthInsights, GrowthInsights } from '@/hooks/useGrowthInsights';
import { useBilling, BillingPlan } from '@/hooks/useBilling';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { getErrorMessage } from '@/lib/errorMapper';
import { toast } from 'sonner';

/* ── localStorage helpers (SSR-safe) ──────────────── */

function todayKey(wid: string): string {
  const d = new Date();
  return `upgrade_funnel_seen_${wid}_${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
}
function snoozeKey(wid: string) { return `upgrade_funnel_snooze_${wid}`; }

function isSnoozed(wid: string): boolean {
  if (typeof window === 'undefined') return false;
  const raw = localStorage.getItem(snoozeKey(wid));
  return raw ? Date.now() < Number(raw) : false;
}
function isSeenToday(wid: string): boolean {
  if (typeof window === 'undefined') return false;
  return !!localStorage.getItem(todayKey(wid));
}
function markSeenToday(wid: string) {
  if (typeof window !== 'undefined') localStorage.setItem(todayKey(wid), '1');
}
function snooze7Days(wid: string) {
  if (typeof window !== 'undefined')
    localStorage.setItem(snoozeKey(wid), String(Date.now() + 7 * 86_400_000));
}

/* ── Business tips generator (rule-based, no LLM) ── */

export interface BusinessTip {
  code: string;
  actionPath: string;
}

export function generateTips(insights: GrowthInsights): BusinessTip[] {
  const tips: BusinessTip[] = [];
  const u = insights.usage;
  const util = insights.utilization_percent;

  // High quotes but low bookings → conversion issue
  if (u.quotes_this_month > 5 && u.bookings_this_month > 0 &&
      u.quotes_this_month / u.bookings_this_month > 3) {
    tips.push({ code: 'improve_conversion', actionPath: '/apps/booking/quotes' });
  }
  // Low services
  if (u.services_count < 3) {
    tips.push({ code: 'add_services', actionPath: '/apps/booking/services' });
  }
  // Vendors near limit
  if (util.vendors >= 80 && insights.limits.vendors_limit !== null) {
    tips.push({ code: 'manage_vendors', actionPath: '/apps/booking/vendors' });
  }
  // Seats under-utilized
  if (u.seats_count === 1 && (insights.limits.seats_limit ?? 0) > 1) {
    tips.push({ code: 'invite_team', actionPath: '/settings/team' });
  }

  return tips.slice(0, 4);
}

/* ── Plan recommendation algorithm ───────────────── */

function recommendPlan(
  insights: GrowthInsights,
  plans: BillingPlan[],
  currentPlanId: string,
): BillingPlan | null {
  const sorted = [...plans].sort((a, b) => a.display_order - b.display_order);
  const currentIdx = sorted.findIndex(p => p.id === currentPlanId);
  const candidates = sorted.slice(currentIdx + 1);
  if (candidates.length === 0) return null;

  if (insights.recommended_action === 'upgrade') {
    const hasBreach = insights.reasons.some(r => r.code === 'PROJECTED_BREACH');
    if (hasBreach) {
      const pb = insights.projected_end_of_month_usage.bookings;
      const pq = insights.projected_end_of_month_usage.quotes;
      const match = candidates.find(p => {
        const bOk = p.bookings_limit === null || p.bookings_limit > pb;
        const qOk = p.quotes_limit === null || p.quotes_limit > pq;
        return bOk && qOk;
      });
      return match || candidates[0];
    }
    // default: next tier up
    return candidates[0];
  }

  if (insights.recommended_action === 'optimize') {
    const util = insights.utilization_percent;
    const lim = insights.limits;
    const any90 =
      (lim.vendors_limit !== null && util.vendors >= 90) ||
      (lim.services_limit !== null && util.services >= 90) ||
      (lim.bookings_limit !== null && util.bookings >= 90) ||
      (lim.quotes_limit !== null && util.quotes >= 90) ||
      (lim.seats_limit !== null && util.seats >= 90);
    return any90 ? candidates[0] : null; // null = recommend staying
  }

  return null;
}

/* ── Price suggestion logic ──────────────────────── */

export interface PriceSuggestion {
  show: boolean;
  planId: string | null;
  triggers: string[];
}

function computePriceSuggestion(insights: GrowthInsights, recPlan: BillingPlan | null): PriceSuggestion {
  if (!recPlan || insights.confidence_score < 75) return { show: false, planId: null, triggers: [] };
  const codes = insights.reasons.map(r => r.code);
  const hasBreach = codes.includes('PROJECTED_BREACH');
  const hasHits = codes.includes('FREQUENT_LIMIT_HITS');
  if (hasBreach || hasHits) {
    return { show: true, planId: recPlan.id, triggers: codes };
  }
  return { show: false, planId: null, triggers: [] };
}

/* ── Main hook ───────────────────────────────────── */

export function useUpgradeFunnel() {
  const { currentWorkspace } = useWorkspace();
  const wid = currentWorkspace?.id;
  const { insights, isLoading: insightsLoading } = useGrowthInsights();
  const { plans, currentPlan, isLoading: billingLoading } = useBilling();

  const shouldShow = useMemo(() => {
    if (!insights || !wid) return false;
    if (!['upgrade', 'optimize'].includes(insights.recommended_action)) return false;
    if (insights.confidence_score < 55) return false;
    if (isSnoozed(wid)) return false;
    return true;
  }, [insights, wid]);

  const recommendedPlan = useMemo(() => {
    if (!insights || !plans.length || !currentPlan) return null;
    return recommendPlan(insights, plans, currentPlan.id);
  }, [insights, plans, currentPlan]);

  const comparisonPlans = useMemo(() => {
    if (!currentPlan || !plans.length) return [];
    const sorted = [...plans].sort((a, b) => a.display_order - b.display_order);
    const currentIdx = sorted.findIndex(p => p.id === currentPlan.id);
    return sorted.slice(currentIdx, currentIdx + 3);
  }, [currentPlan, plans]);

  const tips = useMemo(() => {
    if (!insights) return [];
    return generateTips(insights);
  }, [insights]);

  const priceSuggestion = useMemo(() => {
    if (!insights) return { show: false, planId: null, triggers: [] } as PriceSuggestion;
    return computePriceSuggestion(insights, recommendedPlan);
  }, [insights, recommendedPlan]);

  /* ── Event logging ─────────────────────────────── */

  const logEvent = useMutation({
    mutationFn: async ({ eventType, meta }: { eventType: string; meta: Record<string, unknown> }) => {
      if (!wid) return;
      await supabase.rpc('log_growth_event', {
        _workspace_id: wid,
        _event_type: eventType,
        _meta: meta as any,
      });
    },
  });

  const requestUpgrade = useMutation({
    mutationFn: async ({ planId, notes }: { planId: string; notes?: string }) => {
      if (!wid) throw new Error('No workspace');
      const { data, error } = await supabase.rpc('request_upgrade', {
        _workspace_id: wid,
        _plan_id: planId,
        _notes: notes,
      });
      if (error) throw error;
      return data;
    },
    onError: (err) => { toast.error(getErrorMessage(err)); },
  });

  const logFunnelView = useCallback(() => {
    if (!wid || !insights || !recommendedPlan) return;
    if (isSeenToday(wid)) return;
    markSeenToday(wid);
    logEvent.mutate({
      eventType: 'UPGRADE_FUNNEL_VIEW',
      meta: {
        source: 'dashboard',
        recommended_plan_id: recommendedPlan.id,
        confidence: insights.confidence_score,
        reasons_codes: insights.reasons.map(r => r.code),
      },
    });
  }, [wid, insights, recommendedPlan, logEvent]);

  const logCtaClick = useCallback(() => {
    if (!wid || !recommendedPlan) return;
    logEvent.mutate({ eventType: 'UPGRADE_CTA_CLICK', meta: { recommended_plan_id: recommendedPlan.id } });
  }, [wid, recommendedPlan, logEvent]);

  const logRequestSubmit = useCallback((planId: string) => {
    if (!wid || !insights) return;
    logEvent.mutate({
      eventType: 'UPGRADE_REQUEST_SUBMIT',
      meta: {
        plan_id: planId,
        confidence: insights.confidence_score,
        utilization: insights.utilization_percent,
        projected: insights.projected_end_of_month_usage,
        reasons: insights.reasons,
      },
    });
  }, [wid, insights, logEvent]);

  const logPriceSuggestionView = useCallback(() => {
    if (!wid || !priceSuggestion.show) return;
    logEvent.mutate({
      eventType: 'PRICE_SUGGESTION_VIEW',
      meta: { recommended_plan_id: priceSuggestion.planId, triggers: priceSuggestion.triggers },
    });
  }, [wid, priceSuggestion, logEvent]);

  const logTipsView = useCallback((tipCodes: string[]) => {
    if (!wid) return;
    logEvent.mutate({ eventType: 'PLAN_RECOMMENDED', meta: { tip_codes: tipCodes } });
  }, [wid, logEvent]);

  const handleSnooze = useCallback(() => { if (wid) snooze7Days(wid); }, [wid]);

  return {
    shouldShow,
    insights,
    recommendedPlan,
    comparisonPlans,
    currentPlan,
    tips,
    priceSuggestion,
    isLoading: insightsLoading || billingLoading,
    requestUpgrade,
    logFunnelView,
    logCtaClick,
    logRequestSubmit,
    logPriceSuggestionView,
    logTipsView,
    handleSnooze,
  };
}
