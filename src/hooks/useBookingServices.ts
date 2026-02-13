import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useOIL } from '@/hooks/useOIL';
import { useBookingSubscription } from '@/hooks/useBookingSubscription';
import { createMeaningObject, buildMeaningFromText } from '@/lib/meaningObject';
import { guardMeaningInsert } from '@/lib/meaningGuard';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';

export interface BookingService {
  id: string;
  workspace_id: string;
  vendor_id: string;
  title: string;
  description: string | null;
  price_type: string;
  price_amount: number | null;
  currency: string;
  min_guests: number | null;
  max_guests: number | null;
  duration_minutes: number | null;
  is_active: boolean;
  sort_order: number | null;
  meaning_object_id: string;
  source_lang: string | null;
  created_at: string;
  updated_at: string;
  vendor_name?: string;
}

export interface BookingServiceAddon {
  id: string;
  service_id: string;
  name: string;
  price: number;
  currency: string;
  meaning_object_id: string;
}

export function useBookingServices(vendorId?: string) {
  const { currentWorkspace } = useWorkspace();
  const { user } = useAuth();
  const { currentLanguage } = useLanguage();
  const { emitEvent } = useOIL();
  const { canWrite } = useBookingSubscription();
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const workspaceId = currentWorkspace?.id;

  const { data: services = [], isLoading } = useQuery({
    queryKey: ['booking-services', workspaceId, vendorId],
    queryFn: async () => {
      if (!workspaceId) return [];
      let q = supabase
        .from('booking_services')
        .select('*, vendor:booking_vendors(id, booking_vendor_profiles(display_name))')
        .eq('workspace_id', workspaceId)
        .order('sort_order', { ascending: true });
      if (vendorId) q = q.eq('vendor_id', vendorId);
      const { data, error } = await q;
      if (error) throw error;
      return (data || []).map((s: any) => ({
        ...s,
        vendor_name: s.vendor?.booking_vendor_profiles?.[0]?.display_name || '—',
      })) as BookingService[];
    },
    enabled: !!workspaceId,
  });

  const createService = useMutation({
    mutationFn: async (input: {
      vendor_id: string;
      title: string;
      description?: string;
      price_type: string;
      price_amount?: number;
      currency?: string;
      min_guests?: number;
      max_guests?: number;
      duration_minutes?: number;
    }) => {
      if (!workspaceId || !user) throw new Error('Not authenticated');
      if (!canWrite) throw new Error('Subscription inactive');

      const meaningId = await createMeaningObject({
        workspaceId,
        createdBy: user.id,
        type: 'TASK', // reuse type for services
        sourceLang: currentLanguage.code,
        meaningJson: buildMeaningFromText({
          type: 'TASK',
          title: input.title,
          description: input.description,
          createdFrom: 'user',
        }),
      });
      if (!meaningId) throw new Error('Failed to create meaning object');

      const payload = {
        workspace_id: workspaceId,
        vendor_id: input.vendor_id,
        title: input.title,
        description: input.description || null,
        price_type: input.price_type,
        price_amount: input.price_amount || null,
        currency: input.currency || 'AED',
        min_guests: input.min_guests || null,
        max_guests: input.max_guests || null,
        duration_minutes: input.duration_minutes || null,
        meaning_object_id: meaningId,
        source_lang: currentLanguage.code,
      };
      guardMeaningInsert('booking_services', payload);
      const { error } = await supabase.from('booking_services').insert(payload as any);
      if (error) throw error;
      return meaningId;
    },
    onSuccess: (meaningId) => {
      queryClient.invalidateQueries({ queryKey: ['booking-services'] });
      toast.success(t('booking.services.serviceCreated'));
      emitEvent({
        event_type: 'booking.service_created',
        object_type: 'booking_service',
        meaning_object_id: meaningId,
      });
    },
    onError: () => toast.error(t('booking.services.serviceCreateFailed')),
  });

  const updateService = useMutation({
    mutationFn: async ({ id, ...updates }: { id: string } & Partial<BookingService>) => {
      const { error } = await supabase
        .from('booking_services')
        .update(updates as any)
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['booking-services'] });
      toast.success(t('booking.services.serviceUpdated'));
    },
    onError: () => toast.error(t('booking.services.serviceUpdateFailed')),
  });

  const toggleActive = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase
        .from('booking_services')
        .update({ is_active } as any)
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['booking-services'] });
    },
  });

  return { services, isLoading, createService, updateService, toggleActive };
}
