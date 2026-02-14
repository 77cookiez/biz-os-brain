import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';

export default function FinalCTA() {
  const { t } = useTranslation();

  return (
    <section className="py-20 sm:py-24" aria-labelledby="cta-heading">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <h2 id="cta-heading" className="text-3xl sm:text-4xl font-bold mb-6 leading-tight">
          {t('bookivo.landing.cta.title', 'Ready to modernize your booking business?')}
        </h2>
        <p className="text-muted-foreground mb-8 leading-relaxed">
          {t('bookivo.landing.cta.subtitle', 'Join service businesses worldwide running on Bookivo.')}
        </p>
        <Link to="/auth?mode=signup">
          <Button size="lg" className="h-12 px-10">
            {t('bookivo.landing.hero.cta', 'Start Free')}
          </Button>
        </Link>
      </div>
    </section>
  );
}
