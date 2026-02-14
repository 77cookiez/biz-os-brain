import { useTranslation } from 'react-i18next';
import { Store, Users, LayoutDashboard, FileText, Languages, Smartphone, Check } from 'lucide-react';

export default function SolutionSection() {
  const { t } = useTranslation();

  const solutions = [
    { icon: Store, label: t('bookivo.landing.solution.storefront', 'Hosted Storefront (V1 & Premium V3)') },
    { icon: Users, label: t('bookivo.landing.solution.vendorPortal', 'Vendor Portal') },
    { icon: LayoutDashboard, label: t('bookivo.landing.solution.adminDash', 'Admin Dashboard') },
    { icon: FileText, label: t('bookivo.landing.solution.quotes', 'Quote Request Management') },
    { icon: Languages, label: t('bookivo.landing.solution.multiLang', 'Multi-language Support') },
    { icon: Smartphone, label: t('bookivo.landing.solution.pwa', 'PWA & Native App Support') },
  ];

  return (
    <section className="py-20 sm:py-28 bg-card/30 border-y border-border" aria-labelledby="solution-heading">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          <div>
            <h2 id="solution-heading" className="text-3xl sm:text-4xl font-bold mb-6">
              {t('bookivo.landing.solution.title', 'Meet Bookivo. Your Complete Booking OS.')}
            </h2>
            <p className="text-lg text-muted-foreground mb-8">
              {t('bookivo.landing.solution.subtitle', 'Everything you need to launch, manage, and grow your booking business — in one platform.')}
            </p>
            <ul className="space-y-4">
              {solutions.map((s, i) => (
                <li key={i} className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <s.icon className="h-5 w-5 text-primary" />
                  </div>
                  <span className="text-foreground">{s.label}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Mockup illustration */}
          <div className="flex justify-center">
            <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 space-y-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="h-3 w-3 rounded-full bg-destructive/60" />
                <div className="h-3 w-3 rounded-full bg-[hsl(40_90%_50%/0.6)]" />
                <div className="h-3 w-3 rounded-full bg-[hsl(140_60%_45%/0.6)]" />
              </div>
              <div className="h-4 w-32 rounded bg-primary/20" />
              <div className="grid grid-cols-3 gap-3">
                {[1, 2, 3].map(i => (
                  <div key={i} className="aspect-[4/3] rounded-lg bg-muted flex items-center justify-center">
                    <Check className="h-5 w-5 text-primary/40" />
                  </div>
                ))}
              </div>
              <div className="space-y-2">
                <div className="h-3 w-full rounded bg-muted" />
                <div className="h-3 w-3/4 rounded bg-muted" />
                <div className="h-3 w-1/2 rounded bg-muted" />
              </div>
              <div className="h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <span className="text-xs text-primary font-medium">{t('bookivo.landing.solution.livePreview', 'Live Preview')}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
