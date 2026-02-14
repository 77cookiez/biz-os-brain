import { useTranslation } from 'react-i18next';
import { MessageSquare, Users, BarChart3, Globe } from 'lucide-react';

const PAIN_ICONS = [MessageSquare, Users, BarChart3, Globe];

export default function ProblemSection() {
  const { t } = useTranslation();

  const pains = [
    { icon: PAIN_ICONS[0], title: t('bookivo.landing.problem.pain1', 'Manual WhatsApp Bookings'), desc: t('bookivo.landing.problem.pain1Desc', 'Scattered conversations, lost requests, and no tracking.') },
    { icon: PAIN_ICONS[1], title: t('bookivo.landing.problem.pain2', 'No Vendor Management'), desc: t('bookivo.landing.problem.pain2Desc', 'No structured way to onboard, track, or manage vendors.') },
    { icon: PAIN_ICONS[2], title: t('bookivo.landing.problem.pain3', 'Zero Analytics'), desc: t('bookivo.landing.problem.pain3Desc', 'No insight into revenue, conversion rates, or customer behavior.') },
    { icon: PAIN_ICONS[3], title: t('bookivo.landing.problem.pain4', 'No Online Presence'), desc: t('bookivo.landing.problem.pain4Desc', 'No professional booking page or storefront for your business.') },
  ];

  return (
    <section className="py-24 sm:py-32" aria-labelledby="problem-heading">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 id="problem-heading" className="text-3xl sm:text-4xl font-bold mb-4">
            {t('bookivo.landing.problem.title', 'Still Managing Bookings the Old Way?')}
          </h2>
          <p className="text-muted-foreground max-w-xl mx-auto">
            {t('bookivo.landing.problem.subtitle', 'These pain points cost you time, money, and customers every day.')}
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {pains.map((p, i) => (
            <div key={i} className="flex items-start gap-4 p-5 rounded-lg border border-border hover:border-muted-foreground/30 transition-colors">
              <p.icon className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
              <div>
                <h3 className="font-medium mb-1">{p.title}</h3>
                <p className="text-sm text-muted-foreground">{p.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
