import { Outlet, NavLink } from 'react-router-dom';
import { LayoutDashboard, Store, Package, Calendar, MessageSquare, BookOpen, Settings } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTranslation } from 'react-i18next';

export default function BookingLayout() {
  const { t } = useTranslation();

  const tabs = [
    { labelKey: 'booking.tabs.dashboard', icon: LayoutDashboard, path: '/apps/booking' },
    { labelKey: 'booking.tabs.vendors', icon: Store, path: '/apps/booking/vendors' },
    { labelKey: 'booking.tabs.services', icon: Package, path: '/apps/booking/services' },
    { labelKey: 'booking.tabs.calendar', icon: Calendar, path: '/apps/booking/calendar' },
    { labelKey: 'booking.tabs.quotes', icon: MessageSquare, path: '/apps/booking/quotes' },
    { labelKey: 'booking.tabs.bookings', icon: BookOpen, path: '/apps/booking/bookings' },
    { labelKey: 'booking.tabs.settings', icon: Settings, path: '/apps/booking/settings' },
  ];

  return (
    <div className="flex flex-col h-full">
      <nav className="border-b border-border bg-card px-4">
        <div className="flex items-center gap-1 overflow-x-auto scrollbar-hide">
          {tabs.map(tab => (
            <NavLink
              key={tab.path}
              to={tab.path}
              end={tab.path === '/apps/booking'}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-2 px-3 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap',
                  isActive
                    ? 'border-primary text-primary'
                    : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'
                )
              }
            >
              <tab.icon className="h-4 w-4" />
              <span className="hidden sm:inline">{t(tab.labelKey)}</span>
            </NavLink>
          ))}
        </div>
      </nav>
      <div className="flex-1 overflow-auto p-4 md:p-6">
        <Outlet />
      </div>
    </div>
  );
}
