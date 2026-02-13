import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useBookingSettings } from '@/hooks/useBookingSettings';
import { useBookingSubscription } from '@/hooks/useBookingSubscription';
import { SubscriptionBanner } from '@/components/booking/SubscriptionBanner';
import { BookingStatusBadge } from '@/components/booking/BookingStatusBadge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Settings, Rocket } from 'lucide-react';
import BookingSetupWizard from './BookingSetupWizard';

export default function BookingSettingsPage() {
  const { t } = useTranslation();
  const { settings, isLoading } = useBookingSettings();
  const { subscription } = useBookingSubscription();
  const [showWizard, setShowWizard] = useState(false);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (showWizard) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-foreground">{t('booking.wizard.title')}</h1>
          <Button variant="outline" onClick={() => setShowWizard(false)}>
            {t('common.cancel')}
          </Button>
        </div>
        <BookingSetupWizard onComplete={() => setShowWizard(false)} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <SubscriptionBanner />
      <h1 className="text-2xl font-bold text-foreground">{t('booking.settings.title')}</h1>

      {/* Subscription status */}
      {subscription && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {t('booking.subscription.title')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-3">
              <BookingStatusBadge status={subscription.status} />
              <span className="text-sm text-muted-foreground">
                {t('booking.subscription.plan')}: {subscription.plan}
              </span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Setup wizard card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-foreground">
            <Settings className="h-5 w-5" />
            {t('booking.settings.setupWizard')}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-muted-foreground">
            {settings?.is_live ? t('booking.settings.goLiveDesc') : t('booking.settings.setupDesc')}
          </p>

          {settings && (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
              <div>
                <span className="text-muted-foreground">{t('booking.settings.themeLabel')}:</span>{' '}
                <span className="text-foreground font-medium">{t(`booking.wizard.theme.${settings.theme_template}`)}</span>
              </div>
              <div>
                <span className="text-muted-foreground">{t('booking.wizard.money.currency')}:</span>{' '}
                <span className="text-foreground font-medium">{settings.currency}</span>
              </div>
              <div>
                <span className="text-muted-foreground">{t('booking.vendors.status')}:</span>{' '}
                <BookingStatusBadge status={settings.is_live ? 'active' : 'pending'} />
              </div>
              {settings.tenant_slug && (
                <div className="col-span-2 sm:col-span-3">
                  <span className="text-muted-foreground">{t('booking.settings.slugLabel')}:</span>{' '}
                  <code className="text-foreground font-mono text-xs bg-muted px-1.5 py-0.5 rounded break-all">
                    /b/{settings.tenant_slug}
                  </code>
                </div>
              )}
            </div>
          )}

          <Button onClick={() => setShowWizard(true)}>
            <Rocket className="h-4 w-4 me-2" />
            {settings ? t('booking.settings.editSettings') : t('booking.settings.launchWizard')}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
