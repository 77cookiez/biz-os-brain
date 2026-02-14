import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { useBilling } from '@/hooks/useBilling';
import { useCallback, useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';

interface UsageData {
  vendors_count: number;
  bookings_this_month: number;
  services_count: number;
  quotes_this_month: number;
}

export interface UsageMetric {
  key: string;
  labelKey: string;
  current: number;
  limit: number | null;
  percent: number;
  isMonthly: boolean;
}

export interface UsageEvent {
  id: string;
  event_type: string;
  meta: Record<string, unknown>;
  created_at: string;
}

function getUtcMonthKey() {
  const now = new Date();
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
}

function getWarningStorageKey(workspaceId: string, metric: string, threshold: number) {
  return `usage_warn_${workspaceId}_${metric}_${threshold}_${getUtcMonthKey()}`;
}

export function useWorkspaceUsage() {
  const { currentWorkspace } = useWorkspace();
  const { currentPlan, isLoading: billingLoading } = useBilling();
  const { t } = useTranslation();
  const workspaceId = currentWorkspace?.id;
  const warnedRef = useRef<Set<string>>(new Set());

  // Fetch usage via RPC
  const { data: rawUsage, isLoading: usageLoading } = useQuery({
    queryKey: ['workspace-usage', workspaceId],
    queryFn: async () => {
      if (!workspaceId) return null;
      const { data, error } = await supabase.rpc('get_workspace_usage', {
        _workspace_id: workspaceId,
      });
      if (error) throw error;
      return data as unknown as UsageData;
    },
    enabled: !!workspaceId,
    refetchInterval: 60_000,
  });

  // Fetch seat count separately (workspace_members)
  const { data: seatCount = 0 } = useQuery({
    queryKey: ['workspace-seats', workspaceId],
    queryFn: async () => {
      if (!workspaceId) return 0;
      const { count, error } = await supabase
        .from('workspace_members')
        .select('id', { count: 'exact', head: true })
        .eq('workspace_id', workspaceId);
      if (error) throw error;
      return count || 0;
    },
    enabled: !!workspaceId,
  });

  // Fetch recent usage events
  const { data: events = [], isLoading: eventsLoading } = useQuery({
    queryKey: ['usage-events', workspaceId],
    queryFn: async () => {
      if (!workspaceId) return [];
      const { data, error } = await supabase
        .from('billing_usage_events')
        .select('id, event_type, meta, created_at')
        .eq('workspace_id', workspaceId)
        .order('created_at', { ascending: false })
        .limit(20);
      if (error) throw error;
      return (data || []) as UsageEvent[];
    },
    enabled: !!workspaceId,
  });

  // Build metrics
  const metrics: UsageMetric[] = rawUsage && currentPlan
    ? [
        {
          key: 'vendors',
          labelKey: 'usage.vendors',
          current: rawUsage.vendors_count,
          limit: currentPlan.vendors_limit,
          percent: currentPlan.vendors_limit ? Math.round((rawUsage.vendors_count / currentPlan.vendors_limit) * 100) : 0,
          isMonthly: false,
        },
        {
          key: 'services',
          labelKey: 'usage.services',
          current: rawUsage.services_count,
          limit: currentPlan.services_limit,
          percent: currentPlan.services_limit ? Math.round((rawUsage.services_count / currentPlan.services_limit) * 100) : 0,
          isMonthly: false,
        },
        {
          key: 'bookings',
          labelKey: 'usage.bookingsMonth',
          current: rawUsage.bookings_this_month,
          limit: currentPlan.bookings_limit,
          percent: currentPlan.bookings_limit ? Math.round((rawUsage.bookings_this_month / currentPlan.bookings_limit) * 100) : 0,
          isMonthly: true,
        },
        {
          key: 'quotes',
          labelKey: 'usage.quotesMonth',
          current: rawUsage.quotes_this_month,
          limit: currentPlan.quotes_limit,
          percent: currentPlan.quotes_limit ? Math.round((rawUsage.quotes_this_month / currentPlan.quotes_limit) * 100) : 0,
          isMonthly: true,
        },
        {
          key: 'seats',
          labelKey: 'usage.seats',
          current: seatCount,
          limit: currentPlan.seats_limit,
          percent: currentPlan.seats_limit ? Math.round((seatCount / currentPlan.seats_limit) * 100) : 0,
          isMonthly: false,
        },
      ]
    : [];

  // Soft warnings (80% and 95%) — non-spammy via localStorage
  const checkWarnings = useCallback(() => {
    if (!workspaceId || metrics.length === 0) return;

    for (const m of metrics) {
      if (m.limit === null) continue;
      for (const threshold of [95, 80]) {
        if (m.percent >= threshold) {
          const key = getWarningStorageKey(workspaceId, m.key, threshold);
          if (!warnedRef.current.has(key) && !localStorage.getItem(key)) {
            warnedRef.current.add(key);
            localStorage.setItem(key, '1');
            const msg = threshold >= 95
              ? t('usage.warning95', { resource: t(m.labelKey), percent: m.percent })
              : t('usage.warning80', { resource: t(m.labelKey), percent: m.percent });
            toast.warning(msg);
          }
          break; // only show highest threshold
        }
      }
    }
  }, [workspaceId, metrics, t]);

  useEffect(() => {
    checkWarnings();
  }, [checkWarnings]);

  return {
    metrics,
    events,
    isLoading: usageLoading || billingLoading,
    eventsLoading,
    currentPlan,
  };
}
