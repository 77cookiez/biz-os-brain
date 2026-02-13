import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Store, Package, MessageSquare, BookOpen } from 'lucide-react';

export default function BookingDashboard() {
  const { t } = useTranslation();

  const stats = [
    { labelKey: 'booking.dashboard.vendors', icon: Store, value: '—' },
    { labelKey: 'booking.dashboard.services', icon: Package, value: '—' },
    { labelKey: 'booking.dashboard.quotes', icon: MessageSquare, value: '—' },
    { labelKey: 'booking.dashboard.bookings', icon: BookOpen, value: '—' },
  ];

  return (
    <div className="space-y-6">
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
              <div className="text-2xl font-bold text-foreground">{stat.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
