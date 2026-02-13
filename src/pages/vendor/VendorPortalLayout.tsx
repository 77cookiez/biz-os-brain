import { Outlet, NavLink, useParams, Navigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { LayoutDashboard, MessageSquare, Calendar, Package, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function VendorPortalLayout() {
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const { t } = useTranslation();
  const { user } = useAuth();

  // Resolve settings + vendor
  const { data, isLoading } = useQuery({
    queryKey: ['vendor-portal', tenantSlug, user?.id],
    queryFn: async () => {
      if (!tenantSlug || !user) return null;
      const { data: settings } = await supabase
        .from('booking_settings')
        .select('workspace_id')
        .eq('tenant_slug', tenantSlug)
        .eq('is_live', true)
        .maybeSingle();
      if (!settings) return null;

      const { data: vendor } = await supabase
        .from('booking_vendors')
        .select('id, status')
        .eq('workspace_id', settings.workspace_id)
        .eq('owner_user_id', user.id)
        .maybeSingle();

      return { workspaceId: settings.workspace_id, vendor };
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
  const tabs = [
    { labelKey: 'booking.vendor.dashboard', icon: LayoutDashboard, path: basePath },
    { labelKey: 'booking.vendor.quotes', icon: MessageSquare, path: `${basePath}/quotes` },
    { labelKey: 'booking.vendor.calendar', icon: Calendar, path: `${basePath}/calendar` },
    { labelKey: 'booking.vendor.chat', icon: Package, path: `${basePath}/chat` },
  ];

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card px-4 py-3">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <span className="text-lg font-semibold text-foreground">{t('booking.vendor.portalTitle')}</span>
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
            >
              <tab.icon className="h-4 w-4" />
              <span className="hidden sm:inline">{t(tab.labelKey)}</span>
            </NavLink>
          ))}
        </div>
      </nav>
      <main className="max-w-5xl mx-auto px-4 py-6">
        <Outlet context={{ workspaceId: data.workspaceId, vendorId: data.vendor.id, tenantSlug }} />
      </main>
    </div>
  );
}
