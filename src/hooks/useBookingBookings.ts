import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { useAuth } from '@/contexts/AuthContext';
import { useOIL } from '@/hooks/useOIL';
import { useBookingSubscription } from '@/hooks/useBookingSubscription';
import { auditAndEmit } from '@/lib/booking/auditHelper';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';

export interface BookingBooking {
  id: string;
  workspace_id: string;
  quote_id: string;
  quote_request_id: string;
  vendor_id: string;
  customer_user_id: string;
  status: string;
  payment_status: string;
  payment_provider: string | null;
  offline_payment_method: string | null;
  total_amount: number;
  deposit_paid: number | null;
  paid_amount: number | null;
  currency: string;
  event_date: string | null;
  cancellation_reason: string | null;
  completed_at: string | null;
  cancelled_at: string | null;
  payment_intent_id: string | null;
  created_at: string;
}

export function useBookingBookings() {
  const { currentWorkspace } = useWorkspace();
  const { user } = useAuth();
  const { emitEvent } = useOIL();
  const { canWrite } = useBookingSubscription();
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const workspaceId = currentWorkspace?.id;

  const { data: bookings = [], isLoading } = useQuery({
    queryKey: ['booking-bookings', workspaceId],
    queryFn: async () => {
      if (!workspaceId) return [];
      const { data, error } = await supabase
        .from('booking_bookings')
        .select('*')
        .eq('workspace_id', workspaceId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as BookingBooking[];
    },
    enabled: !!workspaceId,
  });

  // Create booking (offline-first: no payment required)
  const createBooking = useMutation({
    mutationFn: async (input: {
      quote_id: string;
      quote_request_id: string;
      vendor_id: string;
      customer_user_id: string;
      total_amount: number;
      currency?: string;
      event_date?: string;
      payment_provider?: string;
    }) => {
      if (!workspaceId || !user) throw new Error('Not authenticated');
      if (!canWrite) throw new Error('Subscription inactive');

      // Idempotency: check if booking already exists for this quote
      const { data: existing } = await supabase
        .from('booking_bookings')
        .select('id')
        .eq('quote_id', input.quote_id)
        .maybeSingle();
      if (existing) return existing.id;

      const { data, error } = await supabase
        .from('booking_bookings')
        .insert({
          workspace_id: workspaceId,
          quote_id: input.quote_id,
          quote_request_id: input.quote_request_id,
          vendor_id: input.vendor_id,
          customer_user_id: input.customer_user_id,
          total_amount: input.total_amount,
          currency: input.currency || 'AED',
          event_date: input.event_date || null,
          status: 'confirmed_pending_payment' as any,
          payment_status: 'unpaid',
          payment_provider: input.payment_provider || 'offline',
        } as any)
        .select('id')
        .single();
      if (error) throw error;
      return data.id;
    },
    onSuccess: (bookingId) => {
      queryClient.invalidateQueries({ queryKey: ['booking-bookings'] });
      toast.success(t('booking.bookings.bookingCreated', 'Booking confirmed'));
      emitEvent({
        event_type: 'booking.booking_confirmed',
        object_type: 'booking_booking',
        metadata: { booking_id: bookingId },
      });
    },
    onError: () => toast.error(t('booking.bookings.bookingCreateFailed', 'Failed to create booking')),
  });

  // Mark as Paid (offline payment confirmation)
  const markAsPaid = useMutation({
    mutationFn: async ({
      bookingId,
      method,
      amount,
    }: {
      bookingId: string;
      method?: string;
      amount?: number;
    }) => {
      if (!workspaceId || !user) throw new Error('Not authenticated');
      const booking = bookings.find(b => b.id === bookingId);
      if (!booking) throw new Error('Booking not found');

      const paidAmount = amount ?? booking.total_amount;

      const { error } = await supabase
        .from('booking_bookings')
        .update({
          payment_status: 'paid',
          status: 'paid_confirmed' as any,
          paid_amount: paidAmount,
          offline_payment_method: method || 'cash',
        } as any)
        .eq('id', bookingId);
      if (error) throw error;

      // Record payment
      await supabase.from('booking_payments').insert({
        workspace_id: workspaceId,
        booking_id: bookingId,
        amount: paidAmount,
        currency: booking.currency,
        payment_type: 'full',
        provider: 'offline',
        payment_reference: `offline_${method || 'cash'}_${Date.now()}`,
        status: 'paid',
        paid_at: new Date().toISOString(),
        metadata: { method: method || 'cash', marked_by: user.id },
      } as any);

      // Audit + OIL
      await auditAndEmit({
        workspace_id: workspaceId,
        actor_user_id: user.id,
        action: 'booking.payment_marked_paid',
        event_type: 'booking.payment_marked_paid',
        entity_type: 'booking_booking',
        entity_id: bookingId,
        metadata: { method: method || 'cash', amount: paidAmount },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['booking-bookings'] });
      toast.success(t('booking.bookings.markedAsPaid', 'Booking marked as paid'));
    },
    onError: () => toast.error(t('booking.bookings.markAsPaidFailed', 'Failed to mark as paid')),
  });

  // Record payment (idempotent — checks for existing by reference)
  const recordPayment = useMutation({
    mutationFn: async (input: {
      booking_id: string;
      amount: number;
      currency?: string;
      payment_type?: string;
      provider?: string;
      payment_reference?: string;
    }) => {
      if (!workspaceId) throw new Error('No workspace');

      if (input.payment_reference) {
        const { data: existing } = await supabase
          .from('booking_payments')
          .select('id')
          .eq('booking_id', input.booking_id)
          .eq('payment_reference', input.payment_reference)
          .maybeSingle();
        if (existing) return existing.id;
      }

      const { data, error } = await supabase
        .from('booking_payments')
        .insert({
          workspace_id: workspaceId,
          booking_id: input.booking_id,
          amount: input.amount,
          currency: input.currency || 'AED',
          payment_type: input.payment_type || 'deposit',
          provider: input.provider || 'manual',
          payment_reference: input.payment_reference || null,
          status: 'paid',
          paid_at: new Date().toISOString(),
        } as any)
        .select('id')
        .single();
      if (error) throw error;

      emitEvent({
        event_type: 'booking.payment_captured',
        object_type: 'booking_payment',
        metadata: { booking_id: input.booking_id, amount: input.amount },
      });

      return data.id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['booking-bookings'] });
      toast.success(t('booking.payment.paymentRecorded'));
    },
    onError: () => toast.error(t('booking.payment.paymentFailed')),
  });

  // Mark complete
  const markComplete = useMutation({
    mutationFn: async (bookingId: string) => {
      if (!workspaceId || !user) throw new Error('Not authenticated');
      const booking = bookings.find(b => b.id === bookingId);
      if (booking && !['paid_confirmed', 'confirmed_pending_payment'].includes(booking.status)) {
        throw new Error('Can only complete confirmed bookings');
      }
      const { error } = await supabase
        .from('booking_bookings')
        .update({
          status: 'completed' as any,
          completed_at: new Date().toISOString(),
        } as any)
        .eq('id', bookingId);
      if (error) throw error;

      await auditAndEmit({
        workspace_id: workspaceId,
        actor_user_id: user.id,
        action: 'booking.booking_completed',
        event_type: 'booking.booking_completed',
        entity_type: 'booking_booking',
        entity_id: bookingId,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['booking-bookings'] });
      toast.success(t('booking.bookings.bookingCompleted'));
    },
    onError: () => toast.error(t('booking.bookings.bookingCompleteFailed')),
  });

  // Cancel booking
  const cancelBooking = useMutation({
    mutationFn: async ({ bookingId, reason }: { bookingId: string; reason?: string }) => {
      if (!user || !workspaceId) throw new Error('Not authenticated');
      const booking = bookings.find(b => b.id === bookingId);
      if (booking && (booking.status === 'completed' || booking.status === 'cancelled')) {
        throw new Error(`Cannot cancel a ${booking.status} booking`);
      }
      const { error } = await supabase
        .from('booking_bookings')
        .update({
          status: 'cancelled' as any,
          cancelled_at: new Date().toISOString(),
          cancelled_by: user.id,
          cancellation_reason: reason || null,
        } as any)
        .eq('id', bookingId);
      if (error) throw error;

      if (booking?.quote_request_id) {
        await supabase
          .from('booking_quote_requests')
          .update({ status: 'cancelled' as any })
          .eq('id', booking.quote_request_id);
      }

      await auditAndEmit({
        workspace_id: workspaceId,
        actor_user_id: user.id,
        action: 'booking.booking_cancelled',
        event_type: 'booking.booking_cancelled',
        entity_type: 'booking_booking',
        entity_id: bookingId,
        metadata: { reason },
      });
    },
    onSuccess: (_, { bookingId }) => {
      queryClient.invalidateQueries({ queryKey: ['booking-bookings'] });
      queryClient.invalidateQueries({ queryKey: ['booking-quote-requests'] });
      toast.success(t('booking.bookings.bookingCancelled'));
    },
    onError: () => toast.error(t('booking.bookings.bookingCancelFailed')),
  });

  return {
    bookings,
    isLoading,
    createBooking,
    markAsPaid,
    recordPayment,
    markComplete,
    cancelBooking,
  };
}
