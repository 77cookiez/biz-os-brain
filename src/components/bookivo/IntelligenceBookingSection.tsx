import { useTranslation } from 'react-i18next';
import { Users, DollarSign, ShieldAlert, TrendingUp } from 'lucide-react';

export default function IntelligenceBookingSection() {
  const { t } = useTranslation();

  const features = [
    {
      icon: Users,
      title: t('bookivo.landing.intelligence.vendorMatching', 'Smart Vendor Matching'),
      desc: t('bookivo.landing.intelligence.vendorMatchingDesc', 'AI ranks vendors based on event type, reliability score, and response history.'),
    },
    {
      icon: DollarSign,
      title: t('bookivo.landing.intelligence.pricing', 'Dynamic Price Intelligence'),
      desc: t('bookivo.landing.intelligence.pricingDesc', 'Real-time pricing suggestions based on demand patterns and booking data.'),
    },
    {
      icon: ShieldAlert,
      title: t('bookivo.landing.intelligence.risk', 'Event Risk Detection'),
      desc: t('bookivo.landing.intelligence.riskDesc', 'Predict delays, vendor conflicts, or fulfillment risks before confirmation.'),
    },
    {
      icon: TrendingUp,
      title: t('bookivo.landing.intelligence.forecasting', 'Demand Forecasting'),
      desc: t('bookivo.landing.intelligence.forecastingDesc', 'Identify high-demand periods and optimize vendor allocation.'),
    },
  ];

  return (
    <section className="py-16 sm:py-20" aria-labelledby="intelligence-heading">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h2 id="intelligence-heading" className="text-3xl sm:text-4xl font-bold mb-3 leading-tight">
            {t('bookivo.landing.intelligence.title', 'Powered by Intelligence Booking™')}
          </h2>
          <p className="text-lg text-muted-foreground mb-4">
            {t('bookivo.landing.intelligence.subtitle', 'The Intelligence Layer Behind Every Event.')}
          </p>
          <p className="text-sm text-muted-foreground max-w-2xl mx-auto leading-relaxed">
            {t('bookivo.landing.intelligence.desc', 'AI continuously analyzes vendor behavior, pricing trends, event types, response times, and booking history to optimize every decision before it happens.')}
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          {features.map((f, i) => (
            <div key={i} className="p-6 rounded-lg border border-border hover:border-primary/30 transition-colors">
              <f.icon className="h-10 w-10 text-primary mb-4" strokeWidth={1.5} />
              <h3 className="font-semibold text-lg mb-2">{f.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
