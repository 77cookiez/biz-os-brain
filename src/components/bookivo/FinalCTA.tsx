import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';

export default function FinalCTA() {
  const { t } = useTranslation();

  return (
    <section className="py-20 sm:py-28 relative overflow-hidden" aria-labelledby="cta-heading">
      <div className="absolute inset-0 bg-gradient-to-br from-primary/15 via-[hsl(160_60%_45%/0.08)] to-background" />
      <div className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <h2 id="cta-heading" className="text-3xl sm:text-4xl font-bold mb-6">
          {t('bookivo.landing.cta.title', 'Ready to modernize your booking business?')}
        </h2>
        <p className="text-lg text-muted-foreground mb-8">
          {t('bookivo.landing.cta.subtitle', 'Join service businesses worldwide running on Bookivo.')}
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link to="/auth?mode=signup">
            <Button size="lg" className="h-14 px-10 text-lg gap-2">
              {t('bookivo.landing.hero.cta', 'Start Free')}
              <ArrowRight className="h-5 w-5" />
            </Button>
          </Link>
          <a href="#pricing">
            <Button variant="outline" size="lg" className="h-14 px-10 text-lg">
              {t('bookivo.landing.pricing.title', 'Simple, Transparent Pricing')}
            </Button>
          </a>
        </div>
      </div>
    </section>
  );
}
