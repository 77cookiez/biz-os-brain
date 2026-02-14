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
  created_at: string;
  updated_at: string;
}

export function useBookingSettings() {
  const { currentWorkspace } = useWorkspace();
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const workspaceId = currentWorkspace?.id;

  const { data: settings, isLoading } = useQuery({
    queryKey: ['booking-settings', workspaceId],
    queryFn: async () => {
      if (!workspaceId) return null;
      const { data, error } = await supabase
        .from('booking_settings')
        .select('*')
        .eq('workspace_id', workspaceId)
        .maybeSingle();
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
      toast.success(t('booking.wizard.saved'));
    },
    onError: () => {
      toast.error(t('booking.wizard.saveFailed'));
    },
  });

  return { settings, isLoading, upsertSettings };
}
