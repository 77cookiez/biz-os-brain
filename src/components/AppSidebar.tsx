import { Brain, LayoutGrid, Settings, Store, FileText, Users, Package, BarChart3, Mail, ShoppingCart, ChevronLeft, ChevronRight } from "lucide-react";
import { NavLink } from "@/components/NavLink";
import logoIcon from "@/assets/logo-icon.png";
import { useState } from "react";

interface AppItem {
  title: string;
  icon: React.ElementType;
  url: string;
  active: boolean;
  isBrain?: boolean;
}

const apps: AppItem[] = [
  { title: "AI Brain", icon: Brain, url: "/", active: true, isBrain: true },
  { title: "Docs", icon: FileText, url: "/apps/docs", active: true },
  { title: "CRM", icon: Users, url: "/apps/crm", active: false },
  { title: "Accounting", icon: BarChart3, url: "/apps/accounting", active: false },
  { title: "Inventory", icon: Package, url: "/apps/inventory", active: false },
  { title: "E-commerce", icon: ShoppingCart, url: "/apps/ecommerce", active: false },
  { title: "Marketing", icon: Mail, url: "/apps/marketing", active: false },
];

export function AppSidebar() {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside
      className={`flex flex-col border-r border-border bg-sidebar transition-all duration-200 ${
        collapsed ? "w-16" : "w-60"
      }`}
    >
      {/* Logo */}
      <div className="flex h-14 items-center gap-2 px-4 border-b border-border">
        <img src={logoIcon} alt="AiBizos" className="h-8 w-8 rounded-lg" />
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
            Assistant
          </span>
        )}
        <div className="mt-2">
          <NavLink
            to="/"
            end
            className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-primary transition-all hover:bg-brain-soft brain-glow"
            activeClassName="bg-primary/10 text-primary"
          >
            <Brain className="h-5 w-5 shrink-0" />
            {!collapsed && <span>AI Brain</span>}
          </NavLink>
        </div>
      </div>

      {/* Installed Apps */}
      <div className="px-3 pt-3 pb-2 flex-1">
        {!collapsed && (
          <span className="text-[10px] uppercase tracking-widest text-muted-foreground px-2">
            Apps
          </span>
        )}
        <nav className="mt-2 flex flex-col gap-1">
          {apps.filter(a => !a.isBrain).map((app) => (
            <NavLink
              key={app.title}
              to={app.active ? app.url : "#"}
              className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-all ${
                app.active
                  ? "text-secondary-foreground hover:bg-secondary"
                  : "text-muted-foreground/50 cursor-not-allowed"
              }`}
              activeClassName={app.active ? "bg-secondary text-foreground" : ""}
            >
              <app.icon className="h-4 w-4 shrink-0" />
              {!collapsed && (
                <>
                  <span>{app.title}</span>
                  {!app.active && (
                    <span className="ml-auto text-[10px] rounded-full bg-muted px-2 py-0.5 text-muted-foreground">
                      off
                    </span>
                  )}
                </>
              )}
            </NavLink>
          ))}
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
          {!collapsed && <span>Marketplace</span>}
        </NavLink>
        <NavLink
          to="/settings"
          className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-muted-foreground hover:bg-secondary hover:text-foreground transition-all"
          activeClassName="bg-secondary text-foreground"
        >
          <Settings className="h-4 w-4 shrink-0" />
          {!collapsed && <span>Settings</span>}
        </NavLink>
      </div>
    </aside>
  );
}
