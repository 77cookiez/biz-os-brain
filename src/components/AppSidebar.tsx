import { LayoutGrid, Settings, Store, ChevronLeft, ChevronRight, Sparkles, Brain } from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { useTranslation } from "react-i18next";
import logoPrimary from "@/assets/logo-primary.png";
import logoLight from "@/assets/logo-light.png";
import { useTheme } from "@/contexts/ThemeContext";
import { isSystemApp } from "@/lib/systemApps";

import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

const iconMap: Record<string, React.ElementType> = {};

export function AppSidebar() {
  const { t } = useTranslation();
  const { resolvedTheme } = useTheme();
  const [collapsed, setCollapsed] = useState(false);
  const { installedApps } = useWorkspace();
  const [appNames, setAppNames] = useState<Record<string, { name: string; icon: string }>>({});

  // Fetch app registry names for installed active apps
  useEffect(() => {
    const activeIds = installedApps.filter(a => a.is_active).map(a => a.app_id);
    if (activeIds.length === 0) {
      setAppNames({});
      return;
    }
    supabase
      .from('app_registry')
      .select('id, name, icon')
      .in('id', activeIds)
      .then(({ data }) => {
        const map: Record<string, { name: string; icon: string }> = {};
        data?.forEach(a => { map[a.id] = { name: a.name, icon: a.icon || '' }; });
        setAppNames(map);
      });
  }, [installedApps]);

  const activeApps = installedApps.filter(a => a.is_active && !isSystemApp(a.app_id));

  const brainLinks = [
    { title: t('navigation.today'), icon: Sparkles, url: "/" },
    { title: t('navigation.brain'), icon: Brain, url: "/brain" },
  ];

  return (
    <aside
      className={`flex flex-col border-r border-border bg-sidebar transition-all duration-200 ${
        collapsed ? "w-16" : "w-60"
      }`}
    >
      {/* Logo */}
      <div className="flex h-14 items-center gap-2 px-3 border-b border-border overflow-hidden">
        {!collapsed && (
          <img src={resolvedTheme === 'dark' ? logoLight : logoPrimary} alt="AiBizos" className="h-7 max-w-[130px] object-contain object-left shrink-0" />
        )}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="ml-auto text-muted-foreground hover:text-foreground transition-colors"
        >
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </button>
      </div>

      {/* Brain - Primary */}
      <div className="px-3 pt-4 pb-2">
        {!collapsed && (
          <span className="text-[10px] uppercase tracking-widest text-muted-foreground px-2">
            {t('navigation.businessBrain')}
          </span>
        )}
        <nav className="mt-2 flex flex-col gap-1">
          {brainLinks.map((link) => (
            <NavLink
              key={link.url}
              to={link.url}
              end={link.url === "/"}
              className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-sidebar-foreground transition-all hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              activeClassName="bg-primary/10 text-primary"
            >
              <link.icon className="h-4 w-4 shrink-0" />
              {!collapsed && <span>{link.title}</span>}
            </NavLink>
          ))}
        </nav>
      </div>

      {/* Installed Active Apps Only */}
      {activeApps.length > 0 && (
        <div className="px-3 pt-3 pb-2 flex-1 overflow-auto">
          {!collapsed && (
            <span className="text-[10px] uppercase tracking-widest text-muted-foreground px-2">
              {t('navigation.apps')}
            </span>
          )}
          <nav className="mt-2 flex flex-col gap-1">
            {activeApps.map((app) => {
              const info = appNames[app.app_id];
              const Icon = LayoutGrid;
              return (
                <NavLink
                  key={app.app_id}
                  to={`/apps/${app.app_id}`}
                  className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-secondary-foreground hover:bg-secondary transition-all"
                  activeClassName="bg-secondary text-foreground"
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  {!collapsed && <span>{info?.name || app.app_id}</span>}
                </NavLink>
              );
            })}
          </nav>
        </div>
      )}

      {/* Spacer when no apps */}
      {activeApps.length === 0 && <div className="flex-1" />}

      {/* Bottom */}
      <div className="px-3 pb-4 flex flex-col gap-1 border-t border-border pt-3">
        <NavLink
          to="/marketplace"
          className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-muted-foreground hover:bg-secondary hover:text-foreground transition-all"
          activeClassName="bg-secondary text-foreground"
        >
          <Store className="h-4 w-4 shrink-0" />
          {!collapsed && <span>{t('navigation.marketplace')}</span>}
        </NavLink>
        <NavLink
          to="/settings"
          className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-muted-foreground hover:bg-secondary hover:text-foreground transition-all"
          activeClassName="bg-secondary text-foreground"
        >
          <Settings className="h-4 w-4 shrink-0" />
          {!collapsed && <span>{t('navigation.settings')}</span>}
        </NavLink>
      </div>
    </aside>
  );
}
