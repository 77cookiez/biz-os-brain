import { usePlatformRole } from "@/hooks/usePlatformAdmin";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Shield, Lock, Unlock, ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";

export default function OwnerOverview() {
  const { data } = usePlatformRole();

  const links = [
    { to: "/owner/workspaces", label: "Manage Workspaces", desc: "Search, inspect, and grant access" },
    { to: "/owner/grants", label: "Active Grants", desc: "View and revoke access overrides" },
    { to: "/owner/audit", label: "Audit Log", desc: "View all privileged actions" },
  ];

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center gap-3">
        <Shield className="h-7 w-7 text-primary" />
        <div>
          <h1 className="text-2xl font-bold text-foreground">Owner Console</h1>
          <p className="text-sm text-muted-foreground">Platform governance & access management</p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Your Role</CardTitle>
          </CardHeader>
          <CardContent>
            <Badge variant="default" className="text-sm capitalize">
              {data?.role || "—"}
            </Badge>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Bootstrap Status</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center gap-2">
            {data?.bootstrap_locked ? (
              <>
                <Lock className="h-4 w-4 text-primary" />
                <span className="text-sm text-foreground font-medium">Locked</span>
              </>
            ) : (
              <>
                <Unlock className="h-4 w-4 text-destructive" />
                <span className="text-sm text-foreground font-medium">Unlocked</span>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-3">
        {links.map((link) => (
          <Link key={link.to} to={link.to}>
            <Card className="hover:bg-accent/50 transition-colors cursor-pointer">
              <CardContent className="flex items-center justify-between py-4">
                <div>
                  <p className="font-medium text-foreground">{link.label}</p>
                  <p className="text-sm text-muted-foreground">{link.desc}</p>
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
