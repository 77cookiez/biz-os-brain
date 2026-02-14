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

export interface BookingQuoteRequest {
  id: string;
  workspace_id: string;
  customer_user_id: string;
  vendor_id: string;
  service_id: string;
  status: string;
  event_date: string | null;
  event_time: string | null;
  guest_count: number | null;
  notes: string | null;
  meaning_object_id: string; // for request notes
  chat_thread_id: string | null;
  created_at: string;
  updated_at: string;
  // joined service meaning fields
  service_title_fallback?: string;
  service_title_meaning_id?: string | null;
  // joined vendor profile meaning fields
  vendor_display_name_fallback?: string;
  vendor_display_name_meaning_id?: string | null;
}

export interface BookingQuote {
  id: string;
  quote_request_id: string;
  vendor_id: string;
  workspace_id: string;
  amount: number;
  currency: string;
  deposit_amount: number | null;
  notes: string | null;
  status: string;
  meaning_object_id: string;
  expires_at: string | null;
  expiry_hours: number;
  created_at: string;
}

// Valid status transitions
const VALID_TRANSITIONS: Record<string, string[]> = {
  requested: ['quoted', 'cancelled'],
  quoted: ['accepted', 'cancelled'],
  accepted: ['paid_confirmed', 'cancelled'],
  paid_confirmed: ['completed', 'cancelled'],
  completed: [],
  cancelled: [],
};

function canTransition(from: string, to: string): boolean {
  return VALID_TRANSITIONS[from]?.includes(to) ?? false;
}

export function useBookingQuotes() {
  const { currentWorkspace } = useWorkspace();
  const { user } = useAuth();
  const { currentLanguage } = useLanguage();
  const { emitEvent } = useOIL();
  const { canWrite } = useBookingSubscription();
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const workspaceId = currentWorkspace?.id;

  // Quote requests
  const { data: quoteRequests = [], isLoading: requestsLoading } = useQuery({
    queryKey: ['booking-quote-requests', workspaceId],
    queryFn: async () => {
      if (!workspaceId) return [];
      const { data, error } = await supabase
        .from('booking_quote_requests')
        .select('*, service:booking_services(title, title_meaning_object_id), vendor:booking_vendors(booking_vendor_profiles(display_name, display_name_meaning_object_id))')
        .eq('workspace_id', workspaceId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []).map((qr: any) => ({
        ...qr,
        service_title_fallback: qr.service?.title || '—',
        service_title_meaning_id: qr.service?.title_meaning_object_id || null,
        vendor_display_name_fallback: qr.vendor?.booking_vendor_profiles?.[0]?.display_name || '—',
        vendor_display_name_meaning_id: qr.vendor?.booking_vendor_profiles?.[0]?.display_name_meaning_object_id || null,
      })) as BookingQuoteRequest[];
    },
    enabled: !!workspaceId,
  });

  // Quotes
  const { data: quotes = [], isLoading: quotesLoading } = useQuery({
    queryKey: ['booking-quotes', workspaceId],
    queryFn: async () => {
      if (!workspaceId) return [];
      const { data, error } = await supabase
        .from('booking_quotes')
        .select('*')
        .eq('workspace_id', workspaceId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as BookingQuote[];
    },
    enabled: !!workspaceId,
  });

  // Create quote request (customer action)
  const createQuoteRequest = useMutation({
    mutationFn: async (input: {
      vendor_id: string;
      service_id: string;
      event_date?: string;
      event_time?: string;
      guest_count?: number;
      notes?: string;
    }) => {
      if (!workspaceId || !user) throw new Error('Not authenticated');
      if (!canWrite) throw new Error('Subscription inactive');

      const meaningId = await createMeaningObject({
        workspaceId,
        createdBy: user.id,
        type: 'MESSAGE',
        sourceLang: currentLanguage.code,
        meaningJson: buildMeaningFromText({
          type: 'MESSAGE',
          title: input.notes || 'Quote request',
          description: `Event: ${input.event_date || 'TBD'}, Guests: ${input.guest_count || 'TBD'}`,
          createdFrom: 'user',
        }),
      });
      if (!meaningId) throw new Error('Failed to create meaning object');

      const payload = {
        workspace_id: workspaceId,
        customer_user_id: user.id,
        vendor_id: input.vendor_id,
        service_id: input.service_id,
        event_date: input.event_date || null,
        event_time: input.event_time || null,
        guest_count: input.guest_count || null,
        notes: input.notes || null,
        meaning_object_id: meaningId,
        source_lang: currentLanguage.code,
        status: 'requested' as any,
      };
      guardMeaningInsert('booking_quote_requests', payload);
      const { data, error } = await supabase
        .from('booking_quote_requests')
        .insert(payload as any)
        .select('id')
        .single();
      if (error) throw error;
      return { id: data.id, meaningId };
    },
    onSuccess: ({ meaningId }) => {
      queryClient.invalidateQueries({ queryKey: ['booking-quote-requests'] });
      toast.success(t('booking.quotes.requestSubmitted'));
      emitEvent({
        event_type: 'booking.quote_requested',
        object_type: 'booking_quote_request',
        meaning_object_id: meaningId,
      });
    },
    onError: () => toast.error(t('booking.quotes.requestFailed')),
  });

  // Send quote (vendor action)
  const sendQuote = useMutation({
    mutationFn: async (input: {
      quote_request_id: string;
      vendor_id: string;
      amount: number;
      currency?: string;
      deposit_amount?: number;
      notes?: string;
      expiry_hours?: number;
    }) => {
      if (!workspaceId || !user) throw new Error('Not authenticated');

      const qr = quoteRequests.find(r => r.id === input.quote_request_id);
      if (qr && !canTransition(qr.status, 'quoted')) {
        throw new Error(`Cannot transition from ${qr.status} to quoted`);
      }

      const meaningId = await createMeaningObject({
        workspaceId,
        createdBy: user.id,
        type: 'MESSAGE',
        sourceLang: currentLanguage.code,
        meaningJson: buildMeaningFromText({
          type: 'MESSAGE',
          title: input.notes || `Quote: ${input.amount}`,
          createdFrom: 'user',
        }),
      });
      if (!meaningId) throw new Error('Failed to create meaning object');

      const expiryHours = input.expiry_hours || 48;
      const expiresAt = new Date(Date.now() + expiryHours * 3600000).toISOString();

      const payload = {
        workspace_id: workspaceId,
        quote_request_id: input.quote_request_id,
        vendor_id: input.vendor_id,
        amount: input.amount,
        currency: input.currency || 'USD',
        deposit_amount: input.deposit_amount || null,
        notes: input.notes || null,
        meaning_object_id: meaningId,
        source_lang: currentLanguage.code,
        expiry_hours: expiryHours,
        expires_at: expiresAt,
      };
      guardMeaningInsert('booking_quotes', payload);
      const { error } = await supabase.from('booking_quotes').insert(payload as any);
      if (error) throw error;

      await supabase
        .from('booking_quote_requests')
        .update({ status: 'quoted' as any })
        .eq('id', input.quote_request_id);

      return meaningId;
    },
    onSuccess: (meaningId) => {
      queryClient.invalidateQueries({ queryKey: ['booking-quotes'] });
      queryClient.invalidateQueries({ queryKey: ['booking-quote-requests'] });
      toast.success(t('booking.quotes.quoteSent'));
      emitEvent({
        event_type: 'booking.quote_sent',
        object_type: 'booking_quote',
        meaning_object_id: meaningId,
      });
    },
    onError: () => toast.error(t('booking.quotes.quoteFailed')),
  });

  // Accept quote (atomic server-side RPC — prevents race conditions)
  const acceptQuote = useMutation({
    mutationFn: async ({ quoteId }: { quoteId: string; quoteRequestId?: string }) => {
      if (!user) throw new Error('Not authenticated');

      const { data, error } = await supabase.rpc('accept_quote_atomic', {
        _quote_id: quoteId,
        _user_id: user.id,
      });
      if (error) throw error;
      return data as string; // booking_id
    },
    onSuccess: (bookingId) => {
      queryClient.invalidateQueries({ queryKey: ['booking-quotes'] });
      queryClient.invalidateQueries({ queryKey: ['booking-quote-requests'] });
      queryClient.invalidateQueries({ queryKey: ['booking-bookings'] });
      toast.success(t('booking.quotes.quoteAccepted'));
      emitEvent({
        event_type: 'booking.quote_accepted',
        object_type: 'booking_booking',
        metadata: { booking_id: bookingId },
      });
    },
    onError: (err: Error) => toast.error(err.message || t('booking.quotes.quoteAcceptFailed')),
  });

  return {
    quoteRequests,
    quotes,
    isLoading: requestsLoading || quotesLoading,
    createQuoteRequest,
    sendQuote,
    acceptQuote,
    canTransition,
  };
}
