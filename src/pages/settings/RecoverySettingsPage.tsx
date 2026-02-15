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
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Shield, Loader2, Plus, ExternalLink, Info } from 'lucide-react';
import { Link } from 'react-router-dom';
import ScheduleSettings from '@/apps/safeback/components/ScheduleSettings';
import SnapshotsList from '@/apps/safeback/components/SnapshotsList';
import RestoreWizard from '@/apps/safeback/components/RestoreWizard';
import { FallbackProviderDescriptors } from '@/core/snapshot/providerRegistry';

export default function RecoverySettingsPage() {
  const { t } = useTranslation();
  const { currentWorkspace } = useWorkspace();
  const { user } = useAuth();
  const workspaceId = currentWorkspace?.id;

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

  const [restoreDialog, setRestoreDialog] = useState(false);
  const [selectedSnapshotId, setSelectedSnapshotId] = useState<string | null>(null);
  const [restorePreviewData, setRestorePreviewData] = useState<RestorePreview | null>(null);

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
      {/* SafeBack CTA Banner */}
      <Alert>
        <AlertDescription className="flex items-center justify-between">
          <span className="text-sm">{t('recovery.openSafebackCta.body', 'For advanced backup management, open SafeBack')}</span>
          <Button asChild size="sm" variant="outline">
            <Link to="/apps/safeback">
              <ExternalLink className="h-4 w-4 me-1" />
              {t('recovery.openSafebackCta.button', 'Open SafeBack')}
            </Link>
          </Button>
        </AlertDescription>
      </Alert>

      <div>
        <h1 className="text-2xl font-bold text-foreground">{t('recovery.title', 'Recovery & Backup')}</h1>
        <p className="text-sm text-muted-foreground mt-1">{t('recovery.subtitle', 'Manage workspace snapshots and restore points')}</p>
      </div>

      {/* Dynamic provider scope */}
      <Alert variant="default">
        <Info className="h-4 w-4" />
        <AlertDescription className="text-xs text-muted-foreground">
          {t('recovery.includedNote', 'Snapshots capture all registered OS Providers:')}{' '}
          {FallbackProviderDescriptors.map((p) => p.name).join(', ')}.
        </AlertDescription>
      </Alert>

      <ScheduleSettings
        settings={settings}
        onUpdate={(updates) => updateSettings.mutate(updates)}
        updatePending={updateSettings.isPending}
      />

      {/* Manual Snapshot */}
      <Card>
        <CardContent className="py-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-foreground">{t('recovery.createManual', 'Create Manual Snapshot')}</p>
              <p className="text-xs text-muted-foreground">{t('recovery.createManualDesc', 'Save the current state of all workspace data')}</p>
            </div>
            <Button onClick={() => createSnapshot.mutate()} disabled={createSnapshot.isPending} size="sm">
              {createSnapshot.isPending ? <Loader2 className="h-4 w-4 animate-spin me-1" /> : <Plus className="h-4 w-4 me-1" />}
              {t('recovery.snapshot', 'Snapshot')}
            </Button>
          </div>
        </CardContent>
      </Card>

      <SnapshotsList
        snapshots={snapshots}
        isLoading={snapshotsLoading}
        onExport={(id) => exportSnapshot.mutate(id)}
        onRestore={openRestoreWizard}
        exportPending={exportSnapshot.isPending}
        restorePending={previewRestore.isPending}
      />

      <RestoreWizard
        open={restoreDialog}
        onOpenChange={setRestoreDialog}
        previewData={restorePreviewData}
        previewPending={previewRestore.isPending}
        restorePending={restoreSnapshot.isPending}
        restoreSuccess={restoreSnapshot.isSuccess}
        requiredPhrase={requiredPhrase}
        onConfirmRestore={executeRestore}
      />
    </div>
  );
}
