import { Outlet, NavLink, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Store, Search, User, Plus, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useDocumentMeta } from '@/hooks/useDocumentMeta';
import { useIsMobile } from '@/hooks/use-mobile';

export default function PublicBookingLayout() {
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const { t } = useTranslation();
  const isMobile = useIsMobile();

  const { data: settings, isLoading, error } = useQuery({
    queryKey: ['public-booking-tenant', tenantSlug],
    queryFn: async () => {
      if (!tenantSlug) return null;
      const { data, error } = await supabase.rpc('get_live_booking_tenant_by_slug', {
        p_slug: tenantSlug,
      });
      if (error) throw error;
      return data as {
        id: string;
        workspace_id: string;
        workspace_name: string;
        tenant_slug: string;
        is_live: boolean;
        primary_color: string | null;
        accent_color: string | null;
        logo_url: string | null;
        currency: string;
        theme_template: string;
        contact_email: string | null;
        whatsapp_number: string | null;
        cancellation_policy: string;
        deposit_enabled: boolean;
        deposit_type: string | null;
        deposit_value: number | null;
        tone: string | null;
      } | null;
    },
    enabled: !!tenantSlug,
  });

  const workspaceName = settings?.workspace_name || tenantSlug || '';

  useDocumentMeta({
    title: workspaceName ? `${workspaceName} — Booking` : 'Booking',
    description: `Browse services and book with ${workspaceName}`,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!settings || error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background gap-4">
        <Store className="h-12 w-12 text-muted-foreground" />
        <h1 className="text-xl font-semibold text-foreground">{t('booking.public.notFound')}</h1>
        <p className="text-muted-foreground">{t('booking.public.notFoundDesc')}</p>
      </div>
    );
  }

  const tenantPrimary = settings.primary_color || undefined;
  const tenantAccent = settings.accent_color || undefined;

  const tenantStyle = {
    '--tenant-primary': tenantPrimary,
    '--tenant-accent': tenantAccent,
  } as React.CSSProperties;

  const navLinkClass = ({ isActive }: { isActive: boolean }) => cn(
    'flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md transition-colors',
    isActive
      ? 'font-semibold'
      : 'text-muted-foreground hover:text-foreground'
  );

  const activeNavStyle = (isActive: boolean): React.CSSProperties =>
    isActive && tenantPrimary
      ? { color: tenantPrimary, backgroundColor: `${tenantPrimary}15` }
      : {};

  return (
    <div className="min-h-screen bg-background pb-16 sm:pb-0" style={tenantStyle}>
      {/* Public header */}
      <header
        className="border-b border-border bg-card px-4 py-3"
        style={tenantPrimary ? { borderBottomColor: `${tenantPrimary}30` } : {}}
      >
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            {settings.logo_url && (
              <img src={settings.logo_url} alt="" className="h-8 w-8 rounded-md object-cover" />
            )}
            <span className="text-lg font-semibold text-foreground">
              {workspaceName}
            </span>
          </div>
          {/* Desktop nav */}
          <nav className="hidden sm:flex items-center gap-2">
            <NavLink
              to={`/b/${tenantSlug}`}
              end
              className={navLinkClass}
              style={({ isActive }) => activeNavStyle(isActive)}
            >
              <Search className="h-4 w-4" />
              {t('booking.public.browse')}
            </NavLink>
            <NavLink
              to={`/b/${tenantSlug}/my`}
              className={navLinkClass}
              style={({ isActive }) => activeNavStyle(isActive)}
            >
              <User className="h-4 w-4" />
              {t('booking.public.myBookings')}
            </NavLink>
          </nav>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6">
        <Outlet context={{ settings, tenantSlug }} />
      </main>

      {/* Mobile bottom navigation */}
      {isMobile && (
        <nav
          className="fixed bottom-0 inset-x-0 border-t border-border bg-card z-50 flex items-center justify-around h-14"
          style={tenantPrimary ? { borderTopColor: `${tenantPrimary}30` } : {}}
        >
          <NavLink
            to={`/b/${tenantSlug}`}
            end
            className={({ isActive }) => cn(
              'flex flex-col items-center gap-0.5 text-[10px] py-1 px-3 rounded-md transition-colors',
              isActive ? 'font-semibold' : 'text-muted-foreground'
            )}
            style={({ isActive }) => activeNavStyle(isActive)}
          >
            <Search className="h-5 w-5" />
            {t('booking.public.browse')}
          </NavLink>
          <NavLink
            to={`/b/${tenantSlug}/request`}
            className={({ isActive }) => cn(
              'flex flex-col items-center gap-0.5 text-[10px] py-1 px-3 rounded-md transition-colors',
              isActive ? 'font-semibold' : 'text-muted-foreground'
            )}
            style={({ isActive }) => activeNavStyle(isActive)}
          >
            <Plus className="h-5 w-5" />
            {t('booking.public.requestQuote')}
          </NavLink>
          <NavLink
            to={`/b/${tenantSlug}/my`}
            className={({ isActive }) => cn(
              'flex flex-col items-center gap-0.5 text-[10px] py-1 px-3 rounded-md transition-colors',
              isActive ? 'font-semibold' : 'text-muted-foreground'
            )}
            style={({ isActive }) => activeNavStyle(isActive)}
          >
            <User className="h-5 w-5" />
            {t('booking.public.myBookings')}
          </NavLink>
        </nav>
      )}
    </div>
  );
}
