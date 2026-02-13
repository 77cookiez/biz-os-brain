import { useTranslation } from 'react-i18next';
import { EmptyState } from '@/components/EmptyState';
import { MessageSquare } from 'lucide-react';

export default function BookingQuotesPage() {
  const { t } = useTranslation();

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-foreground">{t('booking.quotes.title')}</h1>
      <EmptyState
        icon={MessageSquare}
        title={t('booking.quotes.emptyTitle')}
        description={t('booking.quotes.emptyDesc')}
      />
    </div>
  );
}
