import { useTranslation } from 'react-i18next';

export default function SocialProofStrip() {
  const { t } = useTranslation();

  return (
    <section className="py-6 border-y border-border/50" aria-label="Social proof">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-center gap-8 text-sm text-muted-foreground/70">
        <span>{t('bookivo.landing.social.trusted', '500+ businesses')}</span>
        <span className="text-border">·</span>
        <span>{t('bookivo.landing.social.bookings', '10,000+ bookings')}</span>
        <span className="text-border">·</span>
        <span>4.9 {t('bookivo.landing.social.rating', 'rating')}</span>
      </div>
    </section>
  );
}
