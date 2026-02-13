/**
 * V2 Public Booking Layout
 * Uses shared tenant resolver as single source of truth.
 * Surfaces errors in dev via DiagnosticsPanel.
 */
import { Outlet, NavLink, useParams, Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { tenantQueryOptions, type ResolvedTenant } from '@/lib/booking/tenantResolver';
import { supabase } from '@/integrations/supabase/client';
import { Store, Search, User, CalendarPlus, Loader2, LogIn, LogOut, MessageCircle, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useDocumentMeta } from '@/hooks/useDocumentMeta';
import { useIsMobile } from '@/hooks/use-mobile';
import { PublicHero } from '@/components/booking/PublicHero';
import { PublicFooter } from '@/components/booking/PublicFooter';
import { Button } from '@/components/ui/button';
import { DiagnosticsPanel } from '@/components/booking/DiagnosticsPanel';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

const IS_DEV = import.meta.env.DEV;

export default function PublicBookingLayoutV2() {
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const { t } = useTranslation();
  const isMobile = useIsMobile();
  const { user } = useAuth();
  const location = useLocation();
  const isAuthPage = location.pathname.includes('/auth');

  // Single source of truth: shared tenant resolver
  const { data: settings, isLoading, error } = useQuery(tenantQueryOptions(tenantSlug));

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
        {IS_DEV && error && (
          <div className="mt-4 p-4 bg-destructive/10 border border-destructive/30 rounded-lg max-w-md text-xs">
            <div className="flex items-center gap-2 mb-2 text-destructive font-medium">
              <AlertTriangle className="h-4 w-4" />
              RPC Error (dev only)
            </div>
            <pre className="text-destructive/80 whitespace-pre-wrap break-all">
              {error instanceof Error ? error.message : JSON.stringify(error)}
            </pre>
          </div>
        )}
      </div>
    );
  }

  const tenantPrimary = settings.primary_color || undefined;
  const whatsappClean = settings.whatsapp_number?.replace(/\D/g, '');
  const basePath = `/b2/${tenantSlug}`;

  const tenantStyle = {
    '--tenant-primary': tenantPrimary,
    '--tenant-accent': settings.accent_color || undefined,
  } as React.CSSProperties;

  const navLinkClass = ({ isActive }: { isActive: boolean }) => cn(
    'flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md transition-all duration-200',
    isActive ? 'font-semibold' : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
  );

  const activeNavStyle = (isActive: boolean): React.CSSProperties =>
    isActive && tenantPrimary
      ? { color: tenantPrimary, backgroundColor: `${tenantPrimary}15` }
      : {};

  const handleSignOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <div className="min-h-screen bg-background flex flex-col pb-16 sm:pb-0" style={tenantStyle} data-theme={settings.theme_template}>
      {/* Header */}
      <header
        className="border-b border-border bg-card/95 backdrop-blur-sm px-4 py-3 sticky top-0 z-50"
        style={tenantPrimary ? { borderBottomColor: `${tenantPrimary}20` } : {}}
      >
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <Link to={basePath} className="flex items-center gap-3 min-w-0 group">
            {settings.logo_url ? (
              <img src={settings.logo_url} alt="" className="h-10 w-10 rounded-xl object-cover shrink-0 ring-1 ring-border group-hover:ring-2 transition-all" />
            ) : (
              <div
                className="h-10 w-10 rounded-xl flex items-center justify-center text-lg font-bold shrink-0 transition-transform group-hover:scale-105"
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
            <nav className="hidden sm:flex items-center gap-1 mr-2">
              <NavLink to={basePath} end className={navLinkClass} style={({ isActive }) => activeNavStyle(isActive)}>
                <Search className="h-4 w-4" />
                {t('booking.public.browse')}
              </NavLink>
              <NavLink to={`${basePath}/my`} className={navLinkClass} style={({ isActive }) => activeNavStyle(isActive)}>
                <User className="h-4 w-4" />
                {t('booking.public.myBookings')}
              </NavLink>
            </nav>

            <div className="hidden sm:block w-px h-6 bg-border mx-1" />

            <Link to={`${basePath}/request`} className="hidden sm:block">
              <Button
                size="sm"
                className="gap-1.5 text-xs font-medium rounded-full"
                style={tenantPrimary ? { backgroundColor: tenantPrimary, color: '#fff' } : {}}
              >
                <CalendarPlus className="h-3.5 w-3.5" />
                {t('booking.public.bookNow')}
              </Button>
            </Link>

            {whatsappClean && !isMobile && (
              <a href={`https://wa.me/${whatsappClean}`} target="_blank" rel="noopener noreferrer">
                <Button size="sm" variant="outline" className="gap-1.5 text-xs hidden sm:inline-flex rounded-full">
                  <MessageCircle className="h-3.5 w-3.5" />
                  WhatsApp
                </Button>
              </a>
            )}

            {user ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    className="h-8 w-8 rounded-full flex items-center justify-center text-xs font-medium shrink-0 cursor-pointer ring-1 ring-border hover:ring-2 transition-all"
                    style={{
                      backgroundColor: tenantPrimary ? `${tenantPrimary}18` : 'hsl(var(--primary) / 0.12)',
                      color: tenantPrimary || 'hsl(var(--primary))',
                    }}
                  >
                    {user.email?.charAt(0).toUpperCase() || 'U'}
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <div className="px-2 py-1.5">
                    <p className="text-sm font-medium text-foreground truncate">{user.email}</p>
                  </div>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <Link to={`${basePath}/my`} className="gap-2 cursor-pointer">
                      <User className="h-4 w-4" />
                      {t('booking.public.myBookings')}
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleSignOut} className="gap-2 cursor-pointer text-destructive">
                    <LogOut className="h-4 w-4" />
                    {t('topbar.signOut')}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <Link to={`${basePath}/auth`}>
                <Button size="sm" variant="ghost" className="gap-1.5 text-xs">
                  <LogIn className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">{t('booking.public.auth.signIn')}</span>
                </Button>
              </Link>
            )}
          </div>
        </div>
      </header>

      {/* Hero */}
      {!isAuthPage && (
        <PublicHero
          theme={settings.theme_template}
          workspaceName={workspaceName}
          tenantSlug={tenantSlug!}
          primaryColor={tenantPrimary}
          logoUrl={settings.logo_url}
          tone={settings.tone}
        />
      )}

      <main className="max-w-5xl mx-auto px-4 py-6 flex-1 w-full">
        <Outlet context={{ settings, tenantSlug, basePath }} />
      </main>

      {!isAuthPage && (
        <PublicFooter
          tenantSlug={tenantSlug!}
          workspaceName={workspaceName}
          contactEmail={settings.contact_email}
          whatsappNumber={settings.whatsapp_number}
          privacyUrl={null}
          primaryColor={tenantPrimary}
        />
      )}

      {/* Mobile bottom navigation */}
      {isMobile && !isAuthPage && (
        <nav
          className="fixed bottom-0 inset-x-0 border-t border-border bg-card/95 backdrop-blur-sm z-50 flex items-center justify-around h-14"
          style={tenantPrimary ? { borderTopColor: `${tenantPrimary}20` } : {}}
        >
          <NavLink to={basePath} end className={({ isActive }) => cn('flex flex-col items-center gap-0.5 text-[10px] py-1 px-3 rounded-md transition-all', isActive ? 'font-semibold' : 'text-muted-foreground')} style={({ isActive }) => activeNavStyle(isActive)}>
            <Search className="h-5 w-5" />
            {t('booking.public.browse')}
          </NavLink>
          <NavLink to={`${basePath}/request`} className={({ isActive }) => cn('flex flex-col items-center gap-0.5 text-[10px] py-1 px-3 rounded-md transition-all', isActive ? 'font-semibold' : 'text-muted-foreground')} style={({ isActive }) => activeNavStyle(isActive)}>
            <CalendarPlus className="h-5 w-5" />
            {t('booking.public.bookNow')}
          </NavLink>
          <NavLink to={`${basePath}/my`} className={({ isActive }) => cn('flex flex-col items-center gap-0.5 text-[10px] py-1 px-3 rounded-md transition-all', isActive ? 'font-semibold' : 'text-muted-foreground')} style={({ isActive }) => activeNavStyle(isActive)}>
            <User className="h-5 w-5" />
            {t('booking.public.myBookings')}
          </NavLink>
        </nav>
      )}

      {/* Sticky mobile CTA */}
      {isMobile && !isAuthPage && !location.pathname.includes('/request') && !location.pathname.includes('/my') && !location.pathname.includes('/auth') && (
        <div className="fixed bottom-16 inset-x-0 z-40 px-4 py-2 bg-card/90 backdrop-blur-sm border-t border-border">
          <Link to={`${basePath}/request`} className="block">
            <Button className="w-full rounded-full font-semibold gap-2" style={tenantPrimary ? { backgroundColor: tenantPrimary, color: '#fff' } : {}}>
              <CalendarPlus className="h-4 w-4" />
              {t('booking.public.bookNow')}
            </Button>
          </Link>
        </div>
      )}

      {/* Diagnostics (admin + dev only) */}
      {settings?.workspace_id && (
        <DiagnosticsPanel tenantSlug={tenantSlug!} workspaceId={settings.workspace_id} />
      )}
    </div>
  );
}
