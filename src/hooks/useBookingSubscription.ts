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

  const isActive = subscription?.status === 'active';
  const isTrial = subscription?.status === 'trial';
  const isGracePeriod = subscription?.status === 'grace';
  const isSuspended = subscription?.status === 'suspended' || subscription?.status === 'expired';

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
  };
}
