import { Outlet, NavLink, useParams, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Store, Search, User, Plus, Loader2, LogIn, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useDocumentMeta } from '@/hooks/useDocumentMeta';
import { useIsMobile } from '@/hooks/use-mobile';
import { PublicHero } from '@/components/booking/PublicHero';
import { PublicFooter } from '@/components/booking/PublicFooter';
import { Button } from '@/components/ui/button';

export default function PublicBookingLayout() {
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const { t } = useTranslation();
  const isMobile = useIsMobile();
  const { user } = useAuth();

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
    title: workspaceName ? `${workspaceName} — Bookivo` : 'Bookivo',
    description: `Browse services and book with ${workspaceName}`,
    ogTitle: workspaceName,
    ogDescription: `Browse services and book with ${workspaceName}`,
    ogImage: settings?.logo_url || undefined,
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
  const whatsappClean = settings.whatsapp_number?.replace(/\D/g, '');

  const tenantStyle = {
    '--tenant-primary': tenantPrimary,
    '--tenant-accent': settings.accent_color || undefined,
  } as React.CSSProperties;

  const navLinkClass = ({ isActive }: { isActive: boolean }) => cn(
    'flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md transition-colors',
    isActive ? 'font-semibold' : 'text-muted-foreground hover:text-foreground'
  );

  const activeNavStyle = (isActive: boolean): React.CSSProperties =>
    isActive && tenantPrimary
      ? { color: tenantPrimary, backgroundColor: `${tenantPrimary}15` }
      : {};

  return (
    <div className="min-h-screen bg-background flex flex-col pb-16 sm:pb-0" style={tenantStyle} data-theme={settings.theme_template}>
      {/* Header */}
      <header
        className="border-b border-border bg-card px-4 py-3"
        style={tenantPrimary ? { borderBottomColor: `${tenantPrimary}30` } : {}}
      >
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <Link to={`/b/${tenantSlug}`} className="flex items-center gap-3 min-w-0">
            {settings.logo_url ? (
              <img src={settings.logo_url} alt="" className="h-10 w-10 rounded-lg object-cover shrink-0" />
            ) : (
              <div
                className="h-10 w-10 rounded-lg flex items-center justify-center text-lg font-bold shrink-0"
                style={{
                  backgroundColor: tenantPrimary ? `${tenantPrimary}18` : 'hsl(var(--primary) / 0.12)',
                  color: tenantPrimary || 'hsl(var(--primary))',
                }}
              >
                {workspaceName.charAt(0).toUpperCase()}
              </div>
            )}
            <span className="text-lg font-semibold text-foreground truncate">
              {workspaceName}
            </span>
          </Link>

          <div className="flex items-center gap-2">
            {/* Desktop nav */}
            <nav className="hidden sm:flex items-center gap-2">
              <NavLink to={`/b/${tenantSlug}`} end className={navLinkClass} style={({ isActive }) => activeNavStyle(isActive)}>
                <Search className="h-4 w-4" />
                {t('booking.public.browse')}
              </NavLink>
              <NavLink to={`/b/${tenantSlug}/my`} className={navLinkClass} style={({ isActive }) => activeNavStyle(isActive)}>
                <User className="h-4 w-4" />
                {t('booking.public.myBookings')}
              </NavLink>
            </nav>

            {/* WhatsApp CTA (desktop) */}
            {whatsappClean && !isMobile && (
              <a href={`https://wa.me/${whatsappClean}`} target="_blank" rel="noopener noreferrer">
                <Button size="sm" variant="outline" className="gap-1.5 text-xs hidden sm:inline-flex">
                  WhatsApp
                </Button>
              </a>
            )}

            {/* Auth state */}
            {user ? (
              <div
                className="h-8 w-8 rounded-full flex items-center justify-center text-xs font-medium shrink-0"
                style={{
                  backgroundColor: tenantPrimary ? `${tenantPrimary}18` : 'hsl(var(--primary) / 0.12)',
                  color: tenantPrimary || 'hsl(var(--primary))',
                }}
              >
                {user.email?.charAt(0).toUpperCase() || 'U'}
              </div>
            ) : (
              <Link to={`/b/${tenantSlug}/auth`}>
                <Button size="sm" variant="ghost" className="gap-1.5 text-xs">
                  <LogIn className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">{t('booking.public.auth.signIn')}</span>
                </Button>
              </Link>
            )}

            {/* Vendor login (desktop, subtle) */}
            <Link to={`/v/${tenantSlug}`} className="hidden sm:block text-xs text-muted-foreground hover:text-foreground transition-colors">
              {t('booking.public.footer.vendorLogin')}
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <PublicHero
        theme={settings.theme_template}
        workspaceName={workspaceName}
        tenantSlug={tenantSlug!}
        primaryColor={tenantPrimary}
        logoUrl={settings.logo_url}
        tone={settings.tone}
      />

      {/* Main content */}
      <main className="max-w-5xl mx-auto px-4 py-6 flex-1 w-full">
        <Outlet context={{ settings, tenantSlug }} />
      </main>

      {/* Footer */}
      <PublicFooter
        tenantSlug={tenantSlug!}
        workspaceName={workspaceName}
        contactEmail={settings.contact_email}
        whatsappNumber={settings.whatsapp_number}
        privacyUrl={null}
        primaryColor={tenantPrimary}
      />

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

      {/* Sticky mobile CTA (only on browse/vendor pages) */}
      {isMobile && (
        <div className="fixed bottom-14 inset-x-0 z-40 px-4 py-2 bg-card/90 backdrop-blur border-t border-border">
          <Link to={`/b/${tenantSlug}/request`} className="block">
            <Button
              className="w-full rounded-full font-semibold gap-2"
              style={tenantPrimary ? { backgroundColor: tenantPrimary, color: '#fff' } : {}}
            >
              <Sparkles className="h-4 w-4" />
              {t('booking.public.requestQuote')}
            </Button>
          </Link>
        </div>
      )}
    </div>
  );
}
