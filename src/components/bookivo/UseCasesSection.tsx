import { useTranslation } from 'react-i18next';
import { CalendarDays, UtensilsCrossed, Briefcase, Landmark } from 'lucide-react';

export default function UseCasesSection() {
  const { t } = useTranslation();

  const cases = [
    { icon: CalendarDays, title: t('bookivo.landing.useCases.events', 'Event Organizers'), desc: t('bookivo.landing.useCases.eventsDesc', 'Manage vendors, venues, and bookings for any event.') },
    { icon: UtensilsCrossed, title: t('bookivo.landing.useCases.food', 'Food Trucks & Catering'), desc: t('bookivo.landing.useCases.foodDesc', 'Accept orders, schedule slots, and track revenue.') },
    { icon: Briefcase, title: t('bookivo.landing.useCases.services', 'Service Vendors'), desc: t('bookivo.landing.useCases.servicesDesc', 'Professional booking pages for any service business.') },
    { icon: Landmark, title: t('bookivo.landing.useCases.venues', 'Venue Managers'), desc: t('bookivo.landing.useCases.venuesDesc', 'Coordinate bookings, availability, and vendor partnerships.') },
  ];

  return (
    <section className="py-20 sm:py-28" aria-labelledby="usecases-heading">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 id="usecases-heading" className="text-3xl sm:text-4xl font-bold mb-4">
            {t('bookivo.landing.useCases.title', 'Who It\'s For')}
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            {t('bookivo.landing.useCases.subtitle', 'Bookivo adapts to your industry and workflow.')}
          </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {cases.map((c, i) => (
            <div key={i} className="p-6 rounded-2xl border border-border bg-card hover:border-primary/40 transition-all text-center group">
              <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center mb-4 mx-auto group-hover:bg-primary/20 transition-colors">
                <c.icon className="h-7 w-7 text-primary" />
              </div>
              <h3 className="text-lg font-semibold mb-2">{c.title}</h3>
              <p className="text-sm text-muted-foreground">{c.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
