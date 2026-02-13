import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { useAuth } from '@/contexts/AuthContext';
import { useOIL } from '@/hooks/useOIL';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';

export interface BookingVendor {
  id: string;
  workspace_id: string;
  owner_user_id: string;
  status: 'pending' | 'approved' | 'suspended';
  approved_at: string | null;
  approved_by: string | null;
  suspended_at: string | null;
  created_at: string;
  updated_at: string;
  // joined profile
  profile?: {
    display_name: string;
    bio: string | null;
    email: string | null;
    whatsapp: string | null;
    meaning_object_id: string;
  } | null;
}

export function useBookingVendors() {
  const { currentWorkspace } = useWorkspace();
  const { user } = useAuth();
  const { emitEvent } = useOIL();
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const workspaceId = currentWorkspace?.id;

  const { data: vendors = [], isLoading } = useQuery({
    queryKey: ['booking-vendors', workspaceId],
    queryFn: async () => {
      if (!workspaceId) return [];
      const { data, error } = await supabase
        .from('booking_vendors')
        .select('*, profile:booking_vendor_profiles(*)')
        .eq('workspace_id', workspaceId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      // Flatten profile from array to single object
      return (data || []).map((v: any) => ({
        ...v,
        profile: Array.isArray(v.profile) ? v.profile[0] || null : v.profile,
      })) as BookingVendor[];
    },
    enabled: !!workspaceId,
  });

  const approveVendor = useMutation({
    mutationFn: async (vendorId: string) => {
      if (!user) throw new Error('Not authenticated');
      const { error } = await supabase
        .from('booking_vendors')
        .update({
          status: 'approved' as any,
          approved_at: new Date().toISOString(),
          approved_by: user.id,
        })
        .eq('id', vendorId);
      if (error) throw error;

      // Audit log
      if (workspaceId) {
        await supabase.from('audit_logs').insert({
          workspace_id: workspaceId,
          actor_user_id: user.id,
          action: 'booking.vendor_approved',
          entity_type: 'booking_vendor',
          entity_id: vendorId,
        });
      }
    },
    onSuccess: (_, vendorId) => {
      queryClient.invalidateQueries({ queryKey: ['booking-vendors', workspaceId] });
      toast.success(t('booking.vendors.vendorApproved'));
      emitEvent({
        event_type: 'booking.vendor_approved',
        object_type: 'booking_vendor',
        metadata: { vendor_id: vendorId },
      });
    },
    onError: () => toast.error(t('booking.vendors.actionFailed')),
  });

  const suspendVendor = useMutation({
    mutationFn: async (vendorId: string) => {
      if (!user) throw new Error('Not authenticated');
      const { error } = await supabase
        .from('booking_vendors')
        .update({
          status: 'suspended' as any,
          suspended_at: new Date().toISOString(),
        })
        .eq('id', vendorId);
      if (error) throw error;

      if (workspaceId) {
        await supabase.from('audit_logs').insert({
          workspace_id: workspaceId,
          actor_user_id: user.id,
          action: 'booking.vendor_suspended',
          entity_type: 'booking_vendor',
          entity_id: vendorId,
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['booking-vendors', workspaceId] });
      toast.success(t('booking.vendors.vendorSuspended'));
    },
    onError: () => toast.error(t('booking.vendors.actionFailed')),
  });

  const reactivateVendor = useMutation({
    mutationFn: async (vendorId: string) => {
      if (!user) throw new Error('Not authenticated');
      const { error } = await supabase
        .from('booking_vendors')
        .update({
          status: 'approved' as any,
          suspended_at: null,
        })
        .eq('id', vendorId);
      if (error) throw error;

      if (workspaceId) {
        await supabase.from('audit_logs').insert({
          workspace_id: workspaceId,
          actor_user_id: user.id,
          action: 'booking.vendor_reactivated',
          entity_type: 'booking_vendor',
          entity_id: vendorId,
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['booking-vendors', workspaceId] });
      toast.success(t('booking.vendors.vendorReactivated'));
    },
    onError: () => toast.error(t('booking.vendors.actionFailed')),
  });

  return {
    vendors,
    isLoading,
    approveVendor,
    suspendVendor,
    reactivateVendor,
  };
}
