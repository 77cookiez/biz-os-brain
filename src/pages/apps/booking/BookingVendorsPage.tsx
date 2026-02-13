import { useTranslation } from 'react-i18next';
import { EmptyState } from '@/components/EmptyState';
import { Store } from 'lucide-react';

export default function BookingVendorsPage() {
  const { t } = useTranslation();

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-foreground">{t('booking.vendors.title')}</h1>
      <EmptyState
        icon={Store}
        title={t('booking.vendors.emptyTitle')}
        description={t('booking.vendors.emptyDesc')}
      />
    </div>
  );
}
