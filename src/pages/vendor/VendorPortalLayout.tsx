import { useState } from 'react';
import { Outlet, NavLink, useParams, Navigate, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { LayoutDashboard, MessageSquare, Calendar, Package, Loader2, ExternalLink, Sparkles, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';

export default function VendorPortalLayout() {
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const { t } = useTranslation();
  const { user } = useAuth();
  const [aiModalOpen, setAiModalOpen] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['vendor-portal', tenantSlug, user?.id],
    queryFn: async () => {
      if (!tenantSlug || !user) return null;
      const { data: settings } = await supabase
        .from('booking_settings')
        .select('workspace_id, primary_color, accent_color, logo_url')
        .eq('tenant_slug', tenantSlug)
        .eq('is_live', true)
        .maybeSingle();
      if (!settings) return null;

      const { data: vendor } = await supabase
        .from('booking_vendors')
        .select('id, status, booking_vendor_profiles(display_name)')
        .eq('workspace_id', settings.workspace_id)
        .eq('owner_user_id', user.id)
        .maybeSingle();

      const vendorProfile = vendor ? (Array.isArray((vendor as any).booking_vendor_profiles) ? (vendor as any).booking_vendor_profiles[0] : (vendor as any).booking_vendor_profiles) : null;

      return {
        workspaceId: settings.workspace_id,
        vendor: vendor ? { id: vendor.id, status: vendor.status } : null,
        vendorName: vendorProfile?.display_name || null,
        primaryColor: settings.primary_color,
        accentColor: settings.accent_color,
        logoUrl: settings.logo_url,
      };
    },
    enabled: !!tenantSlug && !!user,
  });

  if (!user) return <Navigate to="/auth" replace />;

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!data?.vendor) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background gap-4">
        <h1 className="text-xl font-semibold text-foreground">{t('booking.vendor.noAccess')}</h1>
        <p className="text-muted-foreground">{t('booking.vendor.noAccessDesc')}</p>
      </div>
    );
  }

  const basePath = `/v/${tenantSlug}`;
  const tenantPrimary = data?.primaryColor || undefined;
  const tabs = [
    { labelKey: 'booking.vendor.dashboard', icon: LayoutDashboard, path: basePath },
    { labelKey: 'booking.vendor.quotes', icon: MessageSquare, path: `${basePath}/quotes` },
    { labelKey: 'booking.vendor.calendar', icon: Calendar, path: `${basePath}/calendar` },
    { labelKey: 'booking.vendor.chat', icon: Package, path: `${basePath}/chat` },
  ];

  return (
    <div className="min-h-screen bg-background" style={tenantPrimary ? { '--tenant-primary': tenantPrimary } as React.CSSProperties : {}}>
      <header className="border-b border-border bg-card px-4 py-3" style={tenantPrimary ? { borderBottomColor: `${tenantPrimary}30` } : {}}>
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            {data.logoUrl ? (
              <img src={data.logoUrl} alt="" className="h-9 w-9 rounded-lg object-cover shrink-0" />
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
              {data.vendorName && (
                <span className="text-xs text-muted-foreground truncate block">{data.vendorName}</span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5 text-xs"
              onClick={() => setAiModalOpen(true)}
            >
              <Sparkles className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">{t('booking.vendor.aiAssist')}</span>
            </Button>
            <Link to={`/b/${tenantSlug}`} target="_blank">
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
          {tabs.map(tab => (
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
        <Outlet context={{ workspaceId: data.workspaceId, vendorId: data.vendor.id, tenantSlug }} />
      </main>

      {/* AI Assist Placeholder Modal */}
      <Dialog open={aiModalOpen} onOpenChange={setAiModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5" style={tenantPrimary ? { color: tenantPrimary } : {}} />
              {t('booking.vendor.aiAssistComingSoon')}
            </DialogTitle>
            <DialogDescription className="pt-2 space-y-3">
              <p>{t('booking.vendor.aiAssistDesc')}</p>
              <div className="rounded-lg border border-border bg-muted/50 p-4 text-sm text-muted-foreground">
                <p className="font-medium text-foreground mb-2">Draft → Preview → Confirm</p>
                <ul className="space-y-1 list-disc list-inside text-xs">
                  <li>Generate service titles & descriptions (AR/EN)</li>
                  <li>Suggested pricing ranges</li>
                  <li>Package & add-on creation</li>
                  <li>Terms & policy templates</li>
                  <li>Category tags</li>
                </ul>
              </div>
            </DialogDescription>
          </DialogHeader>
        </DialogContent>
      </Dialog>
    </div>
  );
}
