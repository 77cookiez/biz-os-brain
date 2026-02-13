import { useTranslation } from 'react-i18next';
import { useParams, useOutletContext, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ULLText } from '@/components/ull/ULLText';
import { ServiceCardPublic } from '@/components/booking/ServiceCardPublic';
import { ArrowLeft, MessageCircle, Mail } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useDocumentMeta } from '@/hooks/useDocumentMeta';

export default function PublicVendorDetailPage() {
  const { t } = useTranslation();
  const { vendorId, tenantSlug } = useParams<{ vendorId: string; tenantSlug: string }>();
  const { settings } = useOutletContext<{ settings: any; tenantSlug: string }>();
  const { currentLanguage } = useLanguage();
  const currency = settings?.currency || 'USD';
  const primaryColor = settings?.primary_color || undefined;

  const { data: vendor, isLoading: vLoading } = useQuery({
    queryKey: ['public-vendor', vendorId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('booking_vendors')
        .select('*, profile:booking_vendor_profiles(display_name, display_name_meaning_object_id, bio, bio_meaning_object_id, logo_url, cover_url, email, whatsapp)')
        .eq('id', vendorId!)
        .eq('status', 'approved')
        .single();
      if (error) throw error;
      return { ...data, profile: Array.isArray(data.profile) ? data.profile[0] : data.profile };
    },
    enabled: !!vendorId,
  });

  const { data: services = [], isLoading: sLoading } = useQuery({
    queryKey: ['public-vendor-services', vendorId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('booking_services')
        .select('*')
        .eq('vendor_id', vendorId!)
        .eq('is_active', true)
        .order('sort_order', { ascending: true });
      if (error) throw error;
      return data || [];
    },
    enabled: !!vendorId,
  });

  const vendorName = vendor?.profile?.display_name || '';
  useDocumentMeta({
    title: vendorName ? `${vendorName} — Bookivo` : 'Vendor',
    description: vendor?.profile?.bio || `View services from ${vendorName}`,
  });

  if (vLoading) {
    return <div className="space-y-4"><Skeleton className="h-48" /><Skeleton className="h-32" /></div>;
  }

  if (!vendor) {
    return <p className="text-muted-foreground">{t('booking.public.vendorNotFound')}</p>;
  }

  const whatsappNumber = vendor.profile?.whatsapp?.replace(/\D/g, '');
  const contactEmail = vendor.profile?.email;

  return (
    <div className="space-y-6">
      <Link to={`/b/${tenantSlug}`} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" />
        {t('common.back')}
      </Link>

      {/* Cover area */}
      <div
        className="rounded-xl overflow-hidden h-32 sm:h-44 relative"
        style={{
          background: vendor.profile?.cover_url
            ? `url(${vendor.profile.cover_url}) center/cover`
            : primaryColor
              ? `linear-gradient(135deg, ${primaryColor}40, ${primaryColor}15)`
              : 'linear-gradient(135deg, hsl(var(--primary) / 0.25), hsl(var(--primary) / 0.08))',
        }}
      />

      {/* Vendor header */}
      <div className="flex flex-col sm:flex-row items-start gap-4 -mt-10 sm:-mt-12 relative z-10 px-2">
        {vendor.profile?.logo_url ? (
          <img src={vendor.profile.logo_url} alt="" className="h-20 w-20 rounded-2xl object-cover border-4 border-card shadow-lg" />
        ) : (
          <div
            className="h-20 w-20 rounded-2xl flex items-center justify-center text-2xl font-bold border-4 border-card shadow-lg"
            style={{
              backgroundColor: primaryColor ? `${primaryColor}18` : 'hsl(var(--primary) / 0.12)',
              color: primaryColor || 'hsl(var(--primary))',
            }}
          >
            {vendorName.charAt(0).toUpperCase()}
          </div>
        )}
        <div className="flex-1 pt-2">
          <h1 className="text-2xl font-bold text-foreground">
            <ULLText meaningId={vendor.profile?.display_name_meaning_object_id} fallback={vendor.profile?.display_name || '—'} />
          </h1>
          {vendor.profile?.bio && (
            <p className="text-muted-foreground mt-1">
              <ULLText meaningId={vendor.profile?.bio_meaning_object_id} fallback={vendor.profile.bio} />
            </p>
          )}
          <div className="flex items-center gap-2 mt-3 flex-wrap">
            {whatsappNumber && (
              <a
                href={`https://wa.me/${whatsappNumber}?text=${encodeURIComponent(t('booking.public.whatsappMessage'))}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                <Button size="sm" variant="outline" className="gap-1.5">
                  <MessageCircle className="h-4 w-4" />
                  WhatsApp
                </Button>
              </a>
            )}
            {contactEmail && (
              <a href={`mailto:${contactEmail}`}>
                <Button size="sm" variant="outline" className="gap-1.5">
                  <Mail className="h-4 w-4" />
                  {t('booking.public.email')}
                </Button>
              </a>
            )}
            {services.length > 0 && (
              <Badge variant="secondary">{t('booking.public.vendorCard.services', { count: services.length })}</Badge>
            )}
          </div>
        </div>
      </div>

      {/* Services */}
      <section>
        <h2 className="text-lg font-semibold text-foreground mb-4">
          {t('booking.public.services')}
        </h2>
        {sLoading ? (
          <div className="grid gap-4 sm:grid-cols-2">
            {[1, 2].map(i => <Skeleton key={i} className="h-48" />)}
          </div>
        ) : services.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('booking.public.noServices')}</p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {services.map((s: any) => (
              <ServiceCardPublic
                key={s.id}
                service={s}
                tenantSlug={tenantSlug!}
                vendorId={vendorId}
                currency={currency}
                languageCode={currentLanguage.code}
                primaryColor={primaryColor}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
