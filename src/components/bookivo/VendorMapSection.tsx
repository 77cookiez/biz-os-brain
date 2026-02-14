import { useTranslation } from 'react-i18next';

export default function VendorMapSection() {
  const { t } = useTranslation();

  return (
    <section className="py-16 sm:py-20 border-y border-border/50" aria-labelledby="vendormap-heading">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h2 id="vendormap-heading" className="text-3xl sm:text-4xl font-bold mb-3 leading-tight">
            {t('bookivo.landing.vendorMap.title', 'Live Vendor Intelligence Map')}
          </h2>
          <p className="text-muted-foreground max-w-2xl mx-auto leading-relaxed">
            {t('bookivo.landing.vendorMap.desc', 'Visualize vendor availability, demand zones, and booking density in real time.')}
          </p>
        </div>

        {/* Dark-themed map mock */}
        <div className="relative w-full aspect-[16/9] rounded-lg border border-border bg-muted/20 overflow-hidden">
          {/* Grid overlay */}
          <div className="absolute inset-0" style={{
            backgroundImage: 'linear-gradient(hsl(var(--border) / 0.3) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--border) / 0.3) 1px, transparent 1px)',
            backgroundSize: '48px 48px',
          }} />

          {/* Demand zones */}
          <div className="absolute top-[20%] start-[15%] h-20 w-20 rounded-full bg-primary/15 border border-primary/30" />
          <div className="absolute top-[15%] start-[17%] h-2.5 w-2.5 rounded-full bg-primary" />
          <div className="absolute top-[30%] start-[22%] h-2 w-2 rounded-full bg-primary/70" />

          <div className="absolute top-[40%] start-[55%] h-28 w-28 rounded-full bg-primary/10 border border-primary/20" />
          <div className="absolute top-[48%] start-[60%] h-3 w-3 rounded-full bg-primary" />
          <div className="absolute top-[52%] start-[63%] h-2 w-2 rounded-full bg-primary/60" />
          <div className="absolute top-[44%] start-[57%] h-2 w-2 rounded-full bg-primary/80" />

          <div className="absolute bottom-[25%] start-[35%] h-16 w-16 rounded-full bg-accent/15 border border-accent/30" />
          <div className="absolute bottom-[28%] start-[38%] h-2.5 w-2.5 rounded-full bg-accent" />

          {/* Available vendor dots */}
          <div className="absolute top-[60%] start-[80%] h-2 w-2 rounded-full bg-muted-foreground/40" />
          <div className="absolute top-[25%] start-[70%] h-2 w-2 rounded-full bg-muted-foreground/40" />
          <div className="absolute top-[70%] start-[25%] h-2 w-2 rounded-full bg-muted-foreground/40" />
          <div className="absolute top-[35%] start-[42%] h-2 w-2 rounded-full bg-muted-foreground/40" />

          {/* Legend */}
          <div className="absolute bottom-4 start-4 flex items-center gap-5 text-xs text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <div className="h-2.5 w-2.5 rounded-full bg-primary" />
              <span>{t('bookivo.landing.vendorMap.highDemand', 'High Demand')}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="h-2.5 w-2.5 rounded-full bg-accent" />
              <span>{t('bookivo.landing.vendorMap.booked', 'Booked Clusters')}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="h-2.5 w-2.5 rounded-full bg-muted-foreground/40" />
              <span>{t('bookivo.landing.vendorMap.available', 'Available Vendors')}</span>
            </div>
          </div>
        </div>

        <p className="text-center text-sm text-muted-foreground mt-6 italic">
          {t('bookivo.landing.vendorMap.tagline', 'Know where demand is rising before your competitors do.')}
        </p>
      </div>
    </section>
  );
}
