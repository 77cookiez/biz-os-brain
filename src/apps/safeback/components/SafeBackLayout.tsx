import { Outlet, NavLink } from 'react-router-dom';
import { LayoutDashboard, Database, Clock, Download, Shield, FileText, Settings } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTranslation } from 'react-i18next';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import safebackIcon from '@/assets/safeback-icon.png';

const iconMap = { LayoutDashboard, Database, Clock, Download, Shield, FileText, Settings };

const tabs = [
  { labelKey: 'apps.safeback.tabs.overview', icon: LayoutDashboard, path: '/apps/safeback' },
  { labelKey: 'apps.safeback.tabs.snapshots', icon: Database, path: '/apps/safeback/snapshots' },
  { labelKey: 'apps.safeback.tabs.schedules', icon: Clock, path: '/apps/safeback/schedules' },
  { labelKey: 'apps.safeback.tabs.exports', icon: Download, path: '/apps/safeback/exports' },
  { labelKey: 'apps.safeback.tabs.policies', icon: Shield, path: '/apps/safeback/policies' },
  { labelKey: 'apps.safeback.tabs.audit', icon: FileText, path: '/apps/safeback/audit' },
  { labelKey: 'apps.safeback.tabs.settings', icon: Settings, path: '/apps/safeback/settings' },
];

export default function SafeBackLayout() {
  const { t } = useTranslation();

  return (
    <div className="safeback-app flex flex-col h-full" style={{ '--safeback-primary': '#3B82F6', '--safeback-accent': '#10B981' } as React.CSSProperties}>
      <div className="flex items-center gap-3 px-4 pt-4 pb-2">
        <img src={safebackIcon} alt="SafeBack" className="h-8 w-8 rounded-lg" />
        <div>
          <h1 className="text-lg font-semibold text-foreground">{t('apps.safeback.title', 'SafeBack')}</h1>
          <p className="text-xs text-muted-foreground">{t('apps.safeback.subtitle', 'Workspace snapshots, scheduled backups & safe restore')}</p>
        </div>
      </div>
      <nav className="border-b border-border bg-card px-4">
        <div className="flex items-center gap-1 overflow-x-auto scrollbar-hide">
          {tabs.map(tab => (
            <NavLink
              key={tab.path}
              to={tab.path}
              end={tab.path === '/apps/safeback'}
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
        <ErrorBoundary>
          <Outlet />
        </ErrorBoundary>
      </div>
    </div>
  );
}
