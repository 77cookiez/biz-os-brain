import { useTranslation } from 'react-i18next';
import { useParams, useOutletContext, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ULLText } from '@/components/ull/ULLText';
import { ArrowLeft, Package, Calendar, MessageCircle, Mail } from 'lucide-react';
import { formatCurrency } from '@/lib/formatCurrency';
import { useLanguage } from '@/contexts/LanguageContext';
import { useDocumentMeta } from '@/hooks/useDocumentMeta';

export default function PublicVendorDetailPage() {
  const { t } = useTranslation();
  const { vendorId, tenantSlug } = useParams<{ vendorId: string; tenantSlug: string }>();
  const { settings } = useOutletContext<{ settings: any; tenantSlug: string }>();
  const { currentLanguage } = useLanguage();
  const workspaceId = settings?.workspace_id;
  const currency = settings?.currency || 'USD';

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
    title: vendorName ? `${vendorName} — Booking` : 'Vendor',
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

      {/* Vendor header */}
      <div className="flex flex-col sm:flex-row items-start gap-4">
        {vendor.profile?.logo_url && (
          <img src={vendor.profile.logo_url} alt="" className="h-16 w-16 rounded-full object-cover" />
        )}
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-foreground">
            <ULLText meaningId={vendor.profile?.display_name_meaning_object_id} fallback={vendor.profile?.display_name || '—'} />
          </h1>
          {vendor.profile?.bio && (
            <p className="text-muted-foreground mt-1">
              <ULLText meaningId={vendor.profile?.bio_meaning_object_id} fallback={vendor.profile.bio} />
            </p>
          )}
          {/* Contact buttons */}
          <div className="flex items-center gap-2 mt-3 flex-wrap">
            {whatsappNumber && (
              <a
                href={`https://web.whatsapp.com/send?phone=${whatsappNumber}&text=${encodeURIComponent(t('booking.public.whatsappMessage', { vendor: vendorName }))}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                <Button size="sm" variant="outline" className="gap-1.5 border-[#25D366] text-[#25D366] hover:bg-[#25D366]/10">
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
          </div>
        </div>
      </div>

      {/* Services */}
      <section>
        <h2 className="text-lg font-semibold text-foreground mb-3 flex items-center gap-2">
          <Package className="h-5 w-5" />
          {t('booking.public.services')}
        </h2>
        {sLoading ? (
          <div className="space-y-3">{[1, 2].map(i => <Skeleton key={i} className="h-24" />)}</div>
        ) : services.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('booking.public.noServices')}</p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {services.map((s: any) => (
              <Card key={s.id}>
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <CardTitle className="text-base">
                      <ULLText meaningId={s.title_meaning_object_id} fallback={s.title} />
                    </CardTitle>
                    {s.price_type !== 'custom_quote' && s.price_amount && (
                      <Badge variant="secondary">
                        {formatCurrency(s.price_amount, s.currency || currency, currentLanguage.code)}
                      </Badge>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="space-y-2">
                  {s.description && (
                    <p className="text-sm text-muted-foreground">
                      <ULLText meaningId={s.description_meaning_object_id} fallback={s.description} />
                    </p>
                  )}
                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    {s.duration_minutes && (
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {s.duration_minutes} {t('booking.calendar.startTime').toLowerCase()}
                      </span>
                    )}
                    {s.min_guests && s.max_guests && (
                      <span>{s.min_guests}–{s.max_guests} {t('booking.quotes.guestCount').toLowerCase()}</span>
                    )}
                  </div>
                  <Link to={`/b/${tenantSlug}/request?vendor=${vendorId}&service=${s.id}`}>
                    <Button size="sm" className="w-full mt-2">{t('booking.public.requestQuote')}</Button>
                  </Link>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
