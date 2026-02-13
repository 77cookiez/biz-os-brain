import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { useAuth } from '@/contexts/AuthContext';
import { useOIL } from '@/hooks/useOIL';
import { useBookingSubscription } from '@/hooks/useBookingSubscription';
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
  total_amount: number;
  deposit_paid: number | null;
  currency: string;
  event_date: string | null;
  cancellation_reason: string | null;
  completed_at: string | null;
  cancelled_at: string | null;
  created_at: string;
}

export interface BookingPayment {
  id: string;
  booking_id: string;
  amount: number;
  currency: string;
  payment_type: string;
  provider: string;
  status: string;
  payment_reference: string | null;
  paid_at: string | null;
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

  // Create booking from accepted quote (idempotent — checks for existing)
  const createBooking = useMutation({
    mutationFn: async (input: {
      quote_id: string;
      quote_request_id: string;
      vendor_id: string;
      customer_user_id: string;
      total_amount: number;
      currency?: string;
      event_date?: string;
    }) => {
      if (!workspaceId || !user) throw new Error('Not authenticated');
      if (!canWrite) throw new Error('Subscription inactive');

      // Idempotency: check if booking already exists for this quote
      const { data: existing } = await supabase
        .from('booking_bookings')
        .select('id')
        .eq('quote_id', input.quote_id)
        .maybeSingle();
      if (existing) return existing.id; // Already created

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
          status: 'paid_confirmed' as any,
        } as any)
        .select('id')
        .single();
      if (error) throw error;
      return data.id;
    },
    onSuccess: (bookingId) => {
      queryClient.invalidateQueries({ queryKey: ['booking-bookings'] });
      toast.success(t('booking.bookings.paymentConfirmed'));
      emitEvent({
        event_type: 'booking.booking_confirmed',
        object_type: 'booking_booking',
        metadata: { booking_id: bookingId },
      });
    },
    onError: () => toast.error(t('booking.bookings.paymentFailed')),
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

      // Idempotency: check by booking_id + payment_reference
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
      const booking = bookings.find(b => b.id === bookingId);
      if (booking && booking.status !== 'paid_confirmed') {
        throw new Error('Can only complete paid bookings');
      }
      const { error } = await supabase
        .from('booking_bookings')
        .update({
          status: 'completed' as any,
          completed_at: new Date().toISOString(),
        } as any)
        .eq('id', bookingId);
      if (error) throw error;
    },
    onSuccess: (_, bookingId) => {
      queryClient.invalidateQueries({ queryKey: ['booking-bookings'] });
      toast.success(t('booking.bookings.bookingCompleted'));
      emitEvent({
        event_type: 'booking.booking_completed',
        object_type: 'booking_booking',
        metadata: { booking_id: bookingId },
      });
    },
    onError: () => toast.error(t('booking.bookings.bookingCompleteFailed')),
  });

  // Cancel booking
  const cancelBooking = useMutation({
    mutationFn: async ({ bookingId, reason }: { bookingId: string; reason?: string }) => {
      if (!user) throw new Error('Not authenticated');
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

      // Also cancel the quote request
      if (booking?.quote_request_id) {
        await supabase
          .from('booking_quote_requests')
          .update({ status: 'cancelled' as any })
          .eq('id', booking.quote_request_id);
      }
    },
    onSuccess: (_, { bookingId }) => {
      queryClient.invalidateQueries({ queryKey: ['booking-bookings'] });
      queryClient.invalidateQueries({ queryKey: ['booking-quote-requests'] });
      toast.success(t('booking.bookings.bookingCancelled'));
      emitEvent({
        event_type: 'booking.booking_cancelled',
        object_type: 'booking_booking',
        metadata: { booking_id: bookingId },
        severity_hint: 'warning',
      });
    },
    onError: () => toast.error(t('booking.bookings.bookingCancelFailed')),
  });

  return {
    bookings,
    isLoading,
    createBooking,
    recordPayment,
    markComplete,
    cancelBooking,
  };
}
