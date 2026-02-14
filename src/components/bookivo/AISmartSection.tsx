import { useTranslation } from 'react-i18next';
import { Bot, TrendingUp, Lightbulb, BarChart3, Workflow } from 'lucide-react';

export default function AISmartSection() {
  const { t } = useTranslation();

  const features = [
    { icon: Bot, title: t('bookivo.landing.ai.pricing', 'AI Pricing Suggestions'), desc: t('bookivo.landing.ai.pricingDesc', 'Get smart pricing recommendations based on market data and your performance.') },
    { icon: TrendingUp, title: t('bookivo.landing.ai.vendorInsights', 'Vendor Performance Insights'), desc: t('bookivo.landing.ai.vendorInsightsDesc', 'Track vendor metrics, response times, and customer satisfaction scores.') },
    { icon: Lightbulb, title: t('bookivo.landing.ai.growth', 'Growth Recommendations'), desc: t('bookivo.landing.ai.growthDesc', 'Receive actionable tips to increase bookings and revenue.') },
    { icon: BarChart3, title: t('bookivo.landing.ai.analytics', 'Booking Analytics'), desc: t('bookivo.landing.ai.analyticsDesc', 'Deep insights into conversion rates, peak times, and revenue trends.') },
    { icon: Workflow, title: t('bookivo.landing.ai.automation', 'Smart Automation'), desc: t('bookivo.landing.ai.automationDesc', 'Automate follow-ups, reminders, and status updates effortlessly.') },
  ];

  return (
    <section className="py-20 sm:py-28" aria-labelledby="ai-heading">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 id="ai-heading" className="text-3xl sm:text-4xl font-bold mb-4">
            {t('bookivo.landing.ai.title', 'Not Just Booking — Intelligent Booking.')}
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            {t('bookivo.landing.ai.subtitle', 'AI built into every layer of your booking workflow.')}
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((f, i) => (
            <div key={i} className="p-6 rounded-2xl border border-border bg-card hover:border-primary/40 transition-all group">
              <div className="h-12 w-12 rounded-xl bg-[hsl(160_60%_45%/0.1)] flex items-center justify-center mb-4 group-hover:bg-[hsl(160_60%_45%/0.2)] transition-colors">
                <f.icon className="h-6 w-6 text-[hsl(160_60%_45%)]" />
              </div>
              <h3 className="text-lg font-semibold mb-2">{f.title}</h3>
              <p className="text-sm text-muted-foreground">{f.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
