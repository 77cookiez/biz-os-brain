import { useTranslation } from 'react-i18next';
import { useOutletContext, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ULLText } from '@/components/ull/ULLText';
import { Store, Package } from 'lucide-react';

export default function PublicBrowsePage() {
  const { t } = useTranslation();
  const { settings, tenantSlug } = useOutletContext<{ settings: any; tenantSlug: string }>();
  const workspaceId = settings?.workspace_id;

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
        vendor_display_name: s.vendor?.booking_vendor_profiles?.[0]?.display_name || '—',
        vendor_display_name_meaning_id: s.vendor?.booking_vendor_profiles?.[0]?.display_name_meaning_object_id || null,
      }));
    },
    enabled: !!workspaceId,
  });

  const isLoading = vLoading || sLoading;

  return (
    <div className="space-y-8">
      {/* Vendors */}
      <section>
        <h2 className="text-xl font-semibold text-foreground mb-4 flex items-center gap-2">
          <Store className="h-5 w-5" />
          {t('booking.public.vendors')}
        </h2>
        {isLoading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map(i => <Skeleton key={i} className="h-32" />)}
          </div>
        ) : vendors.length === 0 ? (
          <p className="text-muted-foreground text-sm">{t('booking.public.noVendors')}</p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {vendors.map((v: any) => (
              <Link key={v.id} to={`/b/${tenantSlug}/v/${v.id}`}>
                <Card className="hover:border-primary/50 transition-colors cursor-pointer">
                  <CardHeader className="pb-2">
                    <div className="flex items-center gap-3">
                      {v.profile?.logo_url && (
                        <img src={v.profile.logo_url} alt="" className="h-10 w-10 rounded-full object-cover" />
                      )}
                      <CardTitle className="text-base">
                        <ULLText
                          meaningId={v.profile?.display_name_meaning_object_id}
                          fallback={v.profile?.display_name || '—'}
                        />
                      </CardTitle>
                    </div>
                  </CardHeader>
                  {v.profile?.bio && (
                    <CardContent>
                      <p className="text-sm text-muted-foreground line-clamp-2">
                        <ULLText
                          meaningId={v.profile?.bio_meaning_object_id}
                          fallback={v.profile.bio}
                        />
                      </p>
                    </CardContent>
                  )}
                </Card>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* Services */}
      <section>
        <h2 className="text-xl font-semibold text-foreground mb-4 flex items-center gap-2">
          <Package className="h-5 w-5" />
          {t('booking.public.services')}
        </h2>
        {isLoading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map(i => <Skeleton key={i} className="h-28" />)}
          </div>
        ) : services.length === 0 ? (
          <p className="text-muted-foreground text-sm">{t('booking.public.noServices')}</p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {services.map((s: any) => (
              <Card key={s.id}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">
                    <ULLText meaningId={s.title_meaning_object_id} fallback={s.title} />
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-1">
                  {s.description && (
                    <p className="text-sm text-muted-foreground line-clamp-2">
                      <ULLText meaningId={s.description_meaning_object_id} fallback={s.description} />
                    </p>
                  )}
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">
                      <ULLText meaningId={s.vendor_display_name_meaning_id} fallback={s.vendor_display_name} />
                    </span>
                    {s.price_type !== 'custom_quote' && s.price_amount && (
                      <Badge variant="secondary">{s.currency} {s.price_amount}</Badge>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
