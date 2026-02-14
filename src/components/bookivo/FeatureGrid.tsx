import { useTranslation } from 'react-i18next';
import { Globe, Languages, Banknote, Bot, Building2, Shield, Calendar, Lock } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

export default function FeatureGrid() {
  const { t } = useTranslation();

  const features = [
    { icon: Globe, title: t('bookivo.landing.features.global', 'Global-ready Architecture'), desc: t('bookivo.landing.features.globalDesc', 'Built to work anywhere in the world.') },
    { icon: Languages, title: t('bookivo.landing.features.lang', 'Multi-language by Design'), desc: t('bookivo.landing.features.langDesc', 'Speak your customers\' language automatically.') },
    { icon: Banknote, title: t('bookivo.landing.features.currency', 'Multi-currency Support'), desc: t('bookivo.landing.features.currencyDesc', 'Accept payments in USD, EUR, GBP, AED, and more.') },
    { icon: Bot, title: t('bookivo.landing.features.aiWorkflows', 'AI-driven Workflows'), desc: t('bookivo.landing.features.aiWorkflowsDesc', 'Automate scheduling, quotes, and communication.') },
    { icon: Building2, title: t('bookivo.landing.features.whiteLabel', 'White-label Capability'), desc: t('bookivo.landing.features.whiteLabelDesc', 'Your brand, your domain, your rules.') },
    { icon: Shield, title: t('bookivo.landing.features.secure', 'Secure Multi-tenant'), desc: t('bookivo.landing.features.secureDesc', 'Enterprise-grade data isolation and access controls.') },
    { icon: Calendar, title: t('bookivo.landing.features.trial', '14-day Free Trial'), desc: t('bookivo.landing.features.trialDesc', 'Full-featured trial. No credit card required.') },
    { icon: Lock, title: t('bookivo.landing.features.privacy', 'Privacy-first'), desc: t('bookivo.landing.features.privacyDesc', 'Your data belongs to you. Always.') },
  ];

  return (
    <section id="features" className="py-20 sm:py-28 bg-card/30 border-y border-border" aria-labelledby="features-heading">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 id="features-heading" className="text-3xl sm:text-4xl font-bold mb-4">
            {t('bookivo.landing.features.title', 'Everything You Need')}
          </h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {features.map((f, i) => (
            <Card key={i} className="border-border hover:border-primary/30 transition-all group">
              <CardContent className="p-6">
                <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4 group-hover:bg-primary/20 transition-colors">
                  <f.icon className="h-6 w-6 text-primary" />
                </div>
                <h3 className="text-lg font-semibold mb-2">{f.title}</h3>
                <p className="text-sm text-muted-foreground">{f.desc}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}
