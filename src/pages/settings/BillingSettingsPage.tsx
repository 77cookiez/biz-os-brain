import { useTranslation } from 'react-i18next';
import { useBilling } from '@/hooks/useBilling';
import { useFeatureGuard } from '@/hooks/useFeatureGuard';
import { useBillingAdmin } from '@/hooks/useBillingAdmin';
import { formatCurrency } from '@/lib/formatCurrency';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import {
  Crown, Zap, Building2, Check, X, ArrowUpRight, Mail,
  Users, CalendarCheck, Briefcase, FileText, Shield, Sparkles,
  AlertTriangle, Ban,
} from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

function UsageBar({ label, icon, current, limit }: {
  label: string; icon: React.ReactNode; current: number; limit: number | null;
}) {
  const pct = limit ? Math.min(100, Math.round((current / limit) * 100)) : 0;
  const isNearLimit = limit ? pct >= 80 : false;
  const isExceeded = limit ? pct >= 100 : false;
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-sm">
        <span className="flex items-center gap-2 text-muted-foreground">{icon}{label}</span>
        <span className={isExceeded ? 'text-destructive font-bold' : isNearLimit ? 'text-destructive font-medium' : 'text-foreground'}>
          {current} / {limit ?? '∞'}
        </span>
      </div>
      {limit !== null && <Progress value={pct} className="h-2" />}
    </div>
  );
}

const PLAN_ICONS: Record<string, React.ReactNode> = {
  free: <Zap className="h-5 w-5" />,
  professional: <Crown className="h-5 w-5 text-primary" />,
  enterprise: <Building2 className="h-5 w-5 text-primary" />,
};

export default function BillingSettingsPage() {
  const { t } = useTranslation();
  const { plans, subscription, currentPlan, isLoading, changePlan } = useBilling();
  const { usage, limits, isLoading: guardLoading, canUseFeature } = useFeatureGuard();
  const { isBillingAdmin, requestUpgrade } = useBillingAdmin();

  if (isLoading || guardLoading) {
    return (
      <div className="mx-auto max-w-3xl space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  // Check usage thresholds for banners
  const usageItems = [
    { key: 'vendors', current: usage?.vendors_count ?? 0, limit: limits.vendors },
    { key: 'bookings', current: usage?.bookings_this_month ?? 0, limit: limits.bookings },
    { key: 'services', current: usage?.services_count ?? 0, limit: limits.services },
    { key: 'quotes', current: usage?.quotes_this_month ?? 0, limit: limits.quotes },
  ];
  const hasWarning = usageItems.some(u => u.limit && (u.current / u.limit) >= 0.8 && (u.current / u.limit) < 1);
  const hasExceeded = usageItems.some(u => u.limit && u.current >= u.limit);

  const FEATURE_LIST = [
    { key: 'branding', label: t('billing.features.branding', 'Custom Branding'), icon: <Sparkles className="h-4 w-4" /> },
    { key: 'advanced_reports', label: t('billing.features.analytics', 'Advanced Analytics'), icon: <FileText className="h-4 w-4" /> },
    { key: 'api_access', label: t('billing.features.apiAccess', 'API Access'), icon: <Zap className="h-4 w-4" /> },
    { key: 'sso', label: t('billing.features.sso', 'SSO / Single Sign-On'), icon: <Shield className="h-4 w-4" /> },
    { key: 'multi_branch', label: t('billing.features.multiBranch', 'Multi-Branch'), icon: <Building2 className="h-4 w-4" /> },
    { key: 'priority_support', label: t('billing.features.prioritySupport', 'Priority Support'), icon: <Crown className="h-4 w-4" /> },
  ];

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">{t('billing.title', 'Billing & Plans')}</h1>
        <p className="text-sm text-muted-foreground mt-1">{t('billing.subtitle', 'Manage your subscription and usage')}</p>
      </div>

      {/* Warning / Block Banners */}
      {hasExceeded && (
        <Alert variant="destructive">
          <Ban className="h-4 w-4" />
          <AlertTitle>{t('billing.limitExceeded', 'Limit Exceeded')}</AlertTitle>
          <AlertDescription>{t('billing.limitExceededDesc', 'You have reached one or more plan limits. Upgrade to continue without interruptions.')}</AlertDescription>
        </Alert>
      )}
      {hasWarning && !hasExceeded && (
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>{t('billing.nearLimit', 'Approaching Limit')}</AlertTitle>
          <AlertDescription>{t('billing.nearLimitDesc', 'You are using over 80% of one or more plan limits. Consider upgrading soon.')}</AlertDescription>
        </Alert>
      )}

      {/* Current Plan */}
      <Card className="border-primary/30">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {PLAN_ICONS[currentPlan?.id || 'free']}
              <div>
                <CardTitle className="text-lg">{currentPlan?.name || 'Free'} {t('billing.plan', 'Plan')}</CardTitle>
                <CardDescription>
                  {subscription?.status === 'active' ? t('billing.active', 'Active') : subscription?.status || t('billing.active', 'Active')}
                  {subscription?.current_period_end && (
                    <span className="ms-2">· {t('billing.renewsOn', 'Renews')} {new Date(subscription.current_period_end).toLocaleDateString()}</span>
                  )}
                </CardDescription>
              </div>
            </div>
            <Badge variant={subscription?.status === 'active' || subscription?.status === 'trial' ? 'default' : 'secondary'}>
              {subscription?.status || 'active'}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          {currentPlan && currentPlan.price_monthly > 0 ? (
            <p className="text-2xl font-bold text-foreground">
              {formatCurrency(currentPlan.price_monthly, currentPlan.currency)}
              <span className="text-sm font-normal text-muted-foreground">/{t('billing.month', 'mo')}</span>
            </p>
          ) : (
            <p className="text-2xl font-bold text-foreground">{t('billing.free', 'Free')}</p>
          )}
        </CardContent>
      </Card>

      {/* Usage */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">{t('billing.usage', 'Current Usage')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <UsageBar label={t('billing.vendors', 'Vendors')} icon={<Users className="h-4 w-4" />} current={usage?.vendors_count ?? 0} limit={limits.vendors ?? null} />
          <UsageBar label={t('billing.bookingsMonth', 'Bookings (this month)')} icon={<CalendarCheck className="h-4 w-4" />} current={usage?.bookings_this_month ?? 0} limit={limits.bookings ?? null} />
          <UsageBar label={t('billing.services', 'Services')} icon={<Briefcase className="h-4 w-4" />} current={usage?.services_count ?? 0} limit={limits.services ?? null} />
          <UsageBar label={t('billing.quotesMonth', 'Quotes (this month)')} icon={<FileText className="h-4 w-4" />} current={usage?.quotes_this_month ?? 0} limit={limits.quotes ?? null} />
        </CardContent>
      </Card>

      {/* Feature Access */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">{t('billing.featureAccess', 'Feature Access')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {FEATURE_LIST.map((f) => {
              const enabled = canUseFeature(f.key);
              return (
                <div key={f.key} className="flex items-center gap-2 text-sm">
                  {enabled ? <Check className="h-4 w-4 text-primary shrink-0" /> : <X className="h-4 w-4 text-muted-foreground/40 shrink-0" />}
                  <span className="flex items-center gap-1.5">
                    {f.icon}
                    <span className={enabled ? 'text-foreground' : 'text-muted-foreground'}>{f.label}</span>
                  </span>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Available Plans */}
      <div>
        <h2 className="text-lg font-semibold text-foreground mb-3">{t('billing.availablePlans', 'Available Plans')}</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {plans.map((plan) => {
            const isCurrent = plan.id === (currentPlan?.id || 'free');
            return (
              <Card key={plan.id} className={isCurrent ? 'border-primary ring-1 ring-primary/20' : ''}>
                <CardHeader className="pb-2">
                  <div className="flex items-center gap-2">
                    {PLAN_ICONS[plan.id]}
                    <CardTitle className="text-base">{plan.name}</CardTitle>
                  </div>
                  <p className="text-xl font-bold text-foreground mt-2">
                    {plan.price_monthly === 0
                      ? t('billing.free', 'Free')
                      : `${formatCurrency(plan.price_monthly, plan.currency)}/${t('billing.month', 'mo')}`}
                  </p>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="text-xs text-muted-foreground space-y-1">
                    <p>{plan.vendors_limit ?? '∞'} {t('billing.vendors', 'Vendors')}</p>
                    <p>{plan.bookings_limit ?? '∞'} {t('billing.bookingsMonth', 'Bookings/mo')}</p>
                    <p>{plan.services_limit ?? '∞'} {t('billing.services', 'Services')}</p>
                    <p>{plan.seats_limit ?? '∞'} {t('billing.seats', 'Seats')}</p>
                  </div>
                  <Separator />
                  {isCurrent ? (
                    <Badge variant="secondary" className="w-full justify-center">{t('billing.currentPlan', 'Current Plan')}</Badge>
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full"
                      onClick={() => {
                        if (isBillingAdmin) {
                          changePlan.mutate({ planId: plan.id, billingCycle: 'monthly' });
                        } else {
                          requestUpgrade.mutate({ planId: plan.id });
                        }
                      }}
                      disabled={changePlan.isPending || requestUpgrade.isPending}
                    >
                      <ArrowUpRight className="h-4 w-4 me-1" />
                      {isBillingAdmin
                        ? plan.price_monthly > (currentPlan?.price_monthly ?? 0)
                          ? t('billing.upgrade', 'Upgrade')
                          : t('billing.switch', 'Switch')
                        : t('billing.requestUpgrade', 'Request Upgrade')}
                    </Button>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Contact */}
      <Card className="border-dashed">
        <CardContent className="py-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">{t('billing.enterpriseContact', 'Need a custom plan or have questions?')}</p>
            <Button variant="outline" size="sm" asChild>
              <a href="mailto:billing@bookivo.com">
                <Mail className="h-4 w-4 me-1" />
                {t('billing.contactSales', 'Contact Sales')}
              </a>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
