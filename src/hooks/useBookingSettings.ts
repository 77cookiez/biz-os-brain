import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';

export interface BookingSettings {
  id: string;
  workspace_id: string;
  theme_template: string;
  primary_color: string | null;
  accent_color: string | null;
  tone: string | null;
  logo_url: string | null;
  currency: string;
  commission_mode: string;
  commission_rate: number | null;
  deposit_enabled: boolean;
  deposit_type: string | null;
  deposit_value: number | null;
  cancellation_policy: string;
  refund_policy: string | null;
  payment_provider: string | null;
  payment_config: Record<string, unknown> | null;
  tenant_slug: string | null;
  is_live: boolean;
  ai_booking_assistant_enabled: boolean;
  distribution_mode: string;
  whatsapp_number: string | null;
  contact_email: string | null;
  app_name: string | null;
  app_icon_url: string | null;
  app_splash_url: string | null;
  app_description: string | null;
  app_bundle_id: string | null;
  app_keywords: string | null;
  app_support_email: string | null;
  app_privacy_url: string | null;
  app_version: string | null;
  app_build_number: number | null;
  publishing_progress: Record<string, Record<string, boolean>> | null;
  stripe_account_id: string | null;
  stripe_onboarding_completed: boolean;
  payment_mode: string;
  offline_methods: string[];
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  deleted_by: string | null;
}

/** Returns all non-deleted sites for the workspace */
export function useBookingSettingsList() {
  const { currentWorkspace } = useWorkspace();
  const workspaceId = currentWorkspace?.id;

  const { data: sites, isLoading } = useQuery({
    queryKey: ['booking-settings-list', workspaceId],
    queryFn: async () => {
      if (!workspaceId) return [];
      const { data, error } = await supabase
        .from('booking_settings')
        .select('*')
        .eq('workspace_id', workspaceId)
        .is('deleted_at', null)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return (data ?? []) as BookingSettings[];
    },
    enabled: !!workspaceId,
  });

  return { sites: sites ?? [], isLoading };
}

/** 
 * Hook to manage a single booking site settings.
 * If siteId is provided, it fetches that specific site.
 * If no siteId, it falls back to the first site (backward compatibility).
 */
export function useBookingSettings(siteId?: string | null) {
  const { currentWorkspace } = useWorkspace();
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const workspaceId = currentWorkspace?.id;

  const { data: settings, isLoading } = useQuery({
    queryKey: ['booking-settings', workspaceId, siteId],
    queryFn: async () => {
      if (!workspaceId) return null;
      
      let query = supabase
        .from('booking_settings')
        .select('*')
        .eq('workspace_id', workspaceId)
        .is('deleted_at', null);

      if (siteId) {
        query = query.eq('id', siteId);
      } else {
        query = query.order('created_at', { ascending: true }).limit(1);
      }

      const { data, error } = await query.maybeSingle();
      
      if (error) throw error;
      return data as BookingSettings | null;
    },
    enabled: !!workspaceId,
  });

  const upsertSettings = useMutation({
    mutationFn: async (updates: Record<string, unknown>) => {
      if (!workspaceId) throw new Error('No workspace');

      if (settings?.id) {
        const { error } = await supabase
          .from('booking_settings')
          .update(updates as any)
          .eq('id', settings.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('booking_settings')
          .insert({ workspace_id: workspaceId, ...updates } as any);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['booking-settings', workspaceId] });
      queryClient.invalidateQueries({ queryKey: ['booking-settings-list', workspaceId] });
      toast.success(t('booking.wizard.saved'));
    },
    onError: (error: any) => {
      if (error?.code === 'P0001') {
        toast.error(t('booking.sites.limitReached', 'Plan limit reached'));
      } else {
        toast.error(t('booking.wizard.saveFailed'));
      }
    },
  });

  const deleteSite = useMutation({
    mutationFn: async (targetSiteId: string) => {
      if (!workspaceId) throw new Error('No workspace');
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase
        .from('booking_settings')
        .update({ deleted_at: new Date().toISOString(), deleted_by: user?.id, is_live: false } as any)
        .eq('id', targetSiteId)
        .eq('workspace_id', workspaceId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['booking-settings', workspaceId] });
      queryClient.invalidateQueries({ queryKey: ['booking-settings-list', workspaceId] });
      toast.success(t('booking.sites.deleted', 'Site deleted'));
    },
    onError: () => {
      toast.error(t('booking.sites.deleteFailed', 'Failed to delete site'));
    },
  });

  // BookEvo SaaS: always offline-only, no Stripe payment processing
  const isStripeEnabled = false;
  const isOfflineOnly = true;

  return { settings, isLoading, upsertSettings, deleteSite, isStripeEnabled, isOfflineOnly };
}
