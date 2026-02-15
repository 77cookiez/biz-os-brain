import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import {
  useRecoverySettings,
  useSnapshots,
  useCreateSnapshot,
  usePreviewRestore,
  useRestoreSnapshot,
  useExportSnapshot,
  type RestorePreview,
} from '@/hooks/useRecovery';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import {
  Database, Download, RotateCcw, Plus, Clock, Shield, AlertTriangle,
  Loader2, CheckCircle, HardDrive,
} from 'lucide-react';

function formatBytes(bytes: number | null): string {
  if (!bytes) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

const REASON_LABELS: Record<string, string> = {
  manual: 'Manual',
  scheduled: 'Scheduled',
  pre_restore: 'Pre-Restore',
  pre_upgrade: 'Pre-Upgrade',
};

export default function RecoverySettingsPage() {
  const { t } = useTranslation();
  const { currentWorkspace } = useWorkspace();
  const { user } = useAuth();
  const workspaceId = currentWorkspace?.id;

  // Admin check
  const { data: isAdmin, isLoading: adminLoading } = useQuery({
    queryKey: ['is-workspace-admin', workspaceId, user?.id],
    queryFn: async () => {
      if (!workspaceId || !user) return false;
      const { data } = await supabase.rpc('is_workspace_admin', {
        _user_id: user.id,
        _workspace_id: workspaceId,
      });
      return data as boolean;
    },
    enabled: !!workspaceId && !!user,
  });

  const { settings, isLoading: settingsLoading, updateSettings } = useRecoverySettings();
  const { snapshots, isLoading: snapshotsLoading } = useSnapshots();
  const createSnapshot = useCreateSnapshot();
  const previewRestore = usePreviewRestore();
  const restoreSnapshot = useRestoreSnapshot();
  const exportSnapshot = useExportSnapshot();

  // Restore wizard state
  const [restoreDialog, setRestoreDialog] = useState(false);
  const [restoreStep, setRestoreStep] = useState<1 | 2>(1);
  const [selectedSnapshotId, setSelectedSnapshotId] = useState<string | null>(null);
  const [restorePreviewData, setRestorePreviewData] = useState<RestorePreview | null>(null);
  const [confirmPhrase, setConfirmPhrase] = useState('');

  const requiredPhrase = `RESTORE ${currentWorkspace?.name || ''}`;

  if (adminLoading || settingsLoading) {
    return (
      <div className="mx-auto max-w-3xl space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="mx-auto max-w-3xl">
        <Card>
          <CardContent className="py-12 text-center">
            <Shield className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h2 className="text-lg font-semibold text-foreground">{t('recovery.locked', 'Access Restricted')}</h2>
            <p className="text-sm text-muted-foreground mt-2">
              {t('recovery.lockedDesc', 'Only workspace administrators can access the Recovery Center.')}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const openRestoreWizard = async (snapshotId: string) => {
    setSelectedSnapshotId(snapshotId);
    setRestoreStep(1);
    setConfirmPhrase('');
    setRestorePreviewData(null);
    setRestoreDialog(true);

    const result = await previewRestore.mutateAsync(snapshotId);
    setRestorePreviewData(result);
  };

  const executeRestore = async () => {
    if (!selectedSnapshotId || !restorePreviewData) return;
    await restoreSnapshot.mutateAsync({
      snapshotId: selectedSnapshotId,
      confirmationToken: restorePreviewData.confirmation_token,
    });
    setRestoreDialog(false);
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">{t('recovery.title', 'Recovery & Backup')}</h1>
        <p className="text-sm text-muted-foreground mt-1">{t('recovery.subtitle', 'Manage workspace snapshots and restore points')}</p>
      </div>

      {/* Backup Settings */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Database className="h-4 w-4" />
            {t('recovery.settings', 'Backup Settings')}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label>{t('recovery.autoBackup', 'Automatic Backups')}</Label>
              <p className="text-xs text-muted-foreground">{t('recovery.autoBackupDesc', 'Create snapshots on a schedule')}</p>
            </div>
            <Switch
              checked={settings?.is_enabled ?? false}
              onCheckedChange={(checked) => updateSettings.mutate({ is_enabled: checked })}
              disabled={updateSettings.isPending}
            />
          </div>

          {settings?.is_enabled && (
            <>
              <Separator />
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>{t('recovery.cadence', 'Frequency')}</Label>
                  <Select
                    value={settings?.cadence || 'daily'}
                    onValueChange={(v) => updateSettings.mutate({ cadence: v })}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="daily">Daily</SelectItem>
                      <SelectItem value="weekly">Weekly</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>{t('recovery.retention', 'Keep latest')}</Label>
                  <Select
                    value={String(settings?.retain_count || 30)}
                    onValueChange={(v) => updateSettings.mutate({ retain_count: parseInt(v) })}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="7">7 snapshots</SelectItem>
                      <SelectItem value="14">14 snapshots</SelectItem>
                      <SelectItem value="30">30 snapshots</SelectItem>
                      <SelectItem value="60">60 snapshots</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Manual Snapshot */}
      <Card>
        <CardContent className="py-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-foreground">{t('recovery.createManual', 'Create Manual Snapshot')}</p>
              <p className="text-xs text-muted-foreground">{t('recovery.createManualDesc', 'Save the current state of all workspace data')}</p>
            </div>
            <Button
              onClick={() => createSnapshot.mutate()}
              disabled={createSnapshot.isPending}
              size="sm"
            >
              {createSnapshot.isPending ? <Loader2 className="h-4 w-4 animate-spin me-1" /> : <Plus className="h-4 w-4 me-1" />}
              {t('recovery.snapshot', 'Snapshot')}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Snapshots List */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Clock className="h-4 w-4" />
            {t('recovery.snapshots', 'Snapshots')}
            {!snapshotsLoading && <Badge variant="secondary">{snapshots.length}</Badge>}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {snapshotsLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          ) : snapshots.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">{t('recovery.noSnapshots', 'No snapshots yet')}</p>
          ) : (
            <div className="space-y-2">
              {snapshots.map((snap) => (
                <div key={snap.id} className="flex items-center justify-between rounded-lg border border-border p-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="flex flex-col min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-foreground">{formatDate(snap.created_at)}</span>
                        <Badge variant="outline" className="text-[10px]">
                          {REASON_LABELS[snap.created_reason] || snap.created_reason}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        {snap.storage_path && <span className="flex items-center gap-0.5"><HardDrive className="h-3 w-3" /> Stored</span>}
                        <span>{formatBytes(snap.size_bytes)}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => exportSnapshot.mutate(snap.id)}
                      disabled={exportSnapshot.isPending}
                      title="Download"
                    >
                      <Download className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => openRestoreWizard(snap.id)}
                      disabled={previewRestore.isPending}
                      title="Restore"
                    >
                      <RotateCcw className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Restore Wizard Dialog */}
      <Dialog open={restoreDialog} onOpenChange={setRestoreDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <RotateCcw className="h-5 w-5" />
              {restoreStep === 1 ? t('recovery.previewRestore', 'Preview Restore') : t('recovery.confirmRestore', 'Confirm Restore')}
            </DialogTitle>
            <DialogDescription>
              {restoreStep === 1
                ? t('recovery.previewDesc', 'Review what will change before restoring.')
                : t('recovery.confirmDesc', 'This action is irreversible. A pre-restore backup will be created automatically.')}
            </DialogDescription>
          </DialogHeader>

          {restoreStep === 1 && (
            <div className="space-y-4">
              {previewRestore.isPending ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                </div>
              ) : restorePreviewData ? (
                <>
                  <Alert>
                    <AlertTriangle className="h-4 w-4" />
                    <AlertTitle>{t('recovery.willReplace', 'Current data will be replaced')}</AlertTitle>
                    <AlertDescription>
                      <div className="grid grid-cols-2 gap-2 mt-2 text-xs">
                        <div>
                          <p className="font-medium">Will remove:</p>
                          {Object.entries(restorePreviewData.summary.will_replace).map(([k, v]) => (
                            <p key={k}>{k}: {v}</p>
                          ))}
                        </div>
                        <div>
                          <p className="font-medium">Will restore:</p>
                          {Object.entries(restorePreviewData.summary.will_restore).map(([k, v]) => (
                            <p key={k}>{k}: {v}</p>
                          ))}
                        </div>
                      </div>
                    </AlertDescription>
                  </Alert>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setRestoreDialog(false)}>Cancel</Button>
                    <Button variant="destructive" onClick={() => setRestoreStep(2)}>
                      Continue
                    </Button>
                  </DialogFooter>
                </>
              ) : null}
            </div>
          )}

          {restoreStep === 2 && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>{t('recovery.typeToConfirm', 'Type the following to confirm:')}</Label>
                <code className="block text-sm bg-muted px-3 py-2 rounded font-mono">{requiredPhrase}</code>
                <Input
                  value={confirmPhrase}
                  onChange={(e) => setConfirmPhrase(e.target.value)}
                  placeholder={requiredPhrase}
                />
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setRestoreStep(1)}>Back</Button>
                <Button
                  variant="destructive"
                  disabled={confirmPhrase !== requiredPhrase || restoreSnapshot.isPending}
                  onClick={executeRestore}
                >
                  {restoreSnapshot.isPending ? (
                    <><Loader2 className="h-4 w-4 animate-spin me-1" /> Restoring...</>
                  ) : (
                    <><RotateCcw className="h-4 w-4 me-1" /> Restore Now</>
                  )}
                </Button>
              </DialogFooter>
            </div>
          )}

          {restoreSnapshot.isSuccess && (
            <div className="flex items-center gap-2 text-sm text-primary">
              <CheckCircle className="h-4 w-4" />
              Restore completed successfully!
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
