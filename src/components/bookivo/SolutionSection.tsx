import { useTranslation } from 'react-i18next';
import { Check } from 'lucide-react';

export default function SolutionSection() {
  const { t } = useTranslation();

  const solutions = [
    t('bookivo.landing.solution.storefront', 'Hosted Storefront (V1 & Premium V3)'),
    t('bookivo.landing.solution.vendorPortal', 'Vendor Portal'),
    t('bookivo.landing.solution.adminDash', 'Admin Dashboard'),
    t('bookivo.landing.solution.quotes', 'Quote Request Management'),
    t('bookivo.landing.solution.multiLang', 'Multi-language Support'),
    t('bookivo.landing.solution.pwa', 'PWA & Native App Support'),
  ];

  return (
    <section className="py-16 sm:py-20 border-y border-border/50" aria-labelledby="solution-heading">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          <div>
            <h2 id="solution-heading" className="text-3xl sm:text-4xl font-bold mb-6 leading-tight">
              {t('bookivo.landing.solution.title', 'Meet Bookivo. Your Complete Booking OS.')}
            </h2>
            <p className="text-muted-foreground mb-8 leading-relaxed">
              {t('bookivo.landing.solution.subtitle', 'Everything you need to launch, manage, and grow your booking business — in one platform.')}
            </p>
            <ul className="space-y-3">
              {solutions.map((s, i) => (
                <li key={i} className="flex items-center gap-3 text-sm">
                  <Check className="h-5 w-5 text-primary shrink-0" />
                  <span className="text-foreground">{s}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="flex justify-center">
            <div className="w-full max-w-sm rounded-xl border border-border p-6 space-y-4">
              <div className="h-3 w-24 rounded bg-muted" />
              <div className="grid grid-cols-3 gap-2">
                {[1, 2, 3].map(i => (
                  <div key={i} className="aspect-[4/3] rounded bg-muted" />
                ))}
              </div>
              <div className="space-y-2">
                <div className="h-2.5 w-full rounded bg-muted" />
                <div className="h-2.5 w-3/4 rounded bg-muted" />
                <div className="h-2.5 w-1/2 rounded bg-muted" />
              </div>
              <div className="h-9 rounded bg-primary/10 flex items-center justify-center">
                <span className="text-xs text-primary font-medium">{t('bookivo.landing.solution.livePreview', 'Live Preview')}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
