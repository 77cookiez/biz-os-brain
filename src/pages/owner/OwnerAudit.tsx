import { useState } from "react";
import { usePlatformAudit } from "@/hooks/usePlatformAdmin";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2 } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const ACTION_TYPES = [
  { value: "all", label: "All Actions" },
  { value: "bootstrap_owner", label: "Bootstrap" },
  { value: "grant_created", label: "Grant Created" },
  { value: "grant_revoked", label: "Grant Revoked" },
  { value: "os_plan_override", label: "OS Plan Override" },
  { value: "app_subscription_override", label: "App Subscription Override" },
  { value: "app_installed", label: "App Installed" },
  { value: "app_uninstalled", label: "App Uninstalled" },
  { value: "os_plan_override_removed", label: "OS Override Removed" },
  { value: "app_plan_override_removed", label: "App Override Removed" },
];

export default function OwnerAudit() {
  const [actionType, setActionType] = useState<string | undefined>();
  const { data, isLoading } = usePlatformAudit(actionType);

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h1 className="text-xl font-bold text-foreground">Audit Log</h1>
        <Select value={actionType || "all"} onValueChange={(v) => setActionType(v === "all" ? undefined : v)}>
          <SelectTrigger className="w-52">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {ACTION_TYPES.map((t) => (
              <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isLoading && (
        <div className="flex justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      )}

      {data?.logs?.length === 0 && !isLoading && (
        <p className="text-muted-foreground text-sm text-center py-8">No audit entries.</p>
      )}

      <div className="grid gap-3">
        {data?.logs?.map((log: any) => (
          <Card key={log.id}>
            <CardContent className="py-3 space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant="outline" className="text-xs">{log.action_type}</Badge>
                <span className="text-xs text-muted-foreground">
                  {new Date(log.created_at).toLocaleString()}
                </span>
              </div>
              {log.target_type && (
                <p className="text-xs text-muted-foreground">
                  {log.target_type}: <span className="font-mono">{log.target_id}</span>
                </p>
              )}
              {log.reason && (
                <p className="text-sm text-foreground">{log.reason}</p>
              )}
              {log.payload && Object.keys(log.payload).length > 0 && (
                <pre className="text-xs text-muted-foreground bg-muted rounded p-2 overflow-auto max-h-24">
                  {JSON.stringify(log.payload, null, 2)}
                </pre>
              )}
              <p className="text-xs text-muted-foreground font-mono">Actor: {log.actor_user_id}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {data?.total != null && (
        <p className="text-xs text-muted-foreground text-center">
          Showing {data.logs?.length} of {data.total}
        </p>
      )}
    </div>
  );
}
