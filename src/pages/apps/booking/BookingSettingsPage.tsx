import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useBookingSettings } from '@/hooks/useBookingSettings';
import { useBookingSubscription } from '@/hooks/useBookingSubscription';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { SubscriptionBanner } from '@/components/booking/SubscriptionBanner';
import { BookingStatusBadge } from '@/components/booking/BookingStatusBadge';
import { LogoUpload } from '@/components/booking/LogoUpload';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Settings, Rocket, Globe, Copy, ExternalLink, Check, Smartphone, Download, Loader2,
  CheckCircle2, Apple, Shield, Crown, Monitor, Mail, Lock, ChevronRight,
} from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import BookingSetupWizard from './BookingSetupWizard';

function getPublicBaseUrl(): string {
  if (import.meta.env.VITE_PUBLIC_BOOKING_BASE_URL) {
    return import.meta.env.VITE_PUBLIC_BOOKING_BASE_URL;
  }
  return typeof window !== 'undefined' ? window.location.origin : '';
}

const PUBLISHING_STEPS = ['configure', 'generate', 'build', 'upload', 'submit', 'approved'] as const;

export default function BookingSettingsPage() {
  const { t } = useTranslation();
  const { settings, isLoading, upsertSettings } = useBookingSettings();
  const { subscription } = useBookingSubscription();
  const { currentWorkspace } = useWorkspace();
  const [showWizard, setShowWizard] = useState(false);
  const [copied, setCopied] = useState(false);
  const [downloadingIos, setDownloadingIos] = useState(false);
  const [downloadingAndroid, setDownloadingAndroid] = useState(false);

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

  const handleDownloadAppPack = async (platform: 'ios' | 'android') => {
    if (!settings?.tenant_slug) return;
    const setter = platform === 'ios' ? setDownloadingIos : setDownloadingAndroid;
    setter(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-app-pack`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify({ workspace_id: currentWorkspace?.id, platform }),
        }
      );
      if (!res.ok) throw new Error('Failed to generate');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `bookivo-${platform}-pack-${settings.tenant_slug}.zip`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(t('booking.settings.packDownloaded'));

      // Mark generate step as done
      const progress = { ...(settings?.publishing_progress ?? {}) };
      if (!progress[platform]) {
        progress[platform] = { configure: true, generate: false, build: false, upload: false, submit: false, approved: false };
      }
      progress[platform].generate = true;
      upsertSettings.mutate({ publishing_progress: progress } as any);
    } catch {
      toast.error(t('booking.settings.packDownloadFailed'));
    } finally {
      setter(false);
    }
  };

  const handleToggleStep = (platform: 'ios' | 'android', step: string) => {
    const progress = { ...(settings?.publishing_progress ?? {}) };
    if (!progress[platform]) {
      progress[platform] = { configure: false, generate: false, build: false, upload: false, submit: false, approved: false };
    }
    progress[platform][step] = !progress[platform][step];
    upsertSettings.mutate({ publishing_progress: progress } as any);
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

  const progressData = settings?.publishing_progress ?? {};

  return (
    <div className="space-y-6">
      <SubscriptionBanner />
      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-bold text-foreground">{t('booking.settings.title')}</h1>
        <Badge variant={settings?.is_live ? 'default' : 'secondary'}>
          {settings?.is_live ? t('booking.settings.live', 'Live') : t('booking.settings.draft', 'Draft')}
        </Badge>
      </div>

      {/* ========== MODE 1: Hosted Store + PWA (Default) ========== */}
      <Card className="border-primary/30 bg-primary/5">
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2">
            <Globe className="h-5 w-5 text-primary" />
            <CardTitle className="text-sm font-medium text-foreground">
              {t('booking.settings.mode1Title', 'Hosted Store + PWA')}
            </CardTitle>
            <Badge variant="default" className="text-[10px]">
              {t('booking.settings.recommended', 'Recommended')}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            {t('booking.settings.pwaDesc')}
          </p>
          {settings?.is_live && publicUrl && (
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
          )}
          {/* PWA install instructions */}
          <div className="rounded-lg border border-border p-3 bg-card">
            <div className="flex items-start gap-2">
              <Monitor className="h-4 w-4 text-primary mt-0.5 shrink-0" />
              <p className="text-xs text-muted-foreground">
                {t('booking.settings.pwaInstallHint', 'Customers can install your store as an app directly from the browser. No app store submission required.')}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ========== MODE 2: Custom Domain (Coming Soon) ========== */}
      <Card className="opacity-70">
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2">
            <Globe className="h-5 w-5 text-muted-foreground" />
            <CardTitle className="text-sm font-medium text-foreground">
              {t('booking.settings.mode2Title', 'Custom Domain')}
            </CardTitle>
            <Badge variant="secondary" className="text-[10px]">
              {t('booking.settings.comingSoon', 'Coming Soon')}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            {t('booking.settings.customDomainDesc', 'Connect your own domain (e.g., booking.yourbusiness.com) for a fully branded experience.')}
          </p>
        </CardContent>
      </Card>

      {/* ========== MODE 3: Native App Publishing (Advanced) ========== */}
      {settings?.is_live && (
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <Smartphone className="h-5 w-5 text-primary" />
              <CardTitle className="text-sm font-medium text-foreground">
                {t('booking.settings.mode3Title', 'Native App Publishing')}
              </CardTitle>
              <Badge variant="outline" className="text-[10px]">
                {t('booking.settings.advanced', 'Advanced')}
              </Badge>
            </div>
            <CardDescription>
              {t('booking.settings.mode3Desc', 'Publish your branded app on Apple App Store and Google Play Store.')}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Security Disclaimer */}
            <div className="flex items-start gap-2 p-3 rounded-lg bg-muted/50 border border-border">
              <Lock className="h-4 w-4 text-primary mt-0.5 shrink-0" />
              <p className="text-xs text-muted-foreground">
                {t('booking.settings.securityDisclaimer')}
              </p>
            </div>

            {/* App Identity Summary */}
            {settings?.app_name && (
              <div className="flex items-center gap-4 p-3 rounded-lg border border-border">
                {settings?.app_icon_url && (
                  <img
                    src={settings.app_icon_url}
                    alt="App Icon"
                    className="h-14 w-14 rounded-[22%] object-cover ring-1 ring-border shadow-md"
                  />
                )}
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-foreground truncate">{settings.app_name}</p>
                  {settings?.app_description && (
                    <p className="text-xs text-muted-foreground truncate mt-0.5">{settings.app_description}</p>
                  )}
                  <p className="text-xs font-mono text-muted-foreground mt-0.5" dir="ltr">
                    {settings.app_bundle_id || `com.bookivo.${settings.tenant_slug}`}
                  </p>
                </div>
                <Button variant="outline" size="sm" onClick={() => setShowWizard(true)}>
                  {t('booking.settings.editApp', 'Edit App')}
                </Button>
              </div>
            )}

            {!settings?.app_name && (
              <div className="text-sm text-muted-foreground">
                <p>{t('booking.settings.yourAppDesc')}</p>
                <Button variant="outline" size="sm" className="mt-2" onClick={() => setShowWizard(true)}>
                  {t('booking.settings.editApp', 'Set up your app')}
                </Button>
              </div>
            )}

            {/* Tabbed iOS / Android */}
            <Tabs defaultValue="ios" className="w-full">
              <TabsList className="w-full grid grid-cols-2">
                <TabsTrigger value="ios" className="gap-1">
                  <Apple className="h-4 w-4" />
                  {t('booking.settings.appleAppStore')}
                </TabsTrigger>
                <TabsTrigger value="android" className="gap-1">
                  <Smartphone className="h-4 w-4" />
                  {t('booking.settings.googlePlayStore')}
                </TabsTrigger>
              </TabsList>

              {/* iOS Tab */}
              <TabsContent value="ios" className="space-y-4 mt-4">
                {/* What You Need */}
                <div className="space-y-2">
                  <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    {t('booking.settings.whatYouNeed', 'What You Need')}
                  </Label>
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <CheckCircle2 className="h-3.5 w-3.5 text-primary shrink-0" />
                      {t('booking.settings.requireAppleDev')}
                    </div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <CheckCircle2 className="h-3.5 w-3.5 text-primary shrink-0" />
                      {t('booking.settings.requireMac')}
                    </div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <CheckCircle2 className="h-3.5 w-3.5 text-primary shrink-0" />
                      {t('booking.settings.requireNode')}
                    </div>
                  </div>
                </div>

                {/* Download Button */}
                <Button className="w-full" onClick={() => handleDownloadAppPack('ios')} disabled={downloadingIos}>
                  {downloadingIos ? (
                    <><Loader2 className="h-4 w-4 me-2 animate-spin" />{t('booking.settings.downloadingPack')}</>
                  ) : (
                    <><Download className="h-4 w-4 me-2" />{t('booking.settings.downloadIosPack')}</>
                  )}
                </Button>

                {/* Publishing Progress Tracker */}
                <PublishingProgressTracker
                  platform="ios"
                  progress={progressData['ios']}
                  onToggle={(step) => handleToggleStep('ios', step)}
                  t={t as any}
                />
              </TabsContent>

              {/* Android Tab */}
              <TabsContent value="android" className="space-y-4 mt-4">
                <div className="space-y-2">
                  <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    {t('booking.settings.whatYouNeed', 'What You Need')}
                  </Label>
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <CheckCircle2 className="h-3.5 w-3.5 text-primary shrink-0" />
                      {t('booking.settings.requireGoogleDev')}
                    </div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <CheckCircle2 className="h-3.5 w-3.5 text-primary shrink-0" />
                      {t('booking.settings.requireAndroidStudio')}
                    </div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <CheckCircle2 className="h-3.5 w-3.5 text-primary shrink-0" />
                      {t('booking.settings.requireNode')}
                    </div>
                  </div>
                </div>

                <Button className="w-full" onClick={() => handleDownloadAppPack('android')} disabled={downloadingAndroid}>
                  {downloadingAndroid ? (
                    <><Loader2 className="h-4 w-4 me-2 animate-spin" />{t('booking.settings.downloadingPack')}</>
                  ) : (
                    <><Download className="h-4 w-4 me-2" />{t('booking.settings.downloadAndroidPack')}</>
                  )}
                </Button>

                <PublishingProgressTracker
                  platform="android"
                  progress={progressData['android']}
                  onToggle={(step) => handleToggleStep('android', step)}
                  t={t as any}
                />
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      )}

      {/* ========== MODE 4: Done-for-You Publishing (Premium) ========== */}
      {settings?.is_live && (
        <Card className="border-dashed">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <Crown className="h-5 w-5 text-amber-500" />
              <CardTitle className="text-sm font-medium text-foreground">
                {t('booking.settings.mode4Title', 'Done-for-You Publishing')}
              </CardTitle>
              <Badge variant="secondary" className="text-[10px] bg-amber-500/10 text-amber-700 border-amber-500/20">
                {t('booking.settings.premium', 'Premium')}
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-3">
              {t('booking.settings.mode4Desc', 'Let our team handle building, signing, and submitting your app to the stores. Focus on your business while we handle the technical details.')}
            </p>
            <Button variant="outline" size="sm" asChild>
              <a href="mailto:support@bookivo.com">
                <Mail className="h-4 w-4 me-2" />
                {t('booking.settings.contactUs', 'Contact Us')}
              </a>
            </Button>
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

// ============ Publishing Progress Tracker Component ============
function PublishingProgressTracker({
  platform,
  progress,
  onToggle,
  t,
}: {
  platform: 'ios' | 'android';
  progress?: Record<string, boolean>;
  onToggle: (step: string) => void;
  t: (key: string, fallback?: string) => any;
}) {
  const steps = PUBLISHING_STEPS;
  const data = progress ?? {};
  const completedCount = steps.filter(s => data[s]).length;

  return (
    <div className="space-y-2">
      <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
        {t('booking.settings.publishingProgress', 'Publishing Progress')} ({completedCount}/{steps.length})
      </Label>
      <div className="space-y-1">
        {steps.map((step, i) => {
          const done = data[step] ?? false;
          return (
            <button
              key={step}
              type="button"
              onClick={() => onToggle(step)}
              className={`w-full flex items-center gap-2 text-sm p-2 rounded-md transition-colors text-start ${
                done
                  ? 'text-foreground bg-primary/5'
                  : 'text-muted-foreground hover:bg-muted/50'
              }`}
            >
              <div className={`h-5 w-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${
                done ? 'border-primary bg-primary text-primary-foreground' : 'border-muted-foreground/30'
              }`}>
                {done && <Check className="h-3 w-3" />}
              </div>
              <span className={done ? 'line-through opacity-70' : ''}>
                {t(`booking.settings.step.${step}`, step)}
              </span>
              {i === 0 && !done && (
                <ChevronRight className="h-3 w-3 ms-auto text-muted-foreground" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
