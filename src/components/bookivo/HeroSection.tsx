import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import { ArrowRight, Zap } from 'lucide-react';

export default function HeroSection() {
  const { t } = useTranslation();

  return (
    <section className="relative py-24 sm:py-36 overflow-hidden" aria-labelledby="hero-heading">
      {/* Glow orbs */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-background to-background" />
      <div className="absolute top-1/4 start-1/4 w-96 h-96 rounded-full bg-primary/8 blur-[120px]" />
      <div className="absolute bottom-1/3 end-1/4 w-72 h-72 rounded-full bg-[hsl(160_60%_45%/0.08)] blur-[100px]" />

      {/* Dot grid overlay */}
      <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'radial-gradient(hsl(var(--foreground)) 1px, transparent 1px)', backgroundSize: '24px 24px' }} />

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-border bg-card/50 backdrop-blur text-sm text-muted-foreground mb-8">
          <Zap className="h-4 w-4 text-primary" />
          {t('bookivo.landing.hero.badge', 'AI-Powered Booking OS')}
        </div>

        <h1 id="hero-heading" className="text-4xl sm:text-6xl lg:text-7xl font-bold tracking-tight mb-6 leading-[1.1]">
          {t('bookivo.landing.hero.title', 'Run Your Booking Business with AI.')}
        </h1>

        <p className="text-lg sm:text-xl text-muted-foreground max-w-3xl mx-auto mb-10">
          {t('bookivo.landing.hero.subtitle', 'Launch stunning booking pages, manage vendors, receive service requests, and let AI help you grow — all from one powerful platform.')}
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
              {t('bookivo.landing.hero.explorePlan', 'Explore Smart AI Plan')}
            </Button>
          </a>
        </div>

        <p className="text-sm text-muted-foreground mt-6">
          {t('bookivo.landing.hero.trust', 'No credit card required.')}
        </p>
      </div>
    </section>
  );
}
