import { useTranslation } from 'react-i18next';
import { EmptyState } from '@/components/EmptyState';
import { Calendar } from 'lucide-react';

export default function BookingCalendarPage() {
  const { t } = useTranslation();

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-foreground">{t('booking.calendar.title')}</h1>
      <EmptyState
        icon={Calendar}
        title={t('booking.calendar.emptyTitle')}
        description={t('booking.calendar.emptyDesc')}
      />
    </div>
  );
}
