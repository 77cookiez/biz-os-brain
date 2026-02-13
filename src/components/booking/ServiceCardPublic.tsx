import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ULLText } from '@/components/ull/ULLText';
import { Clock, Users, Star, CalendarPlus } from 'lucide-react';
import { formatCurrency } from '@/lib/formatCurrency';

interface ServiceCardPublicProps {
  service: {
    id: string;
    title: string;
    title_meaning_object_id?: string;
    description?: string | null;
    description_meaning_object_id?: string | null;
    price_type: string;
    price_amount?: number | null;
    currency?: string;
    duration_minutes?: number | null;
    min_guests?: number | null;
    max_guests?: number | null;
  };
  vendorName?: string;
  vendorNameMeaningId?: string | null;
  tenantSlug: string;
  basePath?: string;
  vendorId?: string;
  currency: string;
  languageCode: string;
  primaryColor?: string;
  featured?: boolean;
}

export function ServiceCardPublic({
  service,
  vendorName,
  vendorNameMeaningId,
  tenantSlug,
  basePath,
  vendorId,
  currency,
  languageCode,
  primaryColor,
  featured,
}: ServiceCardPublicProps) {
  const { t } = useTranslation();
  const resolvedBase = basePath || `/b/${tenantSlug}`;

  return (
    <Card className={`group relative overflow-hidden transition-all hover:shadow-lg hover:-translate-y-0.5 duration-200 ${featured ? 'ring-2 ring-primary/30' : ''}`}>
      {/* Gradient top accent */}
      <div
        className="h-1.5 w-full"
        style={{
          background: primaryColor
            ? `linear-gradient(90deg, ${primaryColor}, ${primaryColor}80)`
            : 'linear-gradient(90deg, hsl(var(--primary)), hsl(var(--primary) / 0.5))',
        }}
      />
      {featured && (
        <div className="absolute top-3 right-3 z-10">
          <Badge className="gap-1 text-xs" style={primaryColor ? { backgroundColor: primaryColor, color: '#fff' } : {}}>
            <Star className="h-3 w-3" />
            {t('booking.public.featured')}
          </Badge>
        </div>
      )}
      <CardHeader className="pb-2 pt-4">
        <CardTitle className="text-base leading-tight pr-16">
          <ULLText meaningId={service.title_meaning_object_id} fallback={service.title} />
        </CardTitle>
        {vendorName && (
          <p className="text-xs text-muted-foreground mt-1">
            <ULLText meaningId={vendorNameMeaningId} fallback={vendorName} />
          </p>
        )}
      </CardHeader>
      <CardContent className="space-y-3">
        {service.description && (
          <p className="text-sm text-muted-foreground line-clamp-2">
            <ULLText meaningId={service.description_meaning_object_id} fallback={service.description} />
          </p>
        )}
        <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
          {service.duration_minutes && (
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {t('booking.public.serviceCard.duration', { mins: service.duration_minutes })}
            </span>
          )}
          {service.min_guests && service.max_guests && (
            <span className="flex items-center gap-1">
              <Users className="h-3 w-3" />
              {t('booking.public.serviceCard.guests', { min: service.min_guests, max: service.max_guests })}
            </span>
          )}
        </div>
        <div className="flex items-center justify-between pt-1">
          {service.price_type !== 'custom_quote' && service.price_amount ? (
            <span className="text-lg font-bold text-foreground">
              {formatCurrency(service.price_amount, service.currency || currency, languageCode)}
            </span>
          ) : (
            <span className="text-sm font-medium text-muted-foreground">
              {t('booking.public.serviceCard.getQuote')}
            </span>
          )}
          <Link to={`${resolvedBase}/request?vendor=${vendorId || ''}&service=${service.id}`}>
            <Button
              size="sm"
              className="rounded-full text-xs px-4 gap-1.5"
              style={primaryColor ? { backgroundColor: primaryColor, color: '#fff' } : {}}
            >
              <CalendarPlus className="h-3.5 w-3.5" />
              {t('booking.public.bookNow')}
            </Button>
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
