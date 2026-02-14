import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';

export default function HeroSection() {
  const { t } = useTranslation();

  return (
    <section className="py-28 sm:py-40" aria-labelledby="hero-heading">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <div className="inline-flex items-center px-3 py-1 rounded-full border border-border text-xs text-muted-foreground mb-8">
          {t('bookivo.landing.hero.badge', 'AI-Powered Booking OS')}
        </div>

        <h1 id="hero-heading" className="text-5xl sm:text-6xl lg:text-7xl font-bold tracking-tight mb-6 leading-[1.08]">
          {t('bookivo.landing.hero.title', 'Run Your Booking Business with AI.')}
        </h1>

        <p className="text-lg text-muted-foreground max-w-2xl mx-auto mb-10 leading-relaxed">
          {t('bookivo.landing.hero.subtitle', 'Launch stunning booking pages, manage vendors, receive service requests, and let AI help you grow — all from one powerful platform.')}
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link to="/auth?mode=signup">
            <Button size="lg" className="h-12 px-8">
              {t('bookivo.landing.hero.cta', 'Start Free')}
            </Button>
          </Link>
          <a href="#pricing">
            <Button variant="ghost" size="lg" className="h-12 px-8 text-muted-foreground">
              {t('bookivo.landing.hero.explorePlan', 'View Pricing')}
            </Button>
          </a>
        </div>

        <p className="text-xs text-muted-foreground/60 mt-8">
          {t('bookivo.landing.hero.trust', 'No credit card required.')}
        </p>
      </div>
    </section>
  );
}
