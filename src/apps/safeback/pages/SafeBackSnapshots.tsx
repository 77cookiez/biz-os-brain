import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Shield, Plus, Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import {
  useSnapshots, useCreateSnapshot, useExportSnapshot,
  usePreviewRestore, useRestoreSnapshot, type RestorePreview,
} from '@/apps/safeback/lib/hooks';
import SnapshotsList from '@/apps/safeback/components/SnapshotsList';
import RestoreWizard from '@/apps/safeback/components/RestoreWizard';

export default function SafeBackSnapshots() {
  const { t } = useTranslation();
  const { currentWorkspace } = useWorkspace();
  const { user } = useAuth();
  const workspaceId = currentWorkspace?.id;

  const { data: isAdmin, isLoading: adminLoading } = useQuery({
    queryKey: ['is-workspace-admin', workspaceId, user?.id],
    queryFn: async () => {
      if (!workspaceId || !user) return false;
      const { data } = await supabase.rpc('is_workspace_admin', { _user_id: user.id, _workspace_id: workspaceId });
      return data as boolean;
    },
    enabled: !!workspaceId && !!user,
  });

  const { snapshots, isLoading: snapshotsLoading } = useSnapshots();
  const createSnapshot = useCreateSnapshot();
  const exportSnapshot = useExportSnapshot();
  const previewRestore = usePreviewRestore();
  const restoreSnapshot = useRestoreSnapshot();

  const [restoreDialog, setRestoreDialog] = useState(false);
  const [selectedSnapshotId, setSelectedSnapshotId] = useState<string | null>(null);
  const [restorePreviewData, setRestorePreviewData] = useState<RestorePreview | null>(null);

  const requiredPhrase = `RESTORE ${currentWorkspace?.name || ''}`;

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

  if (adminLoading || snapshotsLoading) {
    return <div className="space-y-4"><Skeleton className="h-8 w-48" /><Skeleton className="h-48 w-full" /></div>;
  }

  if (!isAdmin) {
    return (
      <Card><CardContent className="py-12 text-center">
        <Shield className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
        <h2 className="text-lg font-semibold text-foreground">{t('recovery.locked', 'Access Restricted')}</h2>
      </CardContent></Card>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-foreground">{t('apps.safeback.tabs.snapshots', 'Snapshots')}</h2>
        <Button size="sm" onClick={() => createSnapshot.mutate()} disabled={createSnapshot.isPending}>
          {createSnapshot.isPending ? <Loader2 className="h-4 w-4 animate-spin me-1" /> : <Plus className="h-4 w-4 me-1" />}
          {t('recovery.snapshot', 'Snapshot')}
        </Button>
      </div>
      <SnapshotsList
        snapshots={snapshots}
        isLoading={false}
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
