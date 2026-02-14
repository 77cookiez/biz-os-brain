import { useTranslation } from 'react-i18next';
import { useBilling } from '@/hooks/useBilling';
import { useBillingAdmin } from '@/hooks/useBillingAdmin';
import { useFeatureGuard } from '@/hooks/useFeatureGuard';
import { formatCurrency } from '@/lib/formatCurrency';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import {
  Crown, Zap, Building2, Check, X, ArrowUpRight, Mail,
  Users, CalendarCheck, Briefcase, FileText, Shield, Sparkles, ShieldAlert,
  Clock, CheckCircle2, XCircle,
} from 'lucide-react';
import { EmptyState } from '@/components/EmptyState';

function UsageBar({ label, icon, current, limit }: {
  label: string; icon: React.ReactNode; current: number; limit: number | null;
}) {
  const pct = limit ? Math.min(100, Math.round((current / limit) * 100)) : 0;
  const isNearLimit = limit ? pct >= 80 : false;
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-sm">
        <span className="flex items-center gap-2 text-muted-foreground">{icon}{label}</span>
        <span className={isNearLimit ? 'text-destructive font-medium' : 'text-foreground'}>
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

export default function BillingPage() {
  const { t } = useTranslation();
  const { plans, subscription, currentPlan, invoices, isLoading, changePlan } = useBilling();
  const { isBillingAdmin, isLoading: adminLoading, upgradeRequests, requestUpgrade, approveUpgrade, rejectUpgrade } = useBillingAdmin();
  const { usage, limits, isLoading: guardLoading, canUseFeature } = useFeatureGuard();

  if (isLoading || guardLoading || adminLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  // Non-admin gate
  if (!isBillingAdmin) {
    return (
      <EmptyState
        icon={ShieldAlert}
        title={t('billing.adminOnly', 'Admin Access Required')}
        description={t('billing.adminOnlyDesc', 'Only workspace administrators can access billing settings.')}
      />
    );
  }

  const subscriptionMode = subscription?.billing_provider || 'offline_invoice';

  const FEATURE_LIST = [
    { key: 'branding', label: t('billing.features.branding', 'Custom Branding'), icon: <Sparkles className="h-4 w-4" /> },
    { key: 'advanced_reports', label: t('billing.features.analytics', 'Advanced Analytics'), icon: <FileText className="h-4 w-4" /> },
    { key: 'api_access', label: t('billing.features.apiAccess', 'API Access'), icon: <Zap className="h-4 w-4" /> },
    { key: 'sso', label: t('billing.features.sso', 'SSO / Single Sign-On'), icon: <Shield className="h-4 w-4" /> },
    { key: 'multi_branch', label: t('billing.features.multiBranch', 'Multi-Branch'), icon: <Building2 className="h-4 w-4" /> },
    { key: 'priority_support', label: t('billing.features.prioritySupport', 'Priority Support'), icon: <Crown className="h-4 w-4" /> },
  ];

  const pendingRequests = upgradeRequests.filter(r => r.status === 'pending');

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold text-foreground">{t('billing.title', 'Billing & Plans')}</h1>
        <p className="text-sm text-muted-foreground mt-1">{t('billing.subtitle', 'Manage your subscription and usage')}</p>
      </div>

      {/* Current Plan */}
      <Card className="border-primary/30">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {PLAN_ICONS[currentPlan?.id || 'free']}
              <div>
                <CardTitle className="text-lg">{currentPlan?.name || 'Free'} {t('billing.plan', 'Plan')}</CardTitle>
                <CardDescription>
                  {subscriptionMode === 'offline_invoice' ? t('billing.offlineInvoice', 'Offline Invoice') : t('billing.stripeManaged', 'Stripe Managed')}
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

      {/* Pending Upgrade Requests (admin view) */}
      {pendingRequests.length > 0 && (
        <Card className="border-warning/30">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Clock className="h-4 w-4" />
              {t('billing.pendingUpgrades', 'Pending Upgrade Requests')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {pendingRequests.map((req) => (
              <div key={req.id} className="flex items-center justify-between p-3 border border-border rounded-lg">
                <div>
                  <p className="text-sm font-medium text-foreground">
                    {t('billing.upgradeTo', 'Upgrade to')} {plans.find(p => p.id === req.requested_plan_id)?.name || req.requested_plan_id}
                  </p>
                  <p className="text-xs text-muted-foreground">{new Date(req.created_at).toLocaleDateString()}</p>
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="default"
                    onClick={() => approveUpgrade.mutate({ requestId: req.id })}
                    disabled={approveUpgrade.isPending}
                  >
                    <CheckCircle2 className="h-4 w-4 me-1" />
                    {t('billing.approve', 'Approve')}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => rejectUpgrade.mutate({ requestId: req.id })}
                    disabled={rejectUpgrade.isPending}
                  >
                    <XCircle className="h-4 w-4 me-1" />
                    {t('billing.reject', 'Reject')}
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

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
                        if (subscriptionMode === 'offline_invoice') {
                          requestUpgrade.mutate({ planId: plan.id });
                        } else {
                          changePlan.mutate({ planId: plan.id, billingCycle: 'monthly' });
                        }
                      }}
                      disabled={changePlan.isPending || requestUpgrade.isPending}
                    >
                      <ArrowUpRight className="h-4 w-4 me-1" />
                      {subscriptionMode === 'offline_invoice'
                        ? t('billing.requestUpgrade', 'Request Upgrade')
                        : plan.price_monthly > (currentPlan?.price_monthly ?? 0)
                          ? t('billing.upgrade', 'Upgrade')
                          : t('billing.switch', 'Switch')}
                    </Button>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Invoices */}
      {invoices.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">{t('billing.invoices', 'Invoices')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {invoices.slice(0, 10).map((inv) => (
                <div key={inv.id} className="flex items-center justify-between text-sm border-b border-border pb-2 last:border-0">
                  <div>
                    <span className="text-foreground">{inv.invoice_number || inv.id.slice(0, 8)}</span>
                    <span className="text-muted-foreground ms-2">{new Date(inv.period_start).toLocaleDateString()}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{formatCurrency(inv.amount, inv.currency)}</span>
                    <Badge variant={inv.status === 'paid' ? 'default' : 'secondary'} className="text-xs">{inv.status}</Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

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
