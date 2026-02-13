import { useTranslation } from 'react-i18next';
import { useOutletContext } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { BookingStatusBadge } from '@/components/booking/BookingStatusBadge';
import { ULLText } from '@/components/ull/ULLText';
import { MessageSquare, BookOpen, Clock } from 'lucide-react';
import { format } from 'date-fns';

export default function VendorDashboardPage() {
  const { t } = useTranslation();
  const { workspaceId, vendorId } = useOutletContext<{ workspaceId: string; vendorId: string; tenantSlug: string }>();

  const { data: requests = [], isLoading: rLoading } = useQuery({
    queryKey: ['vendor-quote-requests', vendorId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('booking_quote_requests')
        .select('*, service:booking_services(title, title_meaning_object_id)')
        .eq('vendor_id', vendorId)
        .in('status', ['requested', 'quoted'])
        .order('created_at', { ascending: false })
        .limit(10);
      if (error) throw error;
      return (data || []).map((qr: any) => ({
        ...qr,
        service_title_fallback: qr.service?.title || '—',
        service_title_meaning_id: qr.service?.title_meaning_object_id || null,
      }));
    },
    enabled: !!vendorId,
  });

  const { data: bookings = [], isLoading: bLoading } = useQuery({
    queryKey: ['vendor-bookings', vendorId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('booking_bookings')
        .select('*')
        .eq('vendor_id', vendorId)
        .eq('status', 'paid_confirmed')
        .order('event_date', { ascending: true })
        .limit(10);
      if (error) throw error;
      return data || [];
    },
    enabled: !!vendorId,
  });

  const pendingCount = requests.filter(r => r.status === 'requested').length;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-foreground">{t('booking.vendor.dashboard')}</h1>

      <div className="grid grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
              <Clock className="h-4 w-4" />
              {t('booking.vendor.pendingRequests')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {rLoading ? <Skeleton className="h-8 w-12" /> : <div className="text-2xl font-bold text-foreground">{pendingCount}</div>}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
              <BookOpen className="h-4 w-4" />
              {t('booking.vendor.upcomingBookings')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {bLoading ? <Skeleton className="h-8 w-12" /> : <div className="text-2xl font-bold text-foreground">{bookings.length}</div>}
          </CardContent>
        </Card>
      </div>

      {/* Pending requests */}
      {requests.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold text-foreground mb-3">{t('booking.vendor.recentRequests')}</h2>
          <div className="space-y-3">
            {requests.map(qr => (
              <Card key={qr.id}>
                <CardContent className="flex items-center justify-between py-3">
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      <ULLText meaningId={qr.service_title_meaning_id} fallback={qr.service_title_fallback} />
                    </p>
                    <p className="text-xs text-muted-foreground">{format(new Date(qr.created_at), 'PP')}</p>
                  </div>
                  <BookingStatusBadge status={qr.status} />
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
