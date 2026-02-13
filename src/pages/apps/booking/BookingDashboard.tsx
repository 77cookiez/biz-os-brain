import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Store, Package, MessageSquare, BookOpen, Clock } from 'lucide-react';
import { SubscriptionBanner } from '@/components/booking/SubscriptionBanner';
import { useBookingVendors } from '@/hooks/useBookingVendors';
import { useBookingServices } from '@/hooks/useBookingServices';
import { useBookingQuotes } from '@/hooks/useBookingQuotes';
import { useBookingBookings } from '@/hooks/useBookingBookings';
import { Skeleton } from '@/components/ui/skeleton';

export default function BookingDashboard() {
  const { t } = useTranslation();
  const { vendors, isLoading: vLoading } = useBookingVendors();
  const { services, isLoading: sLoading } = useBookingServices();
  const { quoteRequests, isLoading: qLoading } = useBookingQuotes();
  const { bookings, isLoading: bLoading } = useBookingBookings();

  const approvedCount = vendors.filter(v => v.status === 'approved').length;
  const pendingCount = vendors.filter(v => v.status === 'pending').length;
  const pendingQuotes = quoteRequests.filter(qr => qr.status === 'requested').length;
  const activeBookings = bookings.filter(b => b.status === 'paid_confirmed').length;

  const stats = [
    { labelKey: 'booking.dashboard.vendors', icon: Store, value: vLoading ? null : `${approvedCount}` },
    { labelKey: 'booking.dashboard.services', icon: Package, value: sLoading ? null : `${services.length}` },
    { labelKey: 'booking.dashboard.pendingQuotes', icon: Clock, value: qLoading ? null : `${pendingQuotes}` },
    { labelKey: 'booking.dashboard.activeBookings', icon: BookOpen, value: bLoading ? null : `${activeBookings}` },
  ];

  return (
    <div className="space-y-6">
      <SubscriptionBanner />
      <h1 className="text-2xl font-bold text-foreground">{t('booking.dashboard.title')}</h1>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {stats.map(stat => (
          <Card key={stat.labelKey}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {t(stat.labelKey)}
              </CardTitle>
              <stat.icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {stat.value === null ? (
                <Skeleton className="h-8 w-12" />
              ) : (
                <div className="text-2xl font-bold text-foreground">{stat.value}</div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {pendingCount > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Store className="h-4 w-4" />
              {t('booking.vendors.pending')} ({pendingCount})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              {t('booking.dashboard.pendingVendorsHint', { count: pendingCount })}
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
