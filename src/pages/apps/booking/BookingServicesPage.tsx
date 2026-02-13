import { useTranslation } from 'react-i18next';
import { EmptyState } from '@/components/EmptyState';
import { Package } from 'lucide-react';

export default function BookingServicesPage() {
  const { t } = useTranslation();

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-foreground">{t('booking.services.title')}</h1>
      <EmptyState
        icon={Package}
        title={t('booking.services.emptyTitle')}
        description={t('booking.services.emptyDesc')}
      />
    </div>
  );
}
