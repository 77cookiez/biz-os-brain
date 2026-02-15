import { useState } from "react";
import { usePlatformGrants, useRevokeGrant } from "@/hooks/usePlatformAdmin";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, XCircle } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

export default function OwnerGrants() {
  const [scope, setScope] = useState<string | undefined>();
  const { data, isLoading } = usePlatformGrants(scope);
  const revokeMutation = useRevokeGrant();
  const [revokeTarget, setRevokeTarget] = useState<any>(null);
  const [reason, setReason] = useState("");

  const handleRevoke = () => {
    if (!revokeTarget || !reason.trim()) return;
    revokeMutation.mutate(
      { grant_id: revokeTarget.id, reason: reason.trim() },
      {
        onSuccess: () => {
          toast.success("Grant revoked");
          setRevokeTarget(null);
          setReason("");
        },
        onError: (e) => toast.error(e.message),
      }
    );
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h1 className="text-xl font-bold text-foreground">Platform Grants</h1>
        <Select value={scope || "all"} onValueChange={(v) => setScope(v === "all" ? undefined : v)}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Scopes</SelectItem>
            <SelectItem value="workspace">Workspace</SelectItem>
            <SelectItem value="user">User</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading && (
        <div className="flex justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      )}

      {data?.grants?.length === 0 && !isLoading && (
        <p className="text-muted-foreground text-sm text-center py-8">No active grants.</p>
      )}

      <div className="grid gap-3">
        {data?.grants?.map((g: any) => (
          <Card key={g.id}>
            <CardContent className="py-4 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="outline" className="capitalize">{g.scope}</Badge>
                    <Badge variant="secondary" className="capitalize">{g.grant_type.replace(/_/g, " ")}</Badge>
                    {g.ends_at && (
                      <span className="text-xs text-muted-foreground">
                        Expires: {new Date(g.ends_at).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground font-mono mt-1 truncate">{g.scope_id}</p>
                  <p className="text-sm text-muted-foreground mt-1">{g.reason}</p>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-destructive hover:text-destructive shrink-0"
                  onClick={() => setRevokeTarget(g)}
                >
                  <XCircle className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Revoke Dialog */}
      <Dialog open={!!revokeTarget} onOpenChange={() => setRevokeTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Revoke Grant</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Revoking <strong>{revokeTarget?.grant_type}</strong> for {revokeTarget?.scope} {revokeTarget?.scope_id}
            </p>
            <div>
              <label className="text-sm font-medium text-foreground">Reason (required)</label>
              <Textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Why is this grant being revoked?"
                className="mt-1"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRevokeTarget(null)}>Cancel</Button>
            <Button
              variant="destructive"
              onClick={handleRevoke}
              disabled={!reason.trim() || revokeMutation.isPending}
            >
              {revokeMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Revoke
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
