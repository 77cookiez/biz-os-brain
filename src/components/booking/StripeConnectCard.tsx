import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useBookingSettings } from '@/hooks/useBookingSettings';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loader2, CheckCircle2, AlertCircle, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

export function StripeConnectCard() {
  const { t } = useTranslation();
  const { settings, isLoading } = useBookingSettings();
  const { currentWorkspace } = useWorkspace();
  const [connecting, setConnecting] = useState(false);

  const isConnected = settings?.stripe_onboarding_completed;
  const hasAccountId = !!settings?.stripe_account_id;

  const handleConnect = async () => {
    if (!currentWorkspace?.id) return;
    setConnecting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) throw new Error('Not authenticated');

      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/stripe-connect-onboard`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify({
            workspace_id: currentWorkspace.id,
            return_url: `${window.location.origin}/apps/booking/settings?stripe=success`,
            refresh_url: `${window.location.origin}/apps/booking/settings?stripe=refresh`,
          }),
        }
      );

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to create Stripe onboarding link');
      }

      const { url } = await res.json();
      window.location.href = url;
    } catch (err: any) {
      console.error('Stripe connect error:', err);
      toast.error(err.message || t('booking.settings.stripeConnectError', 'Failed to connect Stripe'));
    } finally {
      setConnecting(false);
    }
  };

  if (isLoading || !settings?.is_live) return null;

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <CardTitle className="text-sm font-medium text-foreground">
            {t('booking.settings.stripeConnect', 'Payment Processing')}
          </CardTitle>
          {isConnected ? (
            <Badge variant="default" className="text-[10px]">
              {t('booking.settings.stripeConnected', 'Connected')}
            </Badge>
          ) : hasAccountId ? (
            <Badge variant="secondary" className="text-[10px]">
              {t('booking.settings.stripePending', 'Pending')}
            </Badge>
          ) : null}
        </div>
        <CardDescription>
          {t('booking.settings.stripeConnectDesc', 'Connect your Stripe account to receive payments directly from customers.')}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {isConnected ? (
          <div className="flex items-start gap-2 p-3 rounded-lg bg-primary/5 border border-primary/20">
            <CheckCircle2 className="h-4 w-4 text-primary mt-0.5 shrink-0" />
            <div className="text-sm">
              <p className="font-medium text-foreground">
                {t('booking.settings.stripeActive', 'Stripe account is active')}
              </p>
              <p className="text-muted-foreground text-xs mt-0.5">
                {t('booking.settings.stripeActiveDesc', 'Payments from customers will go directly to your connected Stripe account.')}
              </p>
              {settings.stripe_account_id && (
                <p className="text-xs font-mono text-muted-foreground mt-1" dir="ltr">
                  {settings.stripe_account_id}
                </p>
              )}
            </div>
          </div>
        ) : hasAccountId ? (
          <div className="space-y-3">
            <div className="flex items-start gap-2 p-3 rounded-lg bg-destructive/5 border border-destructive/20">
              <AlertCircle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
              <div className="text-sm">
                <p className="font-medium text-foreground">
                  {t('booking.settings.stripeIncomplete', 'Onboarding incomplete')}
                </p>
                <p className="text-muted-foreground text-xs mt-0.5">
                  {t('booking.settings.stripeIncompleteDesc', 'Complete your Stripe onboarding to start accepting payments.')}
                </p>
              </div>
            </div>
            <Button onClick={handleConnect} disabled={connecting} className="w-full">
              {connecting ? (
                <><Loader2 className="h-4 w-4 me-2 animate-spin" />{t('booking.settings.connecting', 'Connecting...')}</>
              ) : (
                <><ExternalLink className="h-4 w-4 me-2" />{t('booking.settings.completeOnboarding', 'Complete Stripe Onboarding')}</>
              )}
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="space-y-1.5">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <CheckCircle2 className="h-3.5 w-3.5 text-primary shrink-0" />
                {t('booking.settings.stripeFeature1', 'Accept credit card payments')}
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <CheckCircle2 className="h-3.5 w-3.5 text-primary shrink-0" />
                {t('booking.settings.stripeFeature2', 'Payments go directly to your account')}
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <CheckCircle2 className="h-3.5 w-3.5 text-primary shrink-0" />
                {t('booking.settings.stripeFeature3', 'Secure and PCI compliant')}
              </div>
            </div>
            <Button onClick={handleConnect} disabled={connecting} className="w-full">
              {connecting ? (
                <><Loader2 className="h-4 w-4 me-2 animate-spin" />{t('booking.settings.connecting', 'Connecting...')}</>
              ) : (
                t('booking.settings.connectStripe', 'Connect Stripe Account')
              )}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
