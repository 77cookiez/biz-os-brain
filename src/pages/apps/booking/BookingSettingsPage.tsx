import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useBookingSettings } from '@/hooks/useBookingSettings';
import { useBookingSubscription } from '@/hooks/useBookingSubscription';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { SubscriptionBanner } from '@/components/booking/SubscriptionBanner';
import { BookingStatusBadge } from '@/components/booking/BookingStatusBadge';
import { LogoUpload } from '@/components/booking/LogoUpload';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Settings, Rocket, Globe, Copy, ExternalLink, Check } from 'lucide-react';
import { toast } from 'sonner';
import BookingSetupWizard from './BookingSetupWizard';

function getPublicBaseUrl(): string {
  if (import.meta.env.VITE_PUBLIC_BOOKING_BASE_URL) {
    return import.meta.env.VITE_PUBLIC_BOOKING_BASE_URL;
  }
  return typeof window !== 'undefined' ? window.location.origin : '';
}

export default function BookingSettingsPage() {
  const { t } = useTranslation();
  const { settings, isLoading, upsertSettings } = useBookingSettings();
  const { subscription } = useBookingSubscription();
  const { currentWorkspace } = useWorkspace();
  const [showWizard, setShowWizard] = useState(false);
  const [copied, setCopied] = useState(false);

  const publicUrl = settings?.tenant_slug
    ? `${getPublicBaseUrl()}/b/${settings.tenant_slug}`
    : null;

  const handleCopy = async () => {
    if (!publicUrl) return;
    await navigator.clipboard.writeText(publicUrl);
    setCopied(true);
    toast.success(t('common.copied', 'Copied!'));
    setTimeout(() => setCopied(false), 2000);
  };

  const handleLogoChange = (url: string | null) => {
    upsertSettings.mutate({ logo_url: url } as any);
  };

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
      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-bold text-foreground">{t('booking.settings.title')}</h1>
        <Badge variant={settings?.is_live ? 'default' : 'secondary'}>
          {settings?.is_live ? t('booking.settings.live', 'Live') : t('booking.settings.draft', 'Draft')}
        </Badge>
      </div>

      {/* Public URL Card - show when live */}
      {settings?.is_live && publicUrl && (
        <Card className="border-primary/30 bg-primary/5">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-medium text-foreground">
              <Globe className="h-4 w-4 text-primary" />
              {t('booking.settings.publicUrl', 'Public Site')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
              <code className="text-sm font-mono bg-muted px-3 py-1.5 rounded-md break-all text-foreground flex-1">
                {publicUrl}
              </code>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={handleCopy}>
                  {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  <span className="ms-1">{copied ? t('common.copied', 'Copied') : t('common.copy', 'Copy')}</span>
                </Button>
                <Button variant="outline" size="sm" asChild>
                  <a href={publicUrl} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="h-4 w-4" />
                    <span className="ms-1">{t('booking.settings.openSite', 'Open')}</span>
                  </a>
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Logo quick-edit when live */}
      {settings?.is_live && currentWorkspace && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-foreground">
              {t('booking.wizard.brand.logo', 'Logo')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <LogoUpload
              currentLogoUrl={settings.logo_url}
              workspaceId={currentWorkspace.id}
              onUploadComplete={handleLogoChange}
            />
          </CardContent>
        </Card>
      )}

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
