import { useState, useMemo } from "react";
import {
  usePlatformWorkspaces,
  useWorkspaceDetail,
  useAvailableApps,
  useSetOsPlan,
  useSetAppSubscription,
  useInstallApp,
  useUninstallApp,
  useRemoveOverride,
} from "@/hooks/usePlatformAdmin";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Loader2,
  Search,
  ArrowLeft,
  Package,
  CreditCard,
  Users,
  Plus,
  X,
  AlertTriangle,
  ShieldCheck,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

const OS_PLANS = [
  { id: "free", label: "Free" },
  { id: "professional", label: "Pro" },
  { id: "enterprise", label: "Business" },
];

const BOOKING_PLANS = [
  { id: "monthly", label: "Monthly" },
  { id: "yearly", label: "Yearly" },
];

// Helper: find active grant of a given type from grants list
function findActiveGrant(grants: any[], grantType: string, filterFn?: (g: any) => boolean) {
  return grants.find(
    (g: any) => g.grant_type === grantType && g.is_active && (!filterFn || filterFn(g))
  );
}

export default function OwnerWorkspaces() {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [selectedWsId, setSelectedWsId] = useState<string | null>(null);

  // Dialogs
  const [osPlanDialog, setOsPlanDialog] = useState(false);
  const [appSubDialog, setAppSubDialog] = useState(false);
  const [installDialog, setInstallDialog] = useState(false);
  const [uninstallTarget, setUninstallTarget] = useState<string | null>(null);
  const [removeOsOverrideDialog, setRemoveOsOverrideDialog] = useState(false);
  const [removeBookingOverrideDialog, setRemoveBookingOverrideDialog] = useState(false);

  // Form state
  const [reason, setReason] = useState("");
  const [selectedPlan, setSelectedPlan] = useState("");
  const [selectedCycle, setSelectedCycle] = useState("monthly");
  const [selectedAppPlan, setSelectedAppPlan] = useState("monthly");
  const [selectedAppId, setSelectedAppId] = useState("");

  const { data: listData, isLoading: listLoading } = usePlatformWorkspaces(debouncedSearch);
  const { data: detail, isLoading: detailLoading } = useWorkspaceDetail(selectedWsId);
  const { data: availableAppsData } = useAvailableApps();

  // Build app name map from registry (must be top-level)
  const registryApps: any[] = availableAppsData?.apps || [];
  const appNameMap = useMemo(() => {
    const map: Record<string, string> = {};
    registryApps.forEach((a: any) => { map[a.id] = a.name; });
    return map;
  }, [registryApps]);

  const setOsPlan = useSetOsPlan();
  const setAppSub = useSetAppSubscription();
  const installApp = useInstallApp();
  const uninstallApp = useUninstallApp();
  const removeOverride = useRemoveOverride();

  const doSearch = () => setDebouncedSearch(search);

  const resetDialog = () => {
    setReason("");
    setSelectedPlan("");
    setSelectedCycle("monthly");
    setSelectedAppPlan("monthly");
    setSelectedAppId("");
    setOsPlanDialog(false);
    setAppSubDialog(false);
    setInstallDialog(false);
    setUninstallTarget(null);
    setRemoveOsOverrideDialog(false);
    setRemoveBookingOverrideDialog(false);
  };

  const handleSetOsPlan = () => {
    if (!selectedWsId || !selectedPlan || !reason.trim()) return;
    setOsPlan.mutate(
      { workspace_id: selectedWsId, plan_id: selectedPlan, billing_cycle: selectedCycle, reason: reason.trim() },
      {
        onSuccess: () => { toast.success("OS plan override created"); resetDialog(); },
        onError: (e) => toast.error(e.message),
      }
    );
  };

  const handleSetAppSub = () => {
    if (!selectedWsId || !selectedAppPlan || !reason.trim()) return;
    setAppSub.mutate(
      { workspace_id: selectedWsId, app_id: "booking", plan: selectedAppPlan, status: "active", reason: reason.trim() },
      {
        onSuccess: () => { toast.success("Bookivo subscription override created"); resetDialog(); },
        onError: (e) => toast.error(e.message),
      }
    );
  };

  const handleInstallApp = () => {
    if (!selectedWsId || !selectedAppId || !reason.trim()) return;
    installApp.mutate(
      { workspace_id: selectedWsId, app_id: selectedAppId, reason: reason.trim() },
      {
        onSuccess: () => { toast.success("App installed"); resetDialog(); },
        onError: (e) => toast.error(e.message),
      }
    );
  };

  const handleUninstallApp = () => {
    if (!selectedWsId || !uninstallTarget || !reason.trim()) return;
    uninstallApp.mutate(
      { workspace_id: selectedWsId, app_id: uninstallTarget, reason: reason.trim() },
      {
        onSuccess: () => { toast.success("App deactivated"); resetDialog(); },
        onError: (e) => toast.error(e.message),
      }
    );
  };

  const handleRemoveOsOverride = () => {
    if (!selectedWsId || !reason.trim()) return;
    removeOverride.mutate(
      { workspace_id: selectedWsId, override_type: "os_plan_override", reason: reason.trim() },
      {
        onSuccess: () => { toast.success("OS plan override removed"); resetDialog(); },
        onError: (e) => toast.error(e.message),
      }
    );
  };

  const handleRemoveBookingOverride = () => {
    if (!selectedWsId || !reason.trim()) return;
    removeOverride.mutate(
      { workspace_id: selectedWsId, override_type: "app_plan_override", app_id: "booking", reason: reason.trim() },
      {
        onSuccess: () => { toast.success("Bookivo override removed"); resetDialog(); },
        onError: (e) => toast.error(e.message),
      }
    );
  };

  // ─── Detail View ───
  if (selectedWsId) {
    const ws = detail?.workspace;
    const apps: any[] = detail?.apps || [];
    const osSub = detail?.os_subscription;
    const bookingSub = detail?.booking_subscription;
    const memberCount = detail?.member_count || 0;
    const activeGrants: any[] = detail?.active_grants || [];
    const installedAppIds = apps.filter((a: any) => a.is_active).map((a: any) => a.app_id);

    // (E) Resolve effective OS plan: grants first, then billing_subscriptions
    const osPlanOverride = findActiveGrant(activeGrants, "os_plan_override");
    const effectiveOsPlanId = osPlanOverride?.value_json?.plan_id || osSub?.plan_id || "free";
    const effectiveOsPlanName = osPlanOverride?.value_json?.plan_name
      || osSub?.billing_plans?.name
      || effectiveOsPlanId;
    const effectiveOsCycle = osPlanOverride?.value_json?.billing_cycle || osSub?.billing_cycle || "monthly";
    const isOsOverride = !!osPlanOverride;

    // (E) Resolve effective Bookivo plan: grants first
    const appPlanOverride = findActiveGrant(activeGrants, "app_plan_override", (g) => g.value_json?.app_id === "booking");
    const isBookingOverride = !!appPlanOverride;

    // Available apps from DB, filtered to exclude already installed
    const installableApps = registryApps.filter((a: any) => !installedAppIds.includes(a.id));

    return (
      <div className="space-y-6 max-w-3xl">
        <Button variant="ghost" size="sm" onClick={() => setSelectedWsId(null)} className="gap-1">
          <ArrowLeft className="h-4 w-4" /> Back to list
        </Button>

        {detailLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : !ws ? (
          <p className="text-muted-foreground text-center py-8">Workspace not found.</p>
        ) : (
          <>
            {/* Workspace Info */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-lg">{ws.name}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-1 text-sm">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Users className="h-4 w-4" />
                  <span>{memberCount} members</span>
                </div>
                <p className="text-xs text-muted-foreground font-mono">{ws.id}</p>
                <p className="text-xs text-muted-foreground">
                  Created: {new Date(ws.created_at).toLocaleDateString()}
                </p>
              </CardContent>
            </Card>

            {/* OS Plan — shows override vs truth */}
            <Card>
              <CardHeader className="pb-2 flex flex-row items-center justify-between">
                <CardTitle className="text-sm flex items-center gap-2">
                  <CreditCard className="h-4 w-4" /> OS Plan
                </CardTitle>
                <div className="flex gap-2">
                  {isOsOverride && (
                    <Button size="sm" variant="destructive" onClick={() => setRemoveOsOverrideDialog(true)}>
                      Remove Override
                    </Button>
                  )}
                  <Button size="sm" variant="outline" onClick={() => {
                    setSelectedPlan(effectiveOsPlanId);
                    setSelectedCycle(effectiveOsCycle);
                    setOsPlanDialog(true);
                  }}>
                    Override Plan
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant="default" className="capitalize">
                    {effectiveOsPlanName}
                  </Badge>
                  <Badge variant="outline">{effectiveOsCycle}</Badge>
                  {isOsOverride ? (
                    <Badge variant="secondary" className="text-xs gap-1">
                      <ShieldCheck className="h-3 w-3" />
                      Override
                    </Badge>
                  ) : (
                    <Badge variant={osSub?.status === "active" ? "default" : "destructive"}>
                      {osSub?.status || "none"}
                    </Badge>
                  )}
                </div>
                {isOsOverride && osSub && (
                  <p className="text-xs text-muted-foreground">
                    Billing truth: {osSub.billing_plans?.name || osSub.plan_id} ({osSub.billing_cycle})
                    — {osSub.billing_provider}
                  </p>
                )}
              </CardContent>
            </Card>

            {/* Installed Apps */}
            <Card>
              <CardHeader className="pb-2 flex flex-row items-center justify-between">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Package className="h-4 w-4" /> Installed Apps
                </CardTitle>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setInstallDialog(true)}
                  disabled={installableApps.length === 0}
                >
                  <Plus className="h-3.5 w-3.5 mr-1" /> Install App
                </Button>
              </CardHeader>
              <CardContent>
                {apps.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No apps installed.</p>
                ) : (
                  <div className="space-y-2">
                    {apps.map((app: any) => (
                      <div key={app.id} className="flex items-center justify-between py-1.5 border-b border-border last:border-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-foreground">
                            {appNameMap[app.app_id] || app.app_id}
                          </span>
                          <Badge variant={app.is_active ? "default" : "secondary"} className="text-xs">
                            {app.is_active ? "Active" : "Inactive"}
                          </Badge>
                        </div>
                        {app.is_active && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-destructive hover:text-destructive h-7"
                            onClick={() => setUninstallTarget(app.app_id)}
                          >
                            <X className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Bookivo Subscription — shows override vs truth */}
            {installedAppIds.includes("booking") && (
              <Card>
                <CardHeader className="pb-2 flex flex-row items-center justify-between">
                  <CardTitle className="text-sm">Bookivo Subscription</CardTitle>
                  <div className="flex gap-2">
                    {isBookingOverride && (
                      <Button size="sm" variant="destructive" onClick={() => setRemoveBookingOverrideDialog(true)}>
                        Remove Override
                      </Button>
                    )}
                    <Button size="sm" variant="outline" onClick={() => {
                      setSelectedAppPlan(
                        isBookingOverride
                          ? appPlanOverride.value_json?.plan || "monthly"
                          : bookingSub?.plan || "monthly"
                      );
                      setAppSubDialog(true);
                    }}>
                      Override
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2">
                  {isBookingOverride && (
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant="default" className="capitalize">
                        {appPlanOverride.value_json?.plan}
                      </Badge>
                      <Badge variant="secondary" className="text-xs gap-1">
                        <ShieldCheck className="h-3 w-3" />
                        Override
                      </Badge>
                    </div>
                  )}
                  {bookingSub ? (
                    <div className="flex items-center gap-2 flex-wrap">
                      {!isBookingOverride && (
                        <Badge variant="default" className="capitalize">{bookingSub.plan}</Badge>
                      )}
                      {isBookingOverride && (
                        <span className="text-xs text-muted-foreground">DB truth:</span>
                      )}
                      <Badge variant={bookingSub.status === "active" ? (isBookingOverride ? "outline" : "default") : "destructive"}>
                        {bookingSub.plan} — {bookingSub.status}
                      </Badge>
                      {bookingSub.expires_at && (
                        <span className="text-xs text-muted-foreground">
                          Expires: {new Date(bookingSub.expires_at).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  ) : (
                    !isBookingOverride && (
                      <p className="text-sm text-muted-foreground">No subscription.</p>
                    )
                  )}
                </CardContent>
              </Card>
            )}

            {/* Active Grants */}
            {activeGrants.length > 0 && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Active Grants</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {activeGrants.map((g: any) => (
                      <div key={g.id} className="flex items-center gap-2 flex-wrap text-sm">
                        <Badge variant="outline" className="capitalize text-xs">
                          {g.grant_type.replace(/_/g, " ")}
                        </Badge>
                        <span className="text-muted-foreground text-xs">{g.reason}</span>
                        {g.ends_at && (
                          <span className="text-xs text-muted-foreground">
                            (until {new Date(g.ends_at).toLocaleDateString()})
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </>
        )}

        {/* ─── Dialogs ─── */}

        {/* Set OS Plan — grant only */}
        <Dialog open={osPlanDialog} onOpenChange={() => resetDialog()}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-destructive" />
                Override OS Plan
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Creates a grant-based override for <strong>{ws?.name}</strong>.
                Does not modify billing truth (Stripe).
              </p>
              <div>
                <label className="text-sm font-medium text-foreground">Plan</label>
                <Select value={selectedPlan} onValueChange={setSelectedPlan}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {OS_PLANS.map((p) => (
                      <SelectItem key={p.id} value={p.id}>{p.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium text-foreground">Billing Cycle</label>
                <Select value={selectedCycle} onValueChange={setSelectedCycle}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="monthly">Monthly</SelectItem>
                    <SelectItem value="yearly">Yearly</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium text-foreground">Reason (required)</label>
                <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Why is this override needed?" className="mt-1" />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={resetDialog}>Cancel</Button>
              <Button onClick={handleSetOsPlan} disabled={!selectedPlan || !reason.trim() || setOsPlan.isPending}>
                {setOsPlan.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                Create Override
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Set Bookivo Subscription */}
        <Dialog open={appSubDialog} onOpenChange={() => resetDialog()}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Override Bookivo Subscription</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-foreground">Plan</label>
                <Select value={selectedAppPlan} onValueChange={setSelectedAppPlan}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {BOOKING_PLANS.map((p) => (
                      <SelectItem key={p.id} value={p.id}>{p.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium text-foreground">Reason (required)</label>
                <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Why override this subscription?" className="mt-1" />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={resetDialog}>Cancel</Button>
              <Button onClick={handleSetAppSub} disabled={!reason.trim() || setAppSub.isPending}>
                {setAppSub.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                Override Subscription
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Install App — from DB registry */}
        <Dialog open={installDialog} onOpenChange={() => resetDialog()}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Install App</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-foreground">App</label>
                <Select value={selectedAppId} onValueChange={setSelectedAppId}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder="Select app..." /></SelectTrigger>
                  <SelectContent>
                    {installableApps.map((a: any) => (
                      <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium text-foreground">Reason (required)</label>
                <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Why install this app?" className="mt-1" />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={resetDialog}>Cancel</Button>
              <Button onClick={handleInstallApp} disabled={!selectedAppId || !reason.trim() || installApp.isPending}>
                {installApp.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                Install
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Uninstall App */}
        <Dialog open={!!uninstallTarget} onOpenChange={() => resetDialog()}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-destructive" />
                Deactivate App
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                This will deactivate <strong>{appNameMap[uninstallTarget || ""] || uninstallTarget}</strong>. No data will be deleted.
              </p>
              <div>
                <label className="text-sm font-medium text-foreground">Reason (required)</label>
                <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Why deactivate this app?" className="mt-1" />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={resetDialog}>Cancel</Button>
              <Button variant="destructive" onClick={handleUninstallApp} disabled={!reason.trim() || uninstallApp.isPending}>
                {uninstallApp.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                Deactivate
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Remove OS Override */}
        <Dialog open={removeOsOverrideDialog} onOpenChange={() => resetDialog()}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-destructive" />
                Remove OS Plan Override
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                This will remove the active OS plan override for <strong>{ws?.name}</strong>.
                The workspace will revert to its billing subscription plan.
              </p>
              {osPlanOverride && (
                <div className="flex items-center gap-2 flex-wrap text-sm">
                  <span className="text-muted-foreground">Current override:</span>
                  <Badge variant="secondary" className="capitalize">{osPlanOverride.value_json?.plan_id}</Badge>
                  <Badge variant="outline">{osPlanOverride.value_json?.billing_cycle}</Badge>
                </div>
              )}
              <div>
                <label className="text-sm font-medium text-foreground">Reason (required)</label>
                <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Why remove this override?" className="mt-1" />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={resetDialog}>Cancel</Button>
              <Button variant="destructive" onClick={handleRemoveOsOverride} disabled={!reason.trim() || removeOverride.isPending}>
                {removeOverride.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                Remove Override
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Remove Bookivo Override */}
        <Dialog open={removeBookingOverrideDialog} onOpenChange={() => resetDialog()}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-destructive" />
                Remove Bookivo Override
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                This will remove the active Bookivo subscription override for <strong>{ws?.name}</strong>.
                The workspace will revert to its actual booking subscription.
              </p>
              {appPlanOverride && (
                <div className="flex items-center gap-2 flex-wrap text-sm">
                  <span className="text-muted-foreground">Current override:</span>
                  <Badge variant="secondary" className="capitalize">{appPlanOverride.value_json?.plan}</Badge>
                  <Badge variant="outline">{appPlanOverride.value_json?.status}</Badge>
                </div>
              )}
              <div>
                <label className="text-sm font-medium text-foreground">Reason (required)</label>
                <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Why remove this override?" className="mt-1" />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={resetDialog}>Cancel</Button>
              <Button variant="destructive" onClick={handleRemoveBookingOverride} disabled={!reason.trim() || removeOverride.isPending}>
                {removeOverride.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                Remove Override
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  // ─── List View ───
  return (
    <div className="space-y-6 max-w-3xl">
      <h1 className="text-xl font-bold text-foreground">Workspaces</h1>

      <div className="flex gap-2">
        <Input
          placeholder="Search by name or ID..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && doSearch()}
          className="flex-1"
        />
        <Button onClick={doSearch} variant="secondary">
          <Search className="h-4 w-4" />
        </Button>
      </div>

      {listLoading && (
        <div className="flex justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      )}

      {listData?.workspaces?.length === 0 && !listLoading && (
        <p className="text-muted-foreground text-sm text-center py-8">No workspaces found.</p>
      )}

      <div className="grid gap-3">
        {listData?.workspaces?.map((ws: any) => (
          <Card
            key={ws.id}
            className="cursor-pointer hover:bg-accent/50 transition-colors"
            onClick={() => setSelectedWsId(ws.id)}
          >
            <CardContent className="flex items-center justify-between py-4 gap-3">
              <div className="min-w-0 flex-1">
                <p className="font-medium text-foreground truncate">{ws.name}</p>
                <span className="text-xs text-muted-foreground font-mono truncate">{ws.id}</span>
              </div>
              <Badge variant="outline" className="shrink-0 text-xs">View</Badge>
            </CardContent>
          </Card>
        ))}
      </div>

      {listData?.total != null && (
        <p className="text-xs text-muted-foreground text-center">
          Showing {listData.workspaces?.length} of {listData.total}
        </p>
      )}
    </div>
  );
}
