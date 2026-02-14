import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { useBilling } from './useBilling';

export interface WorkspaceUsage {
  vendors_count: number;
  bookings_this_month: number;
  services_count: number;
  quotes_this_month: number;
}

export function useFeatureGuard() {
  const { currentWorkspace } = useWorkspace();
  const { currentPlan, subscription, isLoading: billingLoading } = useBilling();
  const workspaceId = currentWorkspace?.id;

  // Fetch live usage stats
  const { data: usage, isLoading: usageLoading } = useQuery({
    queryKey: ['workspace-usage', workspaceId],
    queryFn: async () => {
      if (!workspaceId) return null;
      const { data, error } = await supabase.rpc('get_workspace_usage', {
        _workspace_id: workspaceId,
      });
      if (error) throw error;
      return data as unknown as WorkspaceUsage;
    },
    enabled: !!workspaceId,
    staleTime: 30_000,
  });

  const features = (currentPlan?.features ?? {}) as Record<string, boolean>;

  /** Check if a feature flag is enabled on current plan */
  const canUseFeature = (featureName: string): boolean => {
    return features[featureName] ?? false;
  };

  /** Check if workspace is within vendor limit */
  const canAddVendor = (): boolean => {
    if (!currentPlan) return false;
    if (currentPlan.vendors_limit === null) return true; // unlimited
    return (usage?.vendors_count ?? 0) < currentPlan.vendors_limit;
  };

  /** Check if workspace is within monthly booking limit */
  const canAddBooking = (): boolean => {
    if (!currentPlan) return false;
    if (currentPlan.bookings_limit === null) return true; // unlimited
    return (usage?.bookings_this_month ?? 0) < currentPlan.bookings_limit;
  };

  /** Check if workspace is within services limit */
  const canAddService = (): boolean => {
    if (!currentPlan) return false;
    if (currentPlan.services_limit === null) return true;
    return (usage?.services_count ?? 0) < currentPlan.services_limit;
  };

  /** Check if workspace is within quotes limit */
  const canAddQuote = (): boolean => {
    if (!currentPlan) return false;
    if (currentPlan.quotes_limit === null) return true;
    return (usage?.quotes_this_month ?? 0) < currentPlan.quotes_limit;
  };

  const isAiEnabled = canUseFeature('advanced_reports') || canUseFeature('api_access');
  const isBrandingEnabled = canUseFeature('branding');
  const isApiAccessEnabled = canUseFeature('api_access');
  const isSsoEnabled = canUseFeature('sso');

  return {
    // Feature flags
    canUseFeature,
    isAiEnabled,
    isBrandingEnabled,
    isApiAccessEnabled,
    isSsoEnabled,

    // Limit checks
    canAddVendor,
    canAddBooking,
    canAddService,
    canAddQuote,

    // Usage data
    usage,
    currentPlan,
    subscription,

    // Limits from plan
    limits: {
      vendors: currentPlan?.vendors_limit,
      bookings: currentPlan?.bookings_limit,
      services: currentPlan?.services_limit,
      quotes: currentPlan?.quotes_limit,
      seats: currentPlan?.seats_limit,
    },

    isLoading: billingLoading || usageLoading,
  };
}
