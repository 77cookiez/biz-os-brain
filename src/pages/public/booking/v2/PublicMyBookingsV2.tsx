/**
 * V2 Customer My Bookings Page
 * Shows quote requests + received quotes with accept flow.
 * Accept: validates expiry, sets status='confirmed', declines other quotes.
 */
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useOutletContext, Navigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/EmptyState';
import { BookingStatusBadge } from '@/components/booking/BookingStatusBadge';
import { ULLText } from '@/components/ull/ULLText';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { auditAndEmit } from '@/lib/booking/auditHelper';
import { MessageSquare, BookOpen, CheckCircle2, Calendar } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { formatCurrency } from '@/lib/formatCurrency';

export default function PublicMyBookingsV2() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { settings, tenantSlug, basePath } = useOutletContext<{
    settings: any;
    tenantSlug: string;
    basePath?: string;
  }>();
  const resolvedBase = basePath || `/b2/${tenantSlug}`;
  const { currentLanguage } = useLanguage();
  const queryClient = useQueryClient();
  const workspaceId = settings?.workspace_id;
  const [tab, setTab] = useState('requests');

  if (!user) {
    return <Navigate to={`${resolvedBase}/auth?redirect=${resolvedBase}/my`} replace />;
  }

  // Fetch my quote requests
  const { data: myRequests = [], isLoading: rLoading } = useQuery({
    queryKey: ['my-requests-v2', workspaceId, user.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('booking_quote_requests')
        .select('*, service:booking_services(title, title_meaning_object_id)')
        .eq('workspace_id', workspaceId)
        .eq('customer_user_id', user.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []).map((qr: any) => ({
        ...qr,
        service_title_fallback: qr.service?.title || '—',
        service_title_meaning_id: qr.service?.title_meaning_object_id || null,
      }));
    },
    enabled: !!workspaceId,
  });

  // Fetch quotes for my requests
  const requestIds = myRequests.map((r: any) => r.id);
  const { data: receivedQuotes = [], isLoading: qLoading } = useQuery({
    queryKey: ['my-quotes-v2', requestIds],
    queryFn: async () => {
      if (requestIds.length === 0) return [];
      const { data, error } = await supabase
        .from('booking_quotes')
        .select('*')
        .in('quote_request_id', requestIds)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: requestIds.length > 0,
  });

  // Fetch my bookings
  const { data: myBookings = [], isLoading: bLoading } = useQuery({
    queryKey: ['my-bookings-v2', workspaceId, user.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('booking_bookings')
        .select('*')
        .eq('workspace_id', workspaceId)
        .eq('customer_user_id', user.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!workspaceId,
  });

  // Map quotes by request id
  const quotesByRequest: Record<string, any[]> = {};
  receivedQuotes.forEach((q: any) => {
    if (!quotesByRequest[q.quote_request_id]) quotesByRequest[q.quote_request_id] = [];
    quotesByRequest[q.quote_request_id].push(q);
  });

  // Accept quote mutation — HARDENED
  const acceptQuote = useMutation({
    mutationFn: async (quote: any) => {
      if (!user || !workspaceId) throw new Error('Not authenticated');

      // 1. Validate quote is still pending
      if (quote.status !== 'pending') {
        throw new Error(`Quote is no longer pending (status: ${quote.status})`);
      }

      // 2. Check expiry
      if (quote.expires_at && new Date(quote.expires_at) < new Date()) {
        throw new Error('This quote has expired');
      }

      // 3. Verify ownership — customer owns the request
      const request = myRequests.find((r: any) => r.id === quote.quote_request_id);
      if (!request || request.customer_user_id !== user.id) {
        throw new Error('Unauthorized: you do not own this quote request');
      }

      // 4. Accept the quote
      const { error: qErr } = await supabase
        .from('booking_quotes')
        .update({ status: 'accepted' } as any)
        .eq('id', quote.id);
      if (qErr) throw qErr;

      // 5. Decline all OTHER quotes for same request
      const otherQuotes = (quotesByRequest[quote.quote_request_id] || [])
        .filter((q: any) => q.id !== quote.id && q.status === 'pending');
      if (otherQuotes.length > 0) {
        const otherIds = otherQuotes.map((q: any) => q.id);
        await supabase
          .from('booking_quotes')
          .update({ status: 'declined' } as any)
          .in('id', otherIds);
      }

      // 6. Update request status to accepted
      const { error: rErr } = await supabase
        .from('booking_quote_requests')
        .update({ status: 'accepted' as any })
        .eq('id', quote.quote_request_id);
      if (rErr) throw rErr;

      // 7. Create booking (idempotent via unique quote_id)
      const { data: existing } = await supabase
        .from('booking_bookings')
        .select('id')
        .eq('quote_id', quote.id)
        .maybeSingle();

      let bookingId = existing?.id;
      if (!bookingId) {
        const { data: newBooking, error: bErr } = await supabase
          .from('booking_bookings')
          .insert({
            workspace_id: workspaceId,
            quote_id: quote.id,
            quote_request_id: quote.quote_request_id,
            vendor_id: quote.vendor_id,
            customer_user_id: user.id,
            total_amount: quote.amount,
            currency: quote.currency,
            event_date: request.event_date || null,
            status: 'confirmed' as any,
          } as any)
          .select('id')
          .single();
        if (bErr) throw bErr;
        bookingId = newBooking.id;

        // Audit booking creation
        await auditAndEmit({
          workspace_id: workspaceId,
          actor_user_id: user.id,
          action: 'booking.booking_created',
          event_type: 'booking.booking_created',
          entity_type: 'booking_booking',
          entity_id: bookingId,
          metadata: { quote_id: quote.id, quote_request_id: quote.quote_request_id, vendor_id: quote.vendor_id },
        });
      }

      // 8. Audit quote acceptance
      await auditAndEmit({
        workspace_id: workspaceId,
        actor_user_id: user.id,
        action: 'booking.quote_accepted',
        event_type: 'booking.quote_accepted',
        entity_type: 'booking_quote',
        entity_id: quote.id,
        meaning_object_id: quote.meaning_object_id,
        metadata: { booking_id: bookingId, quote_request_id: quote.quote_request_id },
      });

      return bookingId;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-requests-v2'] });
      queryClient.invalidateQueries({ queryKey: ['my-quotes-v2'] });
      queryClient.invalidateQueries({ queryKey: ['my-bookings-v2'] });
      toast.success(t('booking.quotes.quoteAccepted'));
    },
    onError: (err: Error) => toast.error(err.message || t('booking.quotes.quoteAcceptFailed')),
  });

  const isLoading = rLoading || qLoading || bLoading;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-foreground">{t('booking.public.myBookings')}</h1>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="requests" className="gap-1.5">
            <MessageSquare className="h-3.5 w-3.5" />
            {t('booking.quotes.title')} ({myRequests.length})
          </TabsTrigger>
          <TabsTrigger value="bookings" className="gap-1.5">
            <BookOpen className="h-3.5 w-3.5" />
            {t('booking.bookings.title')} ({myBookings.length})
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {tab === 'requests' && (
        isLoading ? (
          <div className="space-y-3">{[1, 2].map(i => <Skeleton key={i} className="h-28" />)}</div>
        ) : myRequests.length === 0 ? (
          <EmptyState
            icon={MessageSquare}
            title={t('booking.quotes.emptyTitle')}
            description={t('booking.quotes.emptyDesc')}
          />
        ) : (
          <div className="space-y-4">
            {myRequests.map((qr: any) => {
              const quotes = quotesByRequest[qr.id] || [];
              const pendingQuote = quotes.find((q: any) => q.status === 'pending');
              const acceptedQuote = quotes.find((q: any) => q.status === 'accepted');
              const bookingExists = myBookings.some((b: any) => b.quote_request_id === qr.id);
              const displayQuote = acceptedQuote || pendingQuote || quotes[0];

              return (
                <Card key={qr.id}>
                  <CardContent className="py-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium text-foreground">
                        <ULLText meaningId={qr.service_title_meaning_id} fallback={qr.service_title_fallback} />
                      </p>
                      <BookingStatusBadge status={qr.status} />
                    </div>

                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      {qr.event_date && (
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {format(new Date(qr.event_date), 'PP')}
                        </span>
                      )}
                      <span>{format(new Date(qr.created_at), 'PP')}</span>
                    </div>

                    {/* Show quote if received */}
                    {displayQuote && (
                      <div className="bg-muted/40 rounded-lg p-3 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-semibold text-foreground">
                            {formatCurrency(displayQuote.amount, displayQuote.currency, currentLanguage.code)}
                          </span>
                          <Badge variant="secondary" className="text-[10px]">{displayQuote.status}</Badge>
                        </div>
                        {displayQuote.deposit_amount && (
                          <p className="text-xs text-muted-foreground">
                            Deposit: {formatCurrency(displayQuote.deposit_amount, displayQuote.currency, currentLanguage.code)}
                          </p>
                        )}
                        {displayQuote.notes && (
                          <p className="text-xs text-muted-foreground">
                            <ULLText meaningId={displayQuote.meaning_object_id} fallback={displayQuote.notes} />
                          </p>
                        )}
                        {displayQuote.expires_at && (
                          <p className="text-[10px] text-muted-foreground">
                            Expires: {format(new Date(displayQuote.expires_at), 'PPp')}
                            {new Date(displayQuote.expires_at) < new Date() && (
                              <Badge variant="destructive" className="ml-2 text-[9px]">Expired</Badge>
                            )}
                          </p>
                        )}

                        {/* Accept — only pending, not expired, no booking yet */}
                        {displayQuote.status === 'pending' && !bookingExists && (
                          !(displayQuote.expires_at && new Date(displayQuote.expires_at) < new Date()) ? (
                            <Button
                              size="sm"
                              className="gap-1.5 w-full"
                              onClick={() => acceptQuote.mutate(displayQuote)}
                              disabled={acceptQuote.isPending}
                            >
                              <CheckCircle2 className="h-3.5 w-3.5" />
                              {t('booking.quotes.acceptQuote')}
                            </Button>
                          ) : null
                        )}

                        {bookingExists && (
                          <Badge variant="default" className="gap-1 text-xs">
                            <CheckCircle2 className="h-3 w-3" />
                            {t('booking.bookings.confirmed')}
                          </Badge>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )
      )}

      {tab === 'bookings' && (
        isLoading ? (
          <div className="space-y-3">{[1, 2].map(i => <Skeleton key={i} className="h-24" />)}</div>
        ) : myBookings.length === 0 ? (
          <EmptyState
            icon={BookOpen}
            title={t('booking.bookings.emptyTitle')}
            description={t('booking.bookings.emptyDesc')}
          />
        ) : (
          <div className="space-y-4">
            {myBookings.map((b: any) => (
              <Card key={b.id}>
                <CardContent className="py-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-foreground">
                      {formatCurrency(b.total_amount, b.currency, currentLanguage.code)}
                    </span>
                    <BookingStatusBadge status={b.status} />
                  </div>
                  <div className="flex gap-3 text-xs text-muted-foreground mt-2">
                    {b.event_date && <span>{format(new Date(b.event_date), 'PP')}</span>}
                    <span>{format(new Date(b.created_at), 'PP')}</span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )
      )}
    </div>
  );
}
