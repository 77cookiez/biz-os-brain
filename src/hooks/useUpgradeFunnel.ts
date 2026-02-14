import { useCallback, useMemo } from 'react';
import { useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useGrowthInsights, GrowthInsights } from '@/hooks/useGrowthInsights';
import { useBilling, BillingPlan } from '@/hooks/useBilling';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { getErrorMessage } from '@/lib/errorMapper';
import { toast } from 'sonner';

function todayKey(workspaceId: string): string {
  const d = new Date();
  return `upgrade_funnel_seen_${workspaceId}_${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
}

function snoozeKey(workspaceId: string): string {
  return `upgrade_funnel_snoozed_${workspaceId}`;
}

function isSnoozed(workspaceId: string): boolean {
  if (typeof window === 'undefined') return false;
  const raw = localStorage.getItem(snoozeKey(workspaceId));
  if (!raw) return false;
  const until = Number(raw);
  return Date.now() < until;
}

function isSeenToday(workspaceId: string): boolean {
  if (typeof window === 'undefined') return false;
  return !!localStorage.getItem(todayKey(workspaceId));
}

function markSeenToday(workspaceId: string) {
  if (typeof window !== 'undefined') {
    localStorage.setItem(todayKey(workspaceId), '1');
  }
}

function snooze7Days(workspaceId: string) {
  if (typeof window !== 'undefined') {
    localStorage.setItem(snoozeKey(workspaceId), String(Date.now() + 7 * 24 * 60 * 60 * 1000));
  }
}

/**
 * Pick the best upgrade plan based on insights.
 * Strategy:
 *  - If projected breach on bookings/quotes → pick next plan whose limit > projected
 *  - Else pick next plan by display_order after current
 */
function recommendPlan(
  insights: GrowthInsights,
  plans: BillingPlan[],
  currentPlanId: string
): BillingPlan | null {
  const sorted = [...plans].sort((a, b) => a.display_order - b.display_order);
  const currentIdx = sorted.findIndex(p => p.id === currentPlanId);
  const candidates = sorted.slice(currentIdx + 1);
  if (candidates.length === 0) return null;

  const hasProjectedBreach = insights.reasons.some(r => r.code === 'PROJECTED_BREACH');

  if (hasProjectedBreach) {
    const projBookings = insights.projected_end_of_month_usage.bookings;
    const projQuotes = insights.projected_end_of_month_usage.quotes;
    const match = candidates.find(p => {
      const bOk = p.bookings_limit === null || p.bookings_limit > projBookings;
      const qOk = p.quotes_limit === null || p.quotes_limit > projQuotes;
      return bOk && qOk;
    });
    return match || candidates[0];
  }

  return candidates[0];
}

export function useUpgradeFunnel() {
  const { currentWorkspace } = useWorkspace();
  const workspaceId = currentWorkspace?.id;
  const { insights, isLoading: insightsLoading } = useGrowthInsights();
  const { plans, currentPlan, isLoading: billingLoading } = useBilling();

  const shouldShow = useMemo(() => {
    if (!insights || !workspaceId) return false;
    if (insights.recommended_action !== 'upgrade') return false;
    if (isSnoozed(workspaceId)) return false;
    return true;
  }, [insights, workspaceId]);

  const recommendedPlan = useMemo(() => {
    if (!insights || !plans.length || !currentPlan) return null;
    return recommendPlan(insights, plans, currentPlan.id);
  }, [insights, plans, currentPlan]);

  // Comparison plans: current + recommended + one above (max 3)
  const comparisonPlans = useMemo(() => {
    if (!currentPlan || !plans.length) return [];
    const sorted = [...plans].sort((a, b) => a.display_order - b.display_order);
    const currentIdx = sorted.findIndex(p => p.id === currentPlan.id);
    return sorted.slice(currentIdx, currentIdx + 3);
  }, [currentPlan, plans]);

  const logEvent = useMutation({
    mutationFn: async ({ eventType, meta }: { eventType: string; meta: Record<string, unknown> }) => {
      if (!workspaceId) return;
      await supabase.rpc('log_growth_event', {
        _workspace_id: workspaceId,
        _event_type: eventType,
        _meta: meta as any,
      });
    },
  });

  const requestUpgrade = useMutation({
    mutationFn: async ({ planId, notes }: { planId: string; notes?: string }) => {
      if (!workspaceId) throw new Error('No workspace');
      const { data, error } = await supabase.rpc('request_upgrade', {
        _workspace_id: workspaceId,
        _plan_id: planId,
        _notes: notes,
      });
      if (error) throw error;
      return data;
    },
    onError: (err) => {
      toast.error(getErrorMessage(err));
    },
  });

  const logFunnelView = useCallback(() => {
    if (!workspaceId || !insights || !recommendedPlan) return;
    if (isSeenToday(workspaceId)) return;
    markSeenToday(workspaceId);
    logEvent.mutate({
      eventType: 'UPGRADE_FUNNEL_VIEW',
      meta: {
        source: 'dashboard',
        recommended_plan_id: recommendedPlan.id,
        confidence: insights.confidence_score,
        reasons: insights.reasons,
      },
    });
  }, [workspaceId, insights, recommendedPlan, logEvent]);

  const logCtaClick = useCallback(() => {
    if (!workspaceId || !recommendedPlan) return;
    logEvent.mutate({
      eventType: 'UPGRADE_CTA_CLICK',
      meta: {
        recommended_plan_id: recommendedPlan.id,
      },
    });
  }, [workspaceId, recommendedPlan, logEvent]);

  const logRequestSubmit = useCallback((planId: string) => {
    if (!workspaceId || !insights) return;
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
  }, [workspaceId, insights, logEvent]);

  const handleSnooze = useCallback(() => {
    if (workspaceId) snooze7Days(workspaceId);
  }, [workspaceId]);

  return {
    shouldShow,
    insights,
    recommendedPlan,
    comparisonPlans,
    currentPlan,
    isLoading: insightsLoading || billingLoading,
    requestUpgrade,
    logFunnelView,
    logCtaClick,
    logRequestSubmit,
    handleSnooze,
  };
}
