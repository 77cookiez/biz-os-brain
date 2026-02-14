import { useTranslation } from 'react-i18next';
import { ArrowRight } from 'lucide-react';

export default function HowItWorks() {
  const { t } = useTranslation();

  const steps = [
    { num: '01', title: t('bookivo.landing.howItWorks.step1', 'Set Up'), desc: t('bookivo.landing.howItWorks.step1Desc', 'Choose your theme, upload your logo, and configure your brand in minutes.') },
    { num: '02', title: t('bookivo.landing.howItWorks.step2', 'Customize'), desc: t('bookivo.landing.howItWorks.step2Desc', 'Set pricing, policies, currencies, and invite your vendors.') },
    { num: '03', title: t('bookivo.landing.howItWorks.step3', 'Launch'), desc: t('bookivo.landing.howItWorks.step3Desc', 'Go live with one click. Share your booking link or download your app pack.') },
  ];

  return (
    <section className="py-20 sm:py-28" aria-labelledby="howitworks-heading">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 id="howitworks-heading" className="text-3xl sm:text-4xl font-bold mb-4">
            {t('bookivo.landing.howItWorks.title', 'Go Live in 3 Simple Steps')}
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            {t('bookivo.landing.howItWorks.subtitle', 'From setup to launch in under 10 minutes.')}
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {steps.map((step, idx) => (
            <div key={idx} className="relative group">
              <div className="p-8 rounded-2xl border border-border bg-card hover:border-primary/50 transition-all">
                <div className="text-5xl font-bold text-primary/20 mb-4">{step.num}</div>
                <h3 className="text-xl font-semibold mb-2">{step.title}</h3>
                <p className="text-muted-foreground">{step.desc}</p>
              </div>
              {idx < 2 && (
                <div className="hidden md:block absolute top-1/2 -end-4 text-muted-foreground/30">
                  <ArrowRight className="h-6 w-6" />
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
