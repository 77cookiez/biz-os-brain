import { useTranslation } from 'react-i18next';
import { Globe, Languages, Banknote, Bot, Building2, Shield, Calendar, Lock } from 'lucide-react';

export default function FeatureGrid() {
  const { t } = useTranslation();

  const features = [
    { icon: Globe, title: t('bookivo.landing.features.global', 'Global-ready'), desc: t('bookivo.landing.features.globalDesc', 'Built to work anywhere in the world.') },
    { icon: Languages, title: t('bookivo.landing.features.lang', 'Multi-language'), desc: t('bookivo.landing.features.langDesc', 'Speak your customers\' language automatically.') },
    { icon: Banknote, title: t('bookivo.landing.features.currency', 'Multi-currency'), desc: t('bookivo.landing.features.currencyDesc', 'Accept payments in USD, EUR, GBP, AED, and more.') },
    { icon: Bot, title: t('bookivo.landing.features.aiWorkflows', 'AI Workflows'), desc: t('bookivo.landing.features.aiWorkflowsDesc', 'Automate scheduling, quotes, and communication.') },
    { icon: Building2, title: t('bookivo.landing.features.whiteLabel', 'White-label'), desc: t('bookivo.landing.features.whiteLabelDesc', 'Your brand, your domain, your rules.') },
    { icon: Shield, title: t('bookivo.landing.features.secure', 'Secure Multi-tenant'), desc: t('bookivo.landing.features.secureDesc', 'Enterprise-grade data isolation.') },
    { icon: Calendar, title: t('bookivo.landing.features.trial', 'Free Trial'), desc: t('bookivo.landing.features.trialDesc', 'Full-featured 14-day trial. No credit card.') },
    { icon: Lock, title: t('bookivo.landing.features.privacy', 'Privacy-first'), desc: t('bookivo.landing.features.privacyDesc', 'Your data belongs to you. Always.') },
  ];

  return (
    <section id="features" className="py-16 sm:py-20 border-y border-border/50" aria-labelledby="features-heading">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h2 id="features-heading" className="text-3xl sm:text-4xl font-bold mb-4 leading-tight">
            {t('bookivo.landing.features.title', 'Everything You Need')}
          </h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {features.map((f, i) => (
            <div key={i} className="p-5 rounded-lg border border-border hover:border-muted-foreground/30 transition-colors">
              <f.icon className="h-9 w-9 text-muted-foreground mb-3" strokeWidth={1.5} />
              <h3 className="text-sm font-semibold mb-1">{f.title}</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
