import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { MessageSquare } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { EmptyState } from '@/components/EmptyState';
import { SubscriptionBanner } from '@/components/booking/SubscriptionBanner';
import { BookingStatusBadge } from '@/components/booking/BookingStatusBadge';
import { ULLText } from '@/components/ull/ULLText';
import { useBookingQuotes } from '@/hooks/useBookingQuotes';
import { format } from 'date-fns';

export default function BookingQuotesPage() {
  const { t } = useTranslation();
  const { quoteRequests, quotes, isLoading } = useBookingQuotes();
  const [statusFilter, setStatusFilter] = useState('all');

  const filteredRequests = statusFilter === 'all'
    ? quoteRequests
    : quoteRequests.filter(qr => qr.status === statusFilter);

  const getQuoteForRequest = (requestId: string) =>
    quotes.find(q => q.quote_request_id === requestId);

  return (
    <div className="space-y-6">
      <SubscriptionBanner />
      <h1 className="text-2xl font-bold text-foreground">{t('booking.quotes.title')}</h1>

      <Tabs value={statusFilter} onValueChange={setStatusFilter}>
        <TabsList>
          <TabsTrigger value="all">{t('booking.quotes.filter.all')}</TabsTrigger>
          <TabsTrigger value="requested">{t('booking.quotes.filter.requested')}</TabsTrigger>
          <TabsTrigger value="quoted">{t('booking.quotes.filter.quoted')}</TabsTrigger>
          <TabsTrigger value="accepted">{t('booking.quotes.filter.accepted')}</TabsTrigger>
        </TabsList>
      </Tabs>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-24 w-full" />)}
        </div>
      ) : filteredRequests.length === 0 ? (
        <EmptyState icon={MessageSquare} title={t('booking.quotes.emptyTitle')} description={t('booking.quotes.emptyDesc')} />
      ) : (
        <div className="space-y-4">
          {filteredRequests.map(qr => {
            const quote = getQuoteForRequest(qr.id);
            return (
              <Card key={qr.id}>
                <CardHeader className="pb-2">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <CardTitle className="text-base">
                      {/* Service title via service meaning, NOT quote request meaning */}
                      <ULLText meaningId={qr.service_title_meaning_id} fallback={qr.service_title_fallback || '—'} />
                    </CardTitle>
                    <BookingStatusBadge status={qr.status} />
                  </div>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-sm">
                    <div>
                      <span className="text-muted-foreground">{t('booking.services.vendor')}</span>
                      <p className="text-foreground">
                        <ULLText
                          meaningId={qr.vendor_display_name_meaning_id}
                          fallback={qr.vendor_display_name_fallback || '—'}
                        />
                      </p>
                    </div>
                    {qr.event_date && (
                      <div>
                        <span className="text-muted-foreground">{t('booking.quotes.eventDate')}</span>
                        <p className="text-foreground">{format(new Date(qr.event_date), 'PP')}</p>
                      </div>
                    )}
                    {qr.guest_count && (
                      <div>
                        <span className="text-muted-foreground">{t('booking.quotes.guestCount')}</span>
                        <p className="text-foreground">{qr.guest_count}</p>
                      </div>
                    )}
                    {quote && (
                      <div>
                        <span className="text-muted-foreground">{t('booking.quotes.quoteAmount')}</span>
                        <p className="text-foreground font-medium">{quote.currency} {quote.amount}</p>
                      </div>
                    )}
                  </div>
                  {/* Request notes via quote request meaning (correct usage) */}
                  {qr.notes && (
                    <p className="text-sm text-muted-foreground">
                      <ULLText meaningId={qr.meaning_object_id} fallback={qr.notes} />
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground">
                    {format(new Date(qr.created_at), 'PPp')}
                  </p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
