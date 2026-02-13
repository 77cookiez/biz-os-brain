import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ULLText } from '@/components/ull/ULLText';
import { Star, Package } from 'lucide-react';

interface VendorCardPublicProps {
  vendor: {
    id: string;
    profile?: {
      display_name?: string;
      display_name_meaning_object_id?: string;
      bio?: string | null;
      bio_meaning_object_id?: string | null;
      logo_url?: string | null;
    } | null;
  };
  tenantSlug: string;
  serviceCount?: number;
  primaryColor?: string;
  featured?: boolean;
}

function VendorInitials({ name, color }: { name: string; color?: string }) {
  const initial = name.charAt(0).toUpperCase();
  return (
    <div
      className="h-12 w-12 rounded-full flex items-center justify-center text-lg font-bold shrink-0"
      style={{
        backgroundColor: color ? `${color}18` : 'hsl(var(--primary) / 0.12)',
        color: color || 'hsl(var(--primary))',
      }}
    >
      {initial}
    </div>
  );
}

export function VendorCardPublic({
  vendor,
  tenantSlug,
  serviceCount = 0,
  primaryColor,
  featured,
}: VendorCardPublicProps) {
  const { t } = useTranslation();
  const displayName = vendor.profile?.display_name || '—';

  return (
    <Link to={`/b/${tenantSlug}/v/${vendor.id}`}>
      <Card className={`group relative overflow-hidden transition-all hover:shadow-md cursor-pointer ${featured ? 'ring-2 ring-primary/30' : ''}`}
        style={featured && primaryColor ? { borderColor: `${primaryColor}40` } : {}}
      >
        {featured && (
          <div className="absolute top-3 right-3 z-10">
            <Badge className="gap-1 text-xs" style={primaryColor ? { backgroundColor: primaryColor, color: '#fff' } : {}}>
              <Star className="h-3 w-3" />
              {t('booking.public.featured')}
            </Badge>
          </div>
        )}
        <CardHeader className="pb-2">
          <div className="flex items-center gap-3">
            {vendor.profile?.logo_url ? (
              <img src={vendor.profile.logo_url} alt="" className="h-12 w-12 rounded-full object-cover" />
            ) : (
              <VendorInitials name={displayName} color={primaryColor} />
            )}
            <div className="min-w-0">
              <CardTitle className="text-base truncate">
                <ULLText
                  meaningId={vendor.profile?.display_name_meaning_object_id}
                  fallback={displayName}
                />
              </CardTitle>
              {serviceCount > 0 && (
                <span className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                  <Package className="h-3 w-3" />
                  {t('booking.public.vendorCard.services', { count: serviceCount })}
                </span>
              )}
            </div>
          </div>
        </CardHeader>
        {vendor.profile?.bio && (
          <CardContent className="pt-0">
            <p className="text-sm text-muted-foreground line-clamp-2">
              <ULLText
                meaningId={vendor.profile?.bio_meaning_object_id}
                fallback={vendor.profile.bio}
              />
            </p>
          </CardContent>
        )}
      </Card>
    </Link>
  );
}
