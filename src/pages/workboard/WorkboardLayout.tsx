import { Outlet, NavLink } from 'react-router-dom';
import { CalendarDays, CheckSquare, Inbox, Target, Calendar, Lightbulb, Users, ClipboardCheck } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTranslation } from 'react-i18next';

export default function WorkboardLayout() {
  const { t } = useTranslation();

  const tabs = [
    { labelKey: 'workboard.tabs.today', icon: CheckSquare, path: '/apps/workboard' },
    { labelKey: 'workboard.tabs.thisWeek', icon: CalendarDays, path: '/apps/workboard/week' },
    { labelKey: 'workboard.tabs.backlog', icon: Inbox, path: '/apps/workboard/backlog' },
    { labelKey: 'workboard.tabs.goals', icon: Target, path: '/apps/workboard/goals' },
    { labelKey: 'workboard.tabs.teamTasks', icon: Users, path: '/apps/workboard/tasks' },
    { labelKey: 'workboard.tabs.calendar', icon: Calendar, path: '/apps/workboard/calendar' },
    { labelKey: 'workboard.tabs.checkin', icon: ClipboardCheck, path: '/apps/workboard/checkin' },
    { labelKey: 'workboard.tabs.brainstorm', icon: Lightbulb, path: '/apps/workboard/brainstorm' },
  ];

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
              {t(tab.labelKey)}
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
