import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';

export interface DaySlot {
  start: string;
  end: string;
}

export type WeeklyRules = Record<string, DaySlot[]>;

export interface BlackoutDate {
  id: string;
  blackout_date: string;
  reason: string | null;
  vendor_id: string;
}

export function useBookingAvailability(vendorId?: string) {
  const { currentWorkspace } = useWorkspace();
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const workspaceId = currentWorkspace?.id;

  const { data: rules, isLoading: rulesLoading } = useQuery({
    queryKey: ['booking-availability', workspaceId, vendorId],
    queryFn: async () => {
      if (!workspaceId || !vendorId) return null;
      const { data, error } = await supabase
        .from('booking_availability_rules')
        .select('*')
        .eq('workspace_id', workspaceId)
        .eq('vendor_id', vendorId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!workspaceId && !!vendorId,
  });

  const { data: blackouts = [], isLoading: blackoutsLoading } = useQuery({
    queryKey: ['booking-blackouts', workspaceId, vendorId],
    queryFn: async () => {
      if (!workspaceId || !vendorId) return [];
      const { data, error } = await supabase
        .from('booking_blackout_dates')
        .select('*')
        .eq('workspace_id', workspaceId)
        .eq('vendor_id', vendorId)
        .order('blackout_date', { ascending: true });
      if (error) throw error;
      return data as BlackoutDate[];
    },
    enabled: !!workspaceId && !!vendorId,
  });

  const upsertRules = useMutation({
    mutationFn: async (weeklyRules: WeeklyRules) => {
      if (!workspaceId || !vendorId) throw new Error('Missing context');
      if (rules?.id) {
        const { error } = await supabase
          .from('booking_availability_rules')
          .update({ rules: weeklyRules as any })
          .eq('id', rules.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('booking_availability_rules')
          .insert({
            workspace_id: workspaceId,
            vendor_id: vendorId,
            rules: weeklyRules as any,
          } as any);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['booking-availability'] });
      toast.success(t('booking.calendar.availabilityUpdated'));
    },
    onError: () => toast.error(t('booking.calendar.availabilityFailed')),
  });

  const addBlackout = useMutation({
    mutationFn: async ({ date, reason }: { date: string; reason?: string }) => {
      if (!workspaceId || !vendorId) throw new Error('Missing context');
      const { error } = await supabase
        .from('booking_blackout_dates')
        .insert({
          workspace_id: workspaceId,
          vendor_id: vendorId,
          blackout_date: date,
          reason: reason || null,
        } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['booking-blackouts'] });
      toast.success(t('booking.calendar.blackoutAdded'));
    },
    onError: () => toast.error(t('booking.calendar.blackoutFailed')),
  });

  const removeBlackout = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('booking_blackout_dates')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['booking-blackouts'] });
      toast.success(t('booking.calendar.blackoutRemoved'));
    },
    onError: () => toast.error(t('booking.calendar.blackoutFailed')),
  });

  const weeklyRules: WeeklyRules = (rules?.rules as unknown as WeeklyRules) || {};

  return {
    weeklyRules,
    blackouts,
    isLoading: rulesLoading || blackoutsLoading,
    upsertRules,
    addBlackout,
    removeBlackout,
  };
}
