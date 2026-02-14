import { useTranslation } from 'react-i18next';
import { Star } from 'lucide-react';

export default function SocialProofStrip() {
  const { t } = useTranslation();

  return (
    <section className="py-8 border-y border-border bg-card/30" aria-label="Social proof">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-wrap items-center justify-center gap-8 text-sm text-muted-foreground">
        <div className="flex items-center gap-3">
          <div className="flex -space-x-2 rtl:space-x-reverse">
            {['A', 'B', 'C', 'D'].map((l, i) => (
              <div key={i} className="h-8 w-8 rounded-full bg-primary/20 border-2 border-background flex items-center justify-center text-xs font-medium text-primary">
                {l}
              </div>
            ))}
          </div>
          <span>{t('bookivo.landing.social.trusted', 'Trusted by 500+ service businesses')}</span>
        </div>

        <div className="flex items-center gap-1">
          {[...Array(5)].map((_, i) => (
            <Star key={i} className="h-4 w-4 fill-primary text-primary" />
          ))}
          <span className="ms-1">5.0</span>
        </div>

        <span>{t('bookivo.landing.social.bookings', '10,000+ bookings managed')}</span>
      </div>
    </section>
  );
}
