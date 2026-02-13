import { useTranslation } from 'react-i18next';
import { useBookingSubscription } from '@/hooks/useBookingSubscription';
import { AlertTriangle, XCircle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';

export function SubscriptionBanner() {
  const { t } = useTranslation();
  const { isActive, isGracePeriod, isSuspended, daysRemaining, isLoading } = useBookingSubscription();

  if (isLoading || isActive) return null;

  if (isGracePeriod) {
    return (
      <Alert className="border-warning/50 bg-warning/10 mb-4">
        <AlertTriangle className="h-4 w-4 text-warning" />
        <AlertDescription className="flex items-center justify-between gap-2 flex-wrap">
          <span className="text-sm">
            {t('booking.subscription.gracePeriod', { days: daysRemaining ?? '—' })}
          </span>
          <Button size="sm" variant="outline" className="shrink-0">
            {t('booking.subscription.renewNow')}
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  if (isSuspended) {
    return (
      <Alert variant="destructive" className="mb-4">
        <XCircle className="h-4 w-4" />
        <AlertDescription className="flex items-center justify-between gap-2 flex-wrap">
          <span className="text-sm">{t('booking.subscription.inactive')}</span>
          <Button size="sm" variant="outline" className="shrink-0">
            {t('booking.subscription.renewNow')}
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  return null;
}
