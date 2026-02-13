import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { BookOpen } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { EmptyState } from '@/components/EmptyState';
import { SubscriptionBanner } from '@/components/booking/SubscriptionBanner';
import { BookingStatusBadge } from '@/components/booking/BookingStatusBadge';
import { useBookingBookings } from '@/hooks/useBookingBookings';
import { format } from 'date-fns';

export default function BookingBookingsPage() {
  const { t } = useTranslation();
  const { bookings, isLoading, markComplete, cancelBooking } = useBookingBookings();
  const [filter, setFilter] = useState('all');

  const filtered = filter === 'all'
    ? bookings
    : filter === 'active'
      ? bookings.filter(b => b.status === 'paid_confirmed')
      : filter === 'completed'
        ? bookings.filter(b => b.status === 'completed')
        : bookings.filter(b => b.status === 'cancelled');

  return (
    <div className="space-y-6">
      <SubscriptionBanner />
      <h1 className="text-2xl font-bold text-foreground">{t('booking.bookings.title')}</h1>

      <Tabs value={filter} onValueChange={setFilter}>
        <TabsList>
          <TabsTrigger value="all">{t('booking.bookings.filter.all')}</TabsTrigger>
          <TabsTrigger value="active">{t('booking.bookings.filter.active')}</TabsTrigger>
          <TabsTrigger value="completed">{t('booking.bookings.filter.completed')}</TabsTrigger>
          <TabsTrigger value="cancelled">{t('booking.bookings.filter.cancelled')}</TabsTrigger>
        </TabsList>
      </Tabs>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-24 w-full" />)}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState icon={BookOpen} title={t('booking.bookings.emptyTitle')} description={t('booking.bookings.emptyDesc')} />
      ) : (
        <div className="space-y-4">
          {filtered.map(booking => (
            <Card key={booking.id}>
              <CardHeader className="pb-2">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <CardTitle className="text-base">
                    {booking.currency} {booking.total_amount}
                  </CardTitle>
                  <BookingStatusBadge status={booking.status} />
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-sm">
                  <div>
                    <span className="text-muted-foreground">{t('booking.bookings.totalAmount')}</span>
                    <p className="text-foreground font-medium">{booking.currency} {booking.total_amount}</p>
                  </div>
                  {booking.deposit_paid != null && booking.deposit_paid > 0 && (
                    <div>
                      <span className="text-muted-foreground">{t('booking.bookings.depositPaid')}</span>
                      <p className="text-foreground">{booking.currency} {booking.deposit_paid}</p>
                    </div>
                  )}
                  {booking.event_date && (
                    <div>
                      <span className="text-muted-foreground">{t('booking.bookings.eventDate')}</span>
                      <p className="text-foreground">{format(new Date(booking.event_date), 'PP')}</p>
                    </div>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  {format(new Date(booking.created_at), 'PPp')}
                </p>
                {booking.status === 'paid_confirmed' && (
                  <div className="flex gap-2 pt-1">
                    <Button size="sm" onClick={() => markComplete.mutate(booking.id)}>
                      {t('booking.bookings.markComplete')}
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => cancelBooking.mutate({ bookingId: booking.id })}
                    >
                      {t('booking.bookings.cancelBooking')}
                    </Button>
                  </div>
                )}
                {booking.cancellation_reason && (
                  <p className="text-sm text-destructive">
                    {t('booking.bookings.cancellationReason')}: {booking.cancellation_reason}
                  </p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
