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
    <section className="py-12 border-y border-border/50" aria-labelledby="aibizos-heading">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <h2 id="aibizos-heading" className="text-sm font-medium tracking-wide uppercase text-muted-foreground mb-6">
          {t('bookivo.landing.aibizos.title', 'Powered by AiBizOS')}
        </h2>
        <div className="flex flex-wrap items-center justify-center gap-8">
          {points.map((p, i) => (
            <div key={i} className="flex items-center gap-2 text-xs text-muted-foreground/70">
              <p.icon className="h-3.5 w-3.5" />
              <span>{p.label}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
