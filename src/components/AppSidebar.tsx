import { Brain, LayoutGrid, Settings, Store, FileText, Users, Package, BarChart3, Mail, ShoppingCart, ChevronLeft, ChevronRight, Target, CheckSquare, Calendar, Sparkles } from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { useTranslation } from "react-i18next";

import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

interface AppItem {
  title: string;
  icon: React.ElementType;
  url: string;
  active: boolean;
  isBrain?: boolean;
}

interface AppRegistryItem {
  id: string;
  name: string;
  icon: string;
  status: string;
}

const iconMap: Record<string, React.ElementType> = {
  Brain,
  FileText,
  Users,
  BarChart3,
  Package,
  ShoppingCart,
  Mail,
};

export function AppSidebar() {
  const { t } = useTranslation();
  const [collapsed, setCollapsed] = useState(false);
  const [apps, setApps] = useState<AppRegistryItem[]>([]);
  const { installedApps } = useWorkspace();

  useEffect(() => {
    fetchApps();
  }, []);

  const fetchApps = async () => {
    const { data } = await supabase
      .from('app_registry')
      .select('id, name, icon, status')
      .neq('id', 'brain')
      .order('name');
    setApps(data || []);
  };

  const isAppActive = (appId: string) => {
    return installedApps.some(a => a.app_id === appId && a.is_active);
  };

  const brainLinks = [
    { title: t('navigation.today'), icon: Sparkles, url: "/" },
    { title: t('navigation.goalsPlans'), icon: Target, url: "/brain/goals" },
    { title: t('navigation.teamTasks'), icon: CheckSquare, url: "/brain/tasks" },
    { title: t('navigation.weeklyCheckin'), icon: Calendar, url: "/brain/checkin" },
  ];

  return (
    <aside
      className={`flex flex-col border-r border-border bg-sidebar transition-all duration-200 ${
        collapsed ? "w-16" : "w-60"
      }`}
    >
      {/* Logo */}
      <div className="flex h-14 items-center gap-2 px-4 border-b border-border">
        {!collapsed && (
          <span className="text-sm font-bold text-foreground tracking-tight">
            Ai<span className="text-primary">Bizos</span>
          </span>
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
            {t('navigation.aiBrain')}
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

      {/* Installed Apps */}
      <div className="px-3 pt-3 pb-2 flex-1 overflow-auto">
        {!collapsed && (
          <span className="text-[10px] uppercase tracking-widest text-muted-foreground px-2">
            {t('navigation.apps')}
          </span>
        )}
        <nav className="mt-2 flex flex-col gap-1">
          {apps.map((app) => {
            const Icon = iconMap[app.icon] || LayoutGrid;
            const active = isAppActive(app.id);
            const available = app.status === 'available' || app.status === 'active';

            return (
              <NavLink
                key={app.id}
                to={active ? `/apps/${app.id}` : "/marketplace"}
                className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-all ${
                  active
                    ? "text-secondary-foreground hover:bg-secondary"
                    : "text-muted-foreground/50 hover:text-muted-foreground hover:bg-secondary/50"
                }`}
                activeClassName={active ? "bg-secondary text-foreground" : ""}
              >
                <Icon className="h-4 w-4 shrink-0" />
                {!collapsed && (
                  <>
                    <span>{app.name}</span>
                    {!active && available && (
                      <span className="ml-auto text-[10px] rounded-full bg-muted px-2 py-0.5 text-muted-foreground">
                        off
                      </span>
                    )}
                    {app.status === 'coming_soon' && (
                      <span className="ml-auto text-[10px] rounded-full bg-muted px-2 py-0.5 text-muted-foreground">
                        soon
                      </span>
                    )}
                  </>
                )}
              </NavLink>
            );
          })}
        </nav>
      </div>

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
