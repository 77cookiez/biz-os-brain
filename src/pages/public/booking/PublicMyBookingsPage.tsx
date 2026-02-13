import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useOutletContext, Navigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/EmptyState';
import { BookingStatusBadge } from '@/components/booking/BookingStatusBadge';
import { BookingChatPanel } from '@/components/booking/BookingChatPanel';
import { ULLText } from '@/components/ull/ULLText';
import { useBookingQuotes } from '@/hooks/useBookingQuotes';
import { useBookingBookings } from '@/hooks/useBookingBookings';
import { useAuth } from '@/contexts/AuthContext';
import { BookOpen, MessageSquare } from 'lucide-react';
import { format } from 'date-fns';
import { formatCurrency } from '@/lib/formatCurrency';
import { useLanguage } from '@/contexts/LanguageContext';

export default function PublicMyBookingsPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { settings, tenantSlug } = useOutletContext<{ settings: any; tenantSlug: string }>();
  const { currentLanguage } = useLanguage();
  const { quoteRequests, isLoading: qLoading } = useBookingQuotes();
  const { bookings, isLoading: bLoading } = useBookingBookings();
  const [tab, setTab] = useState('requests');
  const [selectedThread, setSelectedThread] = useState<string | null>(null);

  if (!user) {
    return <Navigate to={`/b/${tenantSlug}/auth?redirect=/b/${tenantSlug}/my`} replace />;
  }

  // Filter to current user's requests/bookings
  const myRequests = quoteRequests.filter(qr => qr.customer_user_id === user.id);
  const myBookings = bookings.filter(b => b.customer_user_id === user.id);

  if (selectedThread) {
    return (
      <div className="h-[60vh]">
        <BookingChatPanel
          threadId={selectedThread}
          onBack={() => setSelectedThread(null)}
          className="h-full"
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-foreground">{t('booking.public.myBookings')}</h1>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="requests">{t('booking.quotes.title')}</TabsTrigger>
          <TabsTrigger value="bookings">{t('booking.bookings.title')}</TabsTrigger>
        </TabsList>
      </Tabs>

      {tab === 'requests' && (
        qLoading ? (
          <div className="space-y-3">{[1, 2].map(i => <Skeleton key={i} className="h-24" />)}</div>
        ) : myRequests.length === 0 ? (
          <EmptyState icon={MessageSquare} title={t('booking.quotes.emptyTitle')} description={t('booking.quotes.emptyDesc')} />
        ) : (
          <div className="space-y-4">
            {myRequests.map(qr => (
              <Card key={qr.id} className="cursor-pointer hover:border-primary/50 transition-colors"
                onClick={() => qr.chat_thread_id && setSelectedThread(qr.chat_thread_id)}
              >
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">
                      <ULLText meaningId={qr.service_title_meaning_id} fallback={qr.service_title_fallback || '—'} />
                    </CardTitle>
                    <BookingStatusBadge status={qr.status} />
                  </div>
                </CardHeader>
                <CardContent className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">{format(new Date(qr.created_at), 'PP')}</span>
                  {qr.chat_thread_id && (
                    <span className="text-primary text-xs flex items-center gap-1">
                      <MessageSquare className="h-3 w-3" />
                      {t('booking.chat.title')}
                    </span>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )
      )}

      {tab === 'bookings' && (
        bLoading ? (
          <div className="space-y-3">{[1, 2].map(i => <Skeleton key={i} className="h-24" />)}</div>
        ) : myBookings.length === 0 ? (
          <EmptyState icon={BookOpen} title={t('booking.bookings.emptyTitle')} description={t('booking.bookings.emptyDesc')} />
        ) : (
          <div className="space-y-4">
            {myBookings.map(b => (
              <Card key={b.id}>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">{formatCurrency(b.total_amount, b.currency, currentLanguage.code)}</CardTitle>
                    <BookingStatusBadge status={b.status} />
                  </div>
                </CardHeader>
                <CardContent className="text-sm text-muted-foreground">
                  {b.event_date && <span>{format(new Date(b.event_date), 'PP')}</span>}
                </CardContent>
              </Card>
            ))}
          </div>
        )
      )}
    </div>
  );
}
