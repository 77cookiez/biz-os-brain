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
    <section className="py-24 sm:py-32" aria-labelledby="ai-heading">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 id="ai-heading" className="text-3xl sm:text-4xl font-bold mb-4">
            {t('bookivo.landing.ai.title', 'Not Just Booking — Intelligent Booking.')}
          </h2>
          <p className="text-muted-foreground max-w-xl mx-auto">
            {t('bookivo.landing.ai.subtitle', 'AI built into every layer of your booking workflow.')}
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {features.map((f, i) => (
            <div key={i} className="p-5 rounded-lg border border-border hover:border-primary/30 transition-colors">
              <div className="flex items-center gap-3 mb-3">
                <f.icon className="h-4 w-4 text-muted-foreground" />
                <h3 className="font-medium">{f.title}</h3>
              </div>
              <p className="text-sm text-muted-foreground">{f.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
