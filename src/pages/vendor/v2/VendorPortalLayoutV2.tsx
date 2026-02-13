/**
 * V2 Vendor Portal Layout
 * Uses shared tenant resolver as single source of truth.
 * Vendor name rendered via ULLText for ULL compliance.
 */
import { useState } from 'react';
import { Outlet, NavLink, useParams, Navigate, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { tenantQueryOptions } from '@/lib/booking/tenantResolver';
import { ULLText } from '@/components/ull/ULLText';
import {
  LayoutDashboard, MessageSquare, Calendar, Package, Loader2,
  ExternalLink, Store, AlertTriangle, CheckCircle2, User,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { DiagnosticsPanel } from '@/components/booking/DiagnosticsPanel';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';

const IS_DEV = import.meta.env.DEV;

export default function VendorPortalLayoutV2() {
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const { t } = useTranslation();
  const { user } = useAuth();

  // Step 1: Resolve tenant
  const { data: tenant, isLoading: tenantLoading, error: tenantError } = useQuery(tenantQueryOptions(tenantSlug));

  // Step 2: Resolve vendor record with meaning IDs
  const { data: vendorData, isLoading: vendorLoading } = useQuery({
    queryKey: ['vendor-portal-v2', tenant?.workspace_id, user?.id],
    queryFn: async () => {
      if (!tenant || !user) return null;
      const { data: vendor } = await supabase
        .from('booking_vendors')
        .select('id, status, booking_vendor_profiles(display_name, display_name_meaning_object_id)')
        .eq('workspace_id', tenant.workspace_id)
        .eq('owner_user_id', user.id)
        .maybeSingle();

      const vendorProfile = vendor
        ? Array.isArray((vendor as any).booking_vendor_profiles)
          ? (vendor as any).booking_vendor_profiles[0]
          : (vendor as any).booking_vendor_profiles
        : null;

      return {
        vendor: vendor ? { id: vendor.id, status: vendor.status } : null,
        vendorName: vendorProfile?.display_name || null,
        vendorNameMeaningId: vendorProfile?.display_name_meaning_object_id || null,
      };
    },
    enabled: !!tenant?.workspace_id && !!user,
  });

  // Not logged in → redirect to tenant-scoped auth
  if (!user) {
    return <Navigate to={`/b2/${tenantSlug}/auth?redirect=/v2/${tenantSlug}`} replace />;
  }

  const isLoading = tenantLoading || vendorLoading;

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!tenant || tenantError) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background gap-4">
        <Store className="h-12 w-12 text-muted-foreground" />
        <h1 className="text-xl font-semibold text-foreground">{t('booking.public.notFound')}</h1>
        <p className="text-muted-foreground">{t('booking.public.notFoundDesc')}</p>
        {IS_DEV && tenantError && (
          <div className="mt-4 p-4 bg-destructive/10 border border-destructive/30 rounded-lg max-w-md text-xs">
            <div className="flex items-center gap-2 mb-2 text-destructive font-medium">
              <AlertTriangle className="h-4 w-4" />
              RPC Error (dev only)
            </div>
            <pre className="text-destructive/80 whitespace-pre-wrap break-all">
              {tenantError instanceof Error ? tenantError.message : JSON.stringify(tenantError)}
            </pre>
          </div>
        )}
      </div>
    );
  }

  const tenantPrimary = tenant.primary_color || undefined;

  // No vendor record → show registration
  if (!vendorData?.vendor) {
    return (
      <VendorRegistrationForm
        tenantSlug={tenantSlug || ''}
        tenantPrimary={tenantPrimary}
        logoUrl={tenant.logo_url}
      />
    );
  }

  // Vendor pending
  if (vendorData.vendor.status === 'pending') {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md text-center">
          <CardContent className="pt-8 pb-6 space-y-4">
            <div
              className="h-16 w-16 rounded-full mx-auto flex items-center justify-center"
              style={{
                backgroundColor: tenantPrimary ? `${tenantPrimary}18` : 'hsl(var(--primary) / 0.12)',
                color: tenantPrimary || 'hsl(var(--primary))',
              }}
            >
              <CheckCircle2 className="h-8 w-8" />
            </div>
            <h2 className="text-lg font-semibold text-foreground">{t('booking.vendor.pendingTitle')}</h2>
            <p className="text-sm text-muted-foreground">{t('booking.vendor.pendingDesc')}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Vendor suspended
  if (vendorData.vendor.status === 'suspended') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background gap-4">
        <h1 className="text-xl font-semibold text-foreground">{t('booking.vendor.suspended')}</h1>
        <p className="text-muted-foreground">{t('booking.vendor.suspendedDesc')}</p>
      </div>
    );
  }

  // Approved vendor → portal
  const basePath = `/v2/${tenantSlug}`;
  const tabs = [
    { labelKey: 'booking.vendor.dashboard', icon: LayoutDashboard, path: basePath },
    { labelKey: 'booking.services.title', icon: Package, path: `${basePath}/services` },
    { labelKey: 'booking.vendor.quotes', icon: MessageSquare, path: `${basePath}/quotes` },
    { labelKey: 'booking.vendor.calendar', icon: Calendar, path: `${basePath}/calendar` },
    { labelKey: 'booking.vendor.profile', icon: User, path: `${basePath}/profile` },
  ];

  return (
    <div className="min-h-screen bg-background" style={tenantPrimary ? { '--tenant-primary': tenantPrimary } as React.CSSProperties : {}}>
      <header className="border-b border-border bg-card px-4 py-3" style={tenantPrimary ? { borderBottomColor: `${tenantPrimary}30` } : {}}>
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            {tenant.logo_url ? (
              <img src={tenant.logo_url} alt="" className="h-9 w-9 rounded-lg object-cover shrink-0" />
            ) : (
              <div
                className="h-9 w-9 rounded-lg flex items-center justify-center text-sm font-bold shrink-0"
                style={{
                  backgroundColor: tenantPrimary ? `${tenantPrimary}18` : 'hsl(var(--primary) / 0.12)',
                  color: tenantPrimary || 'hsl(var(--primary))',
                }}
              >
                V
              </div>
            )}
            <div className="min-w-0">
              <span className="text-lg font-semibold text-foreground block truncate">{t('booking.vendor.portalTitle')}</span>
              {vendorData.vendorName && (
                <span className="text-xs text-muted-foreground truncate block">
                  <ULLText
                    meaningId={vendorData.vendorNameMeaningId}
                    fallback={vendorData.vendorName}
                  />
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link to={`/b2/${tenantSlug}`} target="_blank">
              <Button size="sm" variant="ghost" className="gap-1.5 text-xs">
                <ExternalLink className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">{t('booking.vendor.viewStore')}</span>
              </Button>
            </Link>
          </div>
        </div>
      </header>

      <nav className="border-b border-border bg-card px-4">
        <div className="max-w-5xl mx-auto flex items-center gap-1 overflow-x-auto scrollbar-hide">
          {tabs.map((tab) => (
            <NavLink
              key={tab.path}
              to={tab.path}
              end={tab.path === basePath}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-2 px-3 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap',
                  isActive ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'
                )
              }
              style={({ isActive }) => isActive && tenantPrimary ? { color: tenantPrimary, borderBottomColor: tenantPrimary } : {}}
            >
              <tab.icon className="h-4 w-4" />
              {t(tab.labelKey)}
            </NavLink>
          ))}
        </div>
      </nav>

      <main className="max-w-5xl mx-auto px-4 py-6">
        <Outlet context={{ workspaceId: tenant.workspace_id, vendorId: vendorData.vendor.id, tenantSlug }} />
      </main>

      {IS_DEV && <DiagnosticsPanel tenantSlug={tenantSlug || ''} workspaceId={tenant.workspace_id} />}
    </div>
  );
}

// ── Registration Form ──
function VendorRegistrationForm({
  tenantSlug,
  tenantPrimary,
  logoUrl,
}: {
  tenantSlug: string;
  tenantPrimary?: string;
  logoUrl?: string | null;
}) {
  const { t } = useTranslation();
  const [displayName, setDisplayName] = useState('');
  const [bio, setBio] = useState('');
  const [email, setEmail] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const queryClient = useQueryClient();

  const handleSubmit = async () => {
    if (!displayName.trim()) return;
    setSubmitting(true);
    try {
      const res = await supabase.functions.invoke('register-vendor', {
        body: {
          tenant_slug: tenantSlug,
          display_name: displayName.trim(),
          bio: bio.trim() || null,
          email: email.trim() || null,
          whatsapp: whatsapp.trim() || null,
          source_lang: 'en',
        },
      });
      if (res.error) throw res.error;
      const data = res.data;
      if (data?.error === 'already_registered') {
        toast.info(t('booking.vendor.alreadyRegistered'));
      } else if (data?.success) {
        toast.success(t('booking.vendor.registrationSuccess'));
        queryClient.invalidateQueries({ queryKey: ['vendor-portal-v2'] });
      } else {
        throw new Error(data?.error || 'Unknown error');
      }
    } catch (err: any) {
      console.error('Registration error:', err);
      toast.error(t('booking.vendor.registrationFailed'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-lg">
        <CardHeader className="text-center space-y-3">
          {logoUrl ? (
            <img src={logoUrl} alt="" className="h-14 w-14 rounded-xl object-cover mx-auto" />
          ) : (
            <div
              className="h-14 w-14 rounded-xl mx-auto flex items-center justify-center text-xl font-bold"
              style={{
                backgroundColor: tenantPrimary ? `${tenantPrimary}18` : 'hsl(var(--primary) / 0.12)',
                color: tenantPrimary || 'hsl(var(--primary))',
              }}
            >
              <Store className="h-7 w-7" />
            </div>
          )}
          <CardTitle className="text-xl">{t('booking.vendor.joinAsVendor')}</CardTitle>
          <CardDescription>{t('booking.vendor.joinAsVendorDesc')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>{t('booking.vendor.businessName')} *</Label>
            <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder={t('booking.vendor.businessNamePlaceholder')} />
          </div>
          <div className="space-y-2">
            <Label>{t('booking.vendor.bioLabel')}</Label>
            <Textarea value={bio} onChange={(e) => setBio(e.target.value)} placeholder={t('booking.vendor.bioPlaceholder')} rows={3} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>{t('booking.public.auth.email')}</Label>
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="vendor@example.com" />
            </div>
            <div className="space-y-2">
              <Label>WhatsApp</Label>
              <Input value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} placeholder="+971501234567" />
            </div>
          </div>
          <Button className="w-full" onClick={handleSubmit} disabled={!displayName.trim() || submitting} style={tenantPrimary ? { backgroundColor: tenantPrimary, color: '#fff' } : {}}>
            {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Store className="h-4 w-4 mr-2" />}
            {t('booking.vendor.submitRegistration')}
          </Button>
          <p className="text-xs text-muted-foreground text-center">{t('booking.vendor.pendingApprovalNote')}</p>
        </CardContent>
      </Card>
    </div>
  );
}
