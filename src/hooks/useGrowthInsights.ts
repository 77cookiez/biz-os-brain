import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useWorkspace } from '@/contexts/WorkspaceContext';

export interface GrowthReason {
  code: 'FREQUENT_LIMIT_HITS' | 'PROJECTED_BREACH' | 'HIGH_UTILIZATION';
  metric?: string;
  percent?: number;
  projected?: number;
  limit?: number;
  hits?: number;
}

export interface GrowthInsights {
  usage: {
    vendors_count: number;
    services_count: number;
    bookings_this_month: number;
    quotes_this_month: number;
    seats_count: number;
  };
  limits: {
    vendors_limit: number | null;
    services_limit: number | null;
    bookings_limit: number | null;
    quotes_limit: number | null;
    seats_limit: number | null;
  };
  utilization_percent: {
    vendors: number;
    services: number;
    bookings: number;
    quotes: number;
    seats: number;
  };
  limit_hits_last_30_days: number;
  projected_end_of_month_usage: {
    bookings: number;
    quotes: number;
  };
  recommended_action: 'upgrade' | 'optimize' | 'none';
  confidence_score: number;
  reasons: GrowthReason[];
}

export function useGrowthInsights() {
  const { currentWorkspace } = useWorkspace();
  const workspaceId = currentWorkspace?.id;

  const { data, isLoading, error } = useQuery({
    queryKey: ['growth-insights', workspaceId],
    queryFn: async (): Promise<GrowthInsights | null> => {
      if (!workspaceId) return null;
      const { data, error } = await supabase.rpc('get_workspace_growth_insights', {
        _workspace_id: workspaceId,
      });
      if (error) throw error;
      return data as unknown as GrowthInsights;
    },
    enabled: !!workspaceId,
    refetchInterval: 5 * 60 * 1000, // 5 minutes
    staleTime: 4 * 60 * 1000,
  });

  return { insights: data ?? null, isLoading, error };
}
