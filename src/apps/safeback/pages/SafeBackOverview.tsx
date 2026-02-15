import { useQuery } from '@tanstack/react-query';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent } from '@/components/ui/card';
import { Shield } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useRecoverySettings, useSnapshots, useCreateSnapshot, useExportSnapshot } from '@/apps/safeback/lib/hooks';
import OverviewPanel from '@/apps/safeback/components/OverviewPanel';
import OnboardingChecklist from '@/apps/safeback/components/OnboardingChecklist';
import PlansUpsell from '@/apps/safeback/components/PlansUpsell';

export default function SafeBackOverview() {
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

  const { settings, isLoading: settingsLoading } = useRecoverySettings();
  const { snapshots, isLoading: snapshotsLoading } = useSnapshots();
  const createSnapshot = useCreateSnapshot();
  const exportSnapshot = useExportSnapshot();

  if (adminLoading || settingsLoading || snapshotsLoading) {
    return <div className="space-y-4"><Skeleton className="h-8 w-48" /><Skeleton className="h-48 w-full" /></div>;
  }

  if (!isAdmin) {
    return (
      <Card><CardContent className="py-12 text-center">
        <Shield className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
        <h2 className="text-lg font-semibold text-foreground">{t('recovery.locked', 'Access Restricted')}</h2>
        <p className="text-sm text-muted-foreground mt-2">{t('recovery.lockedDesc', 'Only workspace administrators can access SafeBack.')}</p>
      </CardContent></Card>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">{t('apps.safeback.title', 'SafeBack')}</h1>
        <p className="text-sm text-muted-foreground mt-1">{t('apps.safeback.subtitle', 'Workspace snapshots, scheduled backups, and safe restore')}</p>
      </div>
      <OverviewPanel
        settings={settings}
        snapshots={snapshots}
        onCreateSnapshot={() => createSnapshot.mutate()}
        createPending={createSnapshot.isPending}
        onExportLatest={() => snapshots[0] && exportSnapshot.mutate(snapshots[0].id)}
        exportPending={exportSnapshot.isPending}
      />
      <OnboardingChecklist />
      <PlansUpsell />
    </div>
  );
}
