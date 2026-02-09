import { Outlet, NavLink } from 'react-router-dom';
import { CalendarDays, CheckSquare, Inbox, Target, Calendar, Lightbulb } from 'lucide-react';
import { cn } from '@/lib/utils';

const tabs = [
  { label: 'Today', icon: CheckSquare, path: '/apps/workboard' },
  { label: 'This Week', icon: CalendarDays, path: '/apps/workboard/week' },
  { label: 'Backlog', icon: Inbox, path: '/apps/workboard/backlog' },
  { label: 'Goals', icon: Target, path: '/apps/workboard/goals' },
  { label: 'Calendar', icon: Calendar, path: '/apps/workboard/calendar' },
  { label: 'Brainstorm', icon: Lightbulb, path: '/apps/workboard/brainstorm' },
];

export default function WorkboardLayout() {
  return (
    <div className="flex flex-col h-full">
      <nav className="border-b border-border bg-card px-4">
        <div className="flex items-center gap-1 overflow-x-auto">
          {tabs.map(tab => (
            <NavLink
              key={tab.path}
              to={tab.path}
              end={tab.path === '/apps/workboard'}
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
              {tab.label}
            </NavLink>
          ))}
        </div>
      </nav>
      <div className="flex-1 overflow-auto p-6">
        <Outlet />
      </div>
    </div>
  );
}
