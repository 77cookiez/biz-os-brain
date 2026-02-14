import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { BookOpen, Banknote } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { EmptyState } from '@/components/EmptyState';
import { SubscriptionBanner } from '@/components/booking/SubscriptionBanner';
import { BookingStatusBadge } from '@/components/booking/BookingStatusBadge';
import { useBookingBookings } from '@/hooks/useBookingBookings';
import { useBookingSettings } from '@/hooks/useBookingSettings';
import { format } from 'date-fns';

export default function BookingBookingsPage() {
  const { t } = useTranslation();
  const { bookings, isLoading, markComplete, cancelBooking, markAsPaid } = useBookingBookings();
  const { isOfflineOnly } = useBookingSettings();
  const [filter, setFilter] = useState('all');
  const [payDialog, setPayDialog] = useState<string | null>(null);
  const [payMethod, setPayMethod] = useState('cash');

  const filtered = filter === 'all'
    ? bookings
    : filter === 'active'
      ? bookings.filter(b => ['paid_confirmed', 'confirmed_pending_payment'].includes(b.status))
      : filter === 'completed'
        ? bookings.filter(b => b.status === 'completed')
        : bookings.filter(b => b.status === 'cancelled');

  const handleMarkPaid = (bookingId: string) => {
    markAsPaid.mutate(
      { bookingId, method: payMethod },
      { onSuccess: () => setPayDialog(null) }
    );
  };

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
                  <div className="flex items-center gap-2">
                    <BookingStatusBadge status={booking.status} />
                    {booking.payment_status === 'unpaid' && (
                      <Badge variant="outline" className="text-[10px]">
                        {t('booking.bookings.unpaid', 'Unpaid')}
                      </Badge>
                    )}
                    {booking.payment_status === 'paid' && (
                      <Badge variant="default" className="text-[10px]">
                        {t('booking.bookings.paid', 'Paid')}
                      </Badge>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-sm">
                  <div>
                    <span className="text-muted-foreground">{t('booking.bookings.totalAmount')}</span>
                    <p className="text-foreground font-medium">{booking.currency} {booking.total_amount}</p>
                  </div>
                  {booking.paid_amount != null && booking.paid_amount > 0 && (
                    <div>
                      <span className="text-muted-foreground">{t('booking.bookings.paidAmount', 'Paid')}</span>
                      <p className="text-foreground">{booking.currency} {booking.paid_amount}</p>
                    </div>
                  )}
                  {booking.offline_payment_method && (
                    <div>
                      <span className="text-muted-foreground">{t('booking.bookings.paymentMethod', 'Method')}</span>
                      <p className="text-foreground capitalize">{booking.offline_payment_method.replace(/_/g, ' ')}</p>
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
                <div className="flex flex-wrap gap-2 pt-1">
                  {/* Mark as Paid button for unpaid bookings */}
                  {booking.payment_status === 'unpaid' && !['completed', 'cancelled'].includes(booking.status) && (
                    <Button size="sm" variant="default" onClick={() => { setPayDialog(booking.id); setPayMethod('cash'); }}>
                      <Banknote className="h-4 w-4 me-1" />
                      {t('booking.bookings.markAsPaid', 'Mark as Paid')}
                    </Button>
                  )}
                  {['paid_confirmed', 'confirmed_pending_payment'].includes(booking.status) && (
                    <Button size="sm" variant="outline" onClick={() => markComplete.mutate(booking.id)}>
                      {t('booking.bookings.markComplete')}
                    </Button>
                  )}
                  {!['completed', 'cancelled'].includes(booking.status) && (
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => cancelBooking.mutate({ bookingId: booking.id })}
                    >
                      {t('booking.bookings.cancelBooking')}
                    </Button>
                  )}
                </div>
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

      {/* Mark as Paid Dialog */}
      <Dialog open={!!payDialog} onOpenChange={v => !v && setPayDialog(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{t('booking.bookings.markAsPaid', 'Mark as Paid')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>{t('booking.bookings.paymentMethodLabel', 'Payment Method')}</Label>
              <Select value={payMethod} onValueChange={setPayMethod}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">{t('booking.payment.method.cash', 'Cash')}</SelectItem>
                  <SelectItem value="bank_transfer">{t('booking.payment.method.bank_transfer', 'Bank Transfer')}</SelectItem>
                  <SelectItem value="card_on_delivery">{t('booking.payment.method.card_on_delivery', 'Card on Delivery')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button
              className="w-full"
              onClick={() => payDialog && handleMarkPaid(payDialog)}
              disabled={markAsPaid.isPending}
            >
              {t('booking.bookings.confirmPayment', 'Confirm Payment')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
