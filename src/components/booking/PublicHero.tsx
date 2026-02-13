import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Search, Calendar, CalendarPlus } from 'lucide-react';

interface PublicHeroProps {
  theme: string;
  workspaceName: string;
  tenantSlug: string;
  basePath?: string;
  primaryColor?: string;
  logoUrl?: string | null;
  tone?: string | null;
}

function InitialsAvatar({ name, color }: { name: string; color?: string }) {
  const initial = name.charAt(0).toUpperCase();
  return (
    <div
      className="h-14 w-14 rounded-xl flex items-center justify-center text-2xl font-bold shrink-0"
      style={{
        backgroundColor: color ? `${color}20` : 'hsl(var(--primary) / 0.15)',
        color: color || 'hsl(var(--primary))',
      }}
    >
      {initial}
    </div>
  );
}

export function PublicHero({ theme, workspaceName, tenantSlug, basePath, primaryColor, logoUrl, tone }: PublicHeroProps) {
  const { t } = useTranslation();
  const resolvedBase = basePath || `/b/${tenantSlug}`;

  const toneMessage: Record<string, string> = {
    professional: 'Professional service, exceptional results.',
    friendly: 'Welcome! We\'re glad you\'re here.',
    luxury: 'Experience premium service excellence.',
    casual: 'Hey there! Let\'s get you booked.',
  };
  const tagline = tone ? toneMessage[tone] || '' : '';

  if (theme === 'eventServices') {
    return (
      <section
        className="relative overflow-hidden py-16 sm:py-20 px-4"
        style={{
          background: primaryColor
            ? `linear-gradient(135deg, ${primaryColor}, ${primaryColor}CC, ${primaryColor}99)`
            : 'linear-gradient(135deg, hsl(var(--primary)), hsl(var(--primary) / 0.8), hsl(var(--primary) / 0.6))',
        }}
      >
        <div className="absolute inset-0 opacity-10" style={{
          backgroundImage: 'radial-gradient(circle at 20% 50%, rgba(255,255,255,0.3) 0%, transparent 50%), radial-gradient(circle at 80% 20%, rgba(255,255,255,0.2) 0%, transparent 50%)',
        }} />
        <div className="max-w-5xl mx-auto relative z-10 text-center space-y-6">
          <div className="flex justify-center">
            {logoUrl ? (
              <img src={logoUrl} alt="" className="h-16 w-16 rounded-2xl object-cover shadow-lg" />
            ) : (
              <InitialsAvatar name={workspaceName} color="#ffffff" />
            )}
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold" style={{ color: '#ffffff' }}>
            {workspaceName}
          </h1>
          {tagline && (
            <p className="text-lg max-w-md mx-auto" style={{ color: 'rgba(255,255,255,0.85)' }}>
              {tagline}
            </p>
          )}
          <div className="flex items-center justify-center gap-3 pt-2">
            <Link to={`${resolvedBase}/request`}>
              <Button size="lg" className="gap-2 rounded-full px-8 font-semibold shadow-lg"
                style={{
                  backgroundColor: '#ffffff',
                  color: primaryColor || 'hsl(var(--primary))',
                }}
              >
                <CalendarPlus className="h-4 w-4" />
                {t('booking.public.bookNow')}
              </Button>
            </Link>
          </div>
        </div>
      </section>
    );
  }

  if (theme === 'marketplace') {
    return (
      <section className="py-10 px-4 border-b border-border">
        <div className="max-w-5xl mx-auto space-y-5">
          <div className="flex items-center gap-4">
            {logoUrl ? (
              <img src={logoUrl} alt="" className="h-12 w-12 rounded-xl object-cover" />
            ) : (
              <InitialsAvatar name={workspaceName} color={primaryColor} />
            )}
            <div>
              <h1 className="text-2xl font-bold text-foreground">{workspaceName}</h1>
              {tagline && <p className="text-sm text-muted-foreground">{tagline}</p>}
            </div>
          </div>
          <div className="relative max-w-lg">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={t('booking.public.hero.searchPlaceholder')}
              className="pl-10"
              readOnly
            />
          </div>
        </div>
      </section>
    );
  }

  if (theme === 'rentals') {
    return (
      <section
        className="py-10 px-4 border-b border-border"
        style={{
          background: primaryColor ? `linear-gradient(180deg, ${primaryColor}08, transparent)` : undefined,
        }}
      >
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            {logoUrl ? (
              <img src={logoUrl} alt="" className="h-12 w-12 rounded-xl object-cover" />
            ) : (
              <InitialsAvatar name={workspaceName} color={primaryColor} />
            )}
            <div>
              <h1 className="text-2xl font-bold text-foreground">{workspaceName}</h1>
              <p className="text-sm text-muted-foreground flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5" />
                {t('booking.public.hero.rentalsTitle')}
              </p>
            </div>
          </div>
        </div>
      </section>
    );
  }

  // generic / default
  return (
    <section className="py-8 px-4 border-b border-border">
      <div className="max-w-5xl mx-auto flex items-center gap-4">
        {logoUrl ? (
          <img src={logoUrl} alt="" className="h-10 w-10 rounded-lg object-cover" />
        ) : (
          <InitialsAvatar name={workspaceName} color={primaryColor} />
        )}
        <div>
          <h1 className="text-xl font-semibold text-foreground">
            {t('booking.public.hero.genericTitle', { name: workspaceName })}
          </h1>
          {tagline && <p className="text-sm text-muted-foreground">{tagline}</p>}
        </div>
      </div>
    </section>
  );
}
