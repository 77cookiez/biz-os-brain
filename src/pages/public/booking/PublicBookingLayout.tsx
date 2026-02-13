import { Outlet, NavLink, useParams, Navigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Store, Search, User, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function PublicBookingLayout() {
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const { t } = useTranslation();

  const { data: settings, isLoading, error } = useQuery({
    queryKey: ['public-booking-settings', tenantSlug],
    queryFn: async () => {
      if (!tenantSlug) return null;
      const { data, error } = await supabase
        .from('booking_settings')
        .select('*, workspace:workspaces(id, name)')
        .eq('tenant_slug', tenantSlug)
        .eq('is_live', true)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!tenantSlug,
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

  return (
    <div className="min-h-screen bg-background">
      {/* Public header — no OS navigation */}
      <header className="border-b border-border bg-card px-4 py-3">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            {settings.logo_url && (
              <img src={settings.logo_url} alt="" className="h-8 w-8 rounded-md object-cover" />
            )}
            <span className="text-lg font-semibold text-foreground">
              {(settings as any).workspace?.name || tenantSlug}
            </span>
          </div>
          <nav className="flex items-center gap-2">
            <NavLink
              to={`/b/${tenantSlug}`}
              end
              className={({ isActive }) => cn(
                'flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md transition-colors',
                isActive ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <Search className="h-4 w-4" />
              <span className="hidden sm:inline">{t('booking.public.browse')}</span>
            </NavLink>
            <NavLink
              to={`/b/${tenantSlug}/my`}
              className={({ isActive }) => cn(
                'flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md transition-colors',
                isActive ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <User className="h-4 w-4" />
              <span className="hidden sm:inline">{t('booking.public.myBookings')}</span>
            </NavLink>
          </nav>
        </div>
      </header>
      <main className="max-w-5xl mx-auto px-4 py-6">
        <Outlet context={{ settings, tenantSlug }} />
      </main>
    </div>
  );
}
