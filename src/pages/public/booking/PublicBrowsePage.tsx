import { useTranslation } from 'react-i18next';
import { useOutletContext } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Skeleton } from '@/components/ui/skeleton';
import { Store, Package } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { ServiceCardPublic } from '@/components/booking/ServiceCardPublic';
import { VendorCardPublic } from '@/components/booking/VendorCardPublic';

export default function PublicBrowsePage() {
  const { t } = useTranslation();
  const { settings, tenantSlug, basePath } = useOutletContext<{ settings: any; tenantSlug: string; basePath?: string }>();
  const resolvedBase = basePath || `/b/${tenantSlug}`;
  const { currentLanguage } = useLanguage();
  const workspaceId = settings?.workspace_id;
  const currency = settings?.currency || 'USD';
  const theme = settings?.theme_template || 'generic';
  const primaryColor = settings?.primary_color || undefined;

  const { data: vendors = [], isLoading: vLoading } = useQuery({
    queryKey: ['public-vendors', workspaceId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('booking_vendors')
        .select('*, profile:booking_vendor_profiles(display_name, display_name_meaning_object_id, bio, bio_meaning_object_id, logo_url)')
        .eq('workspace_id', workspaceId)
        .eq('status', 'approved')
        .order('created_at', { ascending: true });
      if (error) throw error;
      return (data || []).map((v: any) => ({
        ...v,
        profile: Array.isArray(v.profile) ? v.profile[0] : v.profile,
      }));
    },
    enabled: !!workspaceId,
  });

  const { data: services = [], isLoading: sLoading } = useQuery({
    queryKey: ['public-services', workspaceId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('booking_services')
        .select('*, vendor:booking_vendors(id, booking_vendor_profiles(display_name, display_name_meaning_object_id))')
        .eq('workspace_id', workspaceId)
        .eq('is_active', true)
        .order('sort_order', { ascending: true });
      if (error) throw error;
      return (data || []).map((s: any) => ({
        ...s,
        vendor_id: s.vendor?.id || s.vendor_id,
        vendor_display_name: s.vendor?.booking_vendor_profiles?.[0]?.display_name || '—',
        vendor_display_name_meaning_id: s.vendor?.booking_vendor_profiles?.[0]?.display_name_meaning_object_id || null,
      }));
    },
    enabled: !!workspaceId,
  });

  const isLoading = vLoading || sLoading;

  // Compute service count per vendor
  const vendorServiceCount: Record<string, number> = {};
  services.forEach((s: any) => {
    const vid = s.vendor_id;
    if (vid) vendorServiceCount[vid] = (vendorServiceCount[vid] || 0) + 1;
  });

  // Featured logic: first 2 services, first 1 vendor
  const featuredServiceIds = new Set(services.slice(0, 2).map((s: any) => s.id));
  const featuredVendorIds = new Set(vendors.slice(0, 1).map((v: any) => v.id));

  // Sort: featured first
  const sortedServices = [...services].sort((a: any, b: any) => {
    const af = featuredServiceIds.has(a.id) ? 0 : 1;
    const bf = featuredServiceIds.has(b.id) ? 0 : 1;
    return af - bf;
  });

  const sortedVendors = [...vendors].sort((a: any, b: any) => {
    const af = featuredVendorIds.has(a.id) ? 0 : 1;
    const bf = featuredVendorIds.has(b.id) ? 0 : 1;
    return af - bf;
  });

  // Theme-based ordering: eventServices → vendors first
  const vendorsFirst = theme === 'eventServices';

  // Grid class per theme
  const serviceGridClass = theme === 'generic'
    ? 'grid gap-4 grid-cols-1'
    : theme === 'rentals'
      ? 'grid gap-4 grid-cols-1 sm:grid-cols-2'
      : 'grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3';

  const vendorGridClass = theme === 'eventServices'
    ? 'grid gap-4 grid-cols-1 sm:grid-cols-2'
    : 'grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3';

  const VendorsSection = (
    <section>
      <h2 className="text-xl font-semibold text-foreground mb-4 flex items-center gap-2">
        <Store className="h-5 w-5" />
        {t('booking.public.vendors')}
      </h2>
      {isLoading ? (
        <div className={vendorGridClass}>
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-32" />)}
        </div>
      ) : vendors.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 gap-3 text-center">
          <Store className="h-10 w-10 text-muted-foreground" />
          <p className="text-muted-foreground text-sm">{t('booking.public.noVendors')}</p>
        </div>
      ) : (
        <div className={vendorGridClass}>
          {sortedVendors.map((v: any) => (
            <VendorCardPublic
              key={v.id}
              vendor={v}
              tenantSlug={tenantSlug}
              basePath={resolvedBase}
              serviceCount={vendorServiceCount[v.id] || 0}
              primaryColor={primaryColor}
              featured={featuredVendorIds.has(v.id)}
            />
          ))}
        </div>
      )}
    </section>
  );

  const ServicesSection = (
    <section>
      <h2 className="text-xl font-semibold text-foreground mb-4 flex items-center gap-2">
        <Package className="h-5 w-5" />
        {t('booking.public.services')}
      </h2>
      {isLoading ? (
        <div className={serviceGridClass}>
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-48" />)}
        </div>
      ) : services.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 gap-3 text-center">
          <Package className="h-10 w-10 text-muted-foreground" />
          <p className="text-muted-foreground text-sm">{t('booking.public.noServices')}</p>
        </div>
      ) : (
        <div className={serviceGridClass}>
          {sortedServices.map((s: any) => (
            <ServiceCardPublic
              key={s.id}
              service={s}
              vendorName={s.vendor_display_name}
              vendorNameMeaningId={s.vendor_display_name_meaning_id}
              tenantSlug={tenantSlug}
              basePath={resolvedBase}
              vendorId={s.vendor_id}
              currency={currency}
              languageCode={currentLanguage.code}
              primaryColor={primaryColor}
              featured={featuredServiceIds.has(s.id)}
            />
          ))}
        </div>
      )}
    </section>
  );

  return (
    <div className="space-y-10">
      {/* DEV-only debug banner */}
      {import.meta.env.DEV && (
        <div className="bg-muted/50 border border-border rounded-lg p-2 text-xs font-mono text-muted-foreground flex gap-4">
          <span>basePath: {resolvedBase}</span>
          <span>tenantSlug: {tenantSlug}</span>
          <span>workspaceId: {workspaceId?.slice(0, 8)}…</span>
          <span>vendors: {vendors.length}</span>
          <span>services: {services.length}</span>
        </div>
      )}
      {vendorsFirst ? (
        <>
          {VendorsSection}
          {ServicesSection}
        </>
      ) : (
        <>
          {ServicesSection}
          {VendorsSection}
        </>
      )}
    </div>
  );
}
