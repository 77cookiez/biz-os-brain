import { useTranslation } from 'react-i18next';
import { Blocks, Rocket, ShieldCheck, Cpu, Building2 } from 'lucide-react';

export default function AiBizOSSection() {
  const { t } = useTranslation();

  const points = [
    { icon: Blocks, label: t('bookivo.landing.aibizos.modular', 'Modular Architecture') },
    { icon: Rocket, label: t('bookivo.landing.aibizos.future', 'Future-ready Ecosystem') },
    { icon: ShieldCheck, label: t('bookivo.landing.aibizos.security', 'Shared Identity & Security') },
    { icon: Cpu, label: t('bookivo.landing.aibizos.ai', 'Upgradeable AI Layer') },
    { icon: Building2, label: t('bookivo.landing.aibizos.enterprise', 'Enterprise Scalability') },
  ];

  return (
    <section className="py-16 border-y border-border bg-card/20" aria-labelledby="aibizos-heading">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <h2 id="aibizos-heading" className="text-2xl font-semibold mb-3 text-muted-foreground">
          {t('bookivo.landing.aibizos.title', 'Powered by AiBizOS')}
        </h2>
        <p className="text-sm text-muted-foreground mb-8 max-w-xl mx-auto">
          {t('bookivo.landing.aibizos.subtitle', 'Built on a modular business operating system designed for scale.')}
        </p>
        <div className="flex flex-wrap items-center justify-center gap-6">
          {points.map((p, i) => (
            <div key={i} className="flex items-center gap-2 text-sm text-muted-foreground">
              <p.icon className="h-4 w-4 text-muted-foreground/60" />
              <span>{p.label}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
