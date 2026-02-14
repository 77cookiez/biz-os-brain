import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Check } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function PricingPreview() {
  const { t } = useTranslation();

  const tiers = [
    {
      name: t('bookivo.landing.pricing.freeName', 'Free'),
      price: '$0',
      period: t('bookivo.landing.pricing.freePeriod', 'forever'),
      features: [
        t('bookivo.landing.pricing.freeF1', 'Full platform access'),
        t('bookivo.landing.pricing.freeF2', 'Up to 3 vendors'),
        t('bookivo.landing.pricing.freeF3', 'PWA included'),
        t('bookivo.landing.pricing.freeF4', 'Multi-language'),
      ],
    },
    {
      name: t('bookivo.landing.pricing.smartName', 'Smart AI'),
      price: '$49',
      period: t('bookivo.landing.pricing.smartPeriod', '/mo — 14-day free trial'),
      popular: true,
      features: [
        t('bookivo.landing.pricing.smartF1', 'Unlimited vendors'),
        t('bookivo.landing.pricing.smartF2', 'Native App Pack'),
        t('bookivo.landing.pricing.smartF3', 'AI Booking Assistant'),
        t('bookivo.landing.pricing.smartF4', 'Priority support'),
      ],
    },
    {
      name: t('bookivo.landing.pricing.bizName', 'Business'),
      price: t('bookivo.landing.pricing.bizPrice', 'Custom'),
      period: '',
      features: [
        t('bookivo.landing.pricing.bizF1', 'Dedicated app in stores'),
        t('bookivo.landing.pricing.bizF2', 'Custom domain'),
        t('bookivo.landing.pricing.bizF3', 'SLA & onboarding'),
        t('bookivo.landing.pricing.bizF4', 'White-label branding'),
      ],
    },
  ];

  return (
    <section id="pricing" className="py-20 sm:py-28" aria-labelledby="pricing-heading">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 id="pricing-heading" className="text-3xl sm:text-4xl font-bold mb-4">
            {t('bookivo.landing.pricing.title', 'Simple, Transparent Pricing')}
          </h2>
          <p className="text-lg text-muted-foreground">
            {t('bookivo.landing.pricing.subtitle', 'Start free, upgrade when you grow.')}
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto">
          {tiers.map((tier, idx) => (
            <Card key={idx} className={`relative border-border ${tier.popular ? 'border-primary ring-1 ring-primary' : ''}`}>
              {tier.popular && (
                <div className="absolute -top-3 start-1/2 -translate-x-1/2 px-4 py-1 rounded-full bg-primary text-primary-foreground text-xs font-medium">
                  {t('bookivo.landing.pricing.popular', 'Most Popular')}
                </div>
              )}
              <CardContent className="p-8">
                <h3 className="text-xl font-semibold mb-2">{tier.name}</h3>
                <div className="mb-6">
                  <span className="text-4xl font-bold">{tier.price}</span>
                  {tier.period && <span className="text-muted-foreground text-sm ms-1">{tier.period}</span>}
                </div>
                <ul className="space-y-3 mb-8">
                  {tier.features.map((f, i) => (
                    <li key={i} className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Check className="h-4 w-4 text-primary shrink-0" />
                      {f}
                    </li>
                  ))}
                </ul>
                <Link to="/auth?mode=signup">
                  <Button variant={tier.popular ? 'default' : 'outline'} className="w-full">
                    {t('bookivo.landing.pricing.cta', 'Get Started')}
                  </Button>
                </Link>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}
