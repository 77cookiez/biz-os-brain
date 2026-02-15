import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useWorkspace } from '@/contexts/WorkspaceContext';

export interface BookingSubscription {
  id: string;
  workspace_id: string;
  status: string;
  plan: string;
  started_at: string;
  expires_at: string | null;
  grace_period_days: number;
  created_at: string;
  updated_at: string;
}

export function useBookingSubscription() {
  const { currentWorkspace } = useWorkspace();
  const workspaceId = currentWorkspace?.id;

  const { data: subscription, isLoading } = useQuery({
    queryKey: ['booking-subscription', workspaceId],
    queryFn: async () => {
      if (!workspaceId) return null;
      const { data, error } = await supabase
        .from('booking_subscriptions')
        .select('*')
        .eq('workspace_id', workspaceId)
        .maybeSingle();
      if (error) throw error;
      return data as BookingSubscription | null;
    },
    enabled: !!workspaceId,
  });

  // Check for active app_plan_override grant (safety net)
  const { data: appOverrideGrant } = useQuery({
    queryKey: ['booking-app-override', workspaceId],
    queryFn: async () => {
      if (!workspaceId) return null;
      const { data, error } = await supabase
        .from('platform_grants')
        .select('*')
        .eq('scope', 'workspace')
        .eq('scope_id', workspaceId)
        .eq('grant_type', 'app_plan_override')
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) {
        console.warn('Could not fetch app_plan_override grant:', error.message);
        return null;
      }
      // Filter to booking app_id
      if (data && (data as any).value_json?.app_id === 'booking') return data;
      return null;
    },
    enabled: !!workspaceId,
  });

  const hasOverride = !!appOverrideGrant;

  // If override grant exists, treat as active regardless of subscription table
  const isActive = hasOverride || subscription?.status === 'active';
  const isTrial = !hasOverride && subscription?.status === 'trial';
  const isGracePeriod = !hasOverride && subscription?.status === 'grace';
  const isSuspended = !hasOverride && (subscription?.status === 'suspended' || subscription?.status === 'expired');

  let daysRemaining: number | null = null;
  if (subscription?.expires_at) {
    const now = new Date();
    const expires = new Date(subscription.expires_at);
    daysRemaining = Math.max(0, Math.ceil((expires.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
  }

  const canWrite = isActive || isTrial || isGracePeriod;

  return {
    subscription,
    isLoading,
    isActive,
    isTrial,
    isGracePeriod,
    isSuspended,
    daysRemaining,
    canWrite,
    isOverride: hasOverride,
    overrideGrant: appOverrideGrant,
  };
}
