import { useTranslation } from 'react-i18next';
import { EmptyState } from '@/components/EmptyState';
import { BookOpen } from 'lucide-react';

export default function BookingBookingsPage() {
  const { t } = useTranslation();

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-foreground">{t('booking.bookings.title')}</h1>
      <EmptyState
        icon={BookOpen}
        title={t('booking.bookings.emptyTitle')}
        description={t('booking.bookings.emptyDesc')}
      />
    </div>
  );
}
