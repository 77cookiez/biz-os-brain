import { useState } from "react";
import { usePlatformWorkspaces, useCreateGrant } from "@/hooks/usePlatformAdmin";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Search, ShieldPlus } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

export default function OwnerWorkspaces() {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [grantTarget, setGrantTarget] = useState<{ id: string; name: string } | null>(null);
  const [reason, setReason] = useState("");

  const { data, isLoading } = usePlatformWorkspaces(debouncedSearch);
  const createGrant = useCreateGrant();

  // Simple debounce via enter key / button
  const doSearch = () => setDebouncedSearch(search);

  const handleGrant = () => {
    if (!grantTarget || !reason.trim()) return;
    createGrant.mutate(
      {
        scope: "workspace",
        scope_id: grantTarget.id,
        grant_type: "full_access",
        reason: reason.trim(),
      },
      {
        onSuccess: () => {
          toast.success("Full access granted");
          setGrantTarget(null);
          setReason("");
        },
        onError: (e) => toast.error(e.message),
      }
    );
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <h1 className="text-xl font-bold text-foreground">Workspaces</h1>

      <div className="flex gap-2">
        <Input
          placeholder="Search by name, slug, or ID..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && doSearch()}
          className="flex-1"
        />
        <Button onClick={doSearch} variant="secondary">
          <Search className="h-4 w-4" />
        </Button>
      </div>

      {isLoading && (
        <div className="flex justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      )}

      {data?.workspaces?.length === 0 && !isLoading && (
        <p className="text-muted-foreground text-sm text-center py-8">No workspaces found.</p>
      )}

      <div className="grid gap-3">
        {data?.workspaces?.map((ws: any) => (
          <Card key={ws.id}>
            <CardContent className="flex items-center justify-between py-4 gap-3">
              <div className="min-w-0 flex-1">
                <p className="font-medium text-foreground truncate">{ws.name}</p>
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  <span className="text-xs text-muted-foreground font-mono truncate">{ws.id}</span>
                </div>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setGrantTarget({ id: ws.id, name: ws.name })}
              >
                <ShieldPlus className="h-3.5 w-3.5 mr-1" />
                Grant Access
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      {data?.total != null && (
        <p className="text-xs text-muted-foreground text-center">
          Showing {data.workspaces?.length} of {data.total}
        </p>
      )}

      {/* Grant Dialog */}
      <Dialog open={!!grantTarget} onOpenChange={() => setGrantTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Grant Full Access</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <p className="text-sm text-muted-foreground">Workspace</p>
              <p className="font-medium text-foreground">{grantTarget?.name}</p>
              <p className="text-xs text-muted-foreground font-mono">{grantTarget?.id}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-foreground">Reason (required)</label>
              <Textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Why is this access needed?"
                className="mt-1"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setGrantTarget(null)}>
              Cancel
            </Button>
            <Button
              onClick={handleGrant}
              disabled={!reason.trim() || createGrant.isPending}
            >
              {createGrant.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Grant Access
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
