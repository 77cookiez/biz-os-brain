import { Outlet, NavLink, Navigate } from "react-router-dom";
import { usePlatformRole, useBootstrapOwner } from "@/hooks/usePlatformAdmin";
import { useAuth } from "@/contexts/AuthContext";
import { Loader2, Shield, LayoutDashboard, Building2, KeyRound, ScrollText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useIsMobile } from "@/hooks/use-mobile";
import { toast } from "sonner";

const navItems = [
  { to: "/owner", icon: LayoutDashboard, label: "Overview", end: true },
  { to: "/owner/workspaces", icon: Building2, label: "Workspaces" },
  { to: "/owner/grants", icon: KeyRound, label: "Grants" },
  { to: "/owner/audit", icon: ScrollText, label: "Audit Log" },
];

export default function OwnerLayout() {
  const { user, loading: authLoading } = useAuth();
  const { data, isLoading, error } = usePlatformRole();
  const bootstrap = useBootstrapOwner();
  const isMobile = useIsMobile();

  if (authLoading || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) return <Navigate to="/auth" replace />;

  const role = data?.role;
  const bootstrapLocked = data?.bootstrap_locked;

  // Not a platform user — check if eligible for bootstrap
  if (!role) {
    if (!bootstrapLocked) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-background p-4">
          <div className="max-w-md w-full space-y-6 text-center">
            <Shield className="h-16 w-16 mx-auto text-primary" />
            <h1 className="text-2xl font-bold text-foreground">Platform Bootstrap</h1>
            <p className="text-muted-foreground">
              You can bootstrap yourself as the platform owner. This is a one-time action.
            </p>
            <Button
              size="lg"
              onClick={() => {
                bootstrap.mutate(undefined, {
                  onSuccess: () => toast.success("You are now the platform owner!"),
                  onError: (e) => toast.error(e.message),
                });
              }}
              disabled={bootstrap.isPending}
            >
              {bootstrap.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Shield className="h-4 w-4 mr-2" />
              )}
              Bootstrap Owner
            </Button>
          </div>
        </div>
      );
    }

    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="max-w-md w-full space-y-4 text-center">
          <Shield className="h-16 w-16 mx-auto text-destructive" />
          <h1 className="text-2xl font-bold text-foreground">Access Denied</h1>
          <p className="text-muted-foreground">
            You don't have platform access. Contact your platform owner.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-background">
      {/* Sidebar */}
      <nav className={`${isMobile ? "flex overflow-x-auto border-b border-border" : "w-56 min-h-screen border-r border-border"} bg-card shrink-0`}>
        <div className={`${isMobile ? "flex gap-1 p-2" : "flex flex-col gap-1 p-3"}`}>
          {!isMobile && (
            <div className="flex items-center gap-2 px-3 py-4 mb-2">
              <Shield className="h-5 w-5 text-primary" />
              <span className="font-semibold text-foreground text-sm">Owner Console</span>
            </div>
          )}
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors ${
                  isActive
                    ? "bg-primary/10 text-primary font-medium"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground"
                }`
              }
            >
              <item.icon className="h-4 w-4 shrink-0" />
              <span className="whitespace-nowrap">{item.label}</span>
            </NavLink>
          ))}
        </div>
      </nav>

      {/* Content */}
      <main className="flex-1 overflow-auto p-4 md:p-6">
        <Outlet />
      </main>
    </div>
  );
}
