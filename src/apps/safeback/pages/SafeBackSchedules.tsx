import { useQuery } from '@tanstack/react-query';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent } from '@/components/ui/card';
import { Shield } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useRecoverySettings } from '@/apps/safeback/lib/hooks';
import ScheduleSettings from '@/apps/safeback/components/ScheduleSettings';

export default function SafeBackSchedules() {
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

  const { settings, isLoading: settingsLoading, updateSettings } = useRecoverySettings();

  if (adminLoading || settingsLoading) {
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
      <h2 className="text-lg font-semibold text-foreground">{t('apps.safeback.tabs.schedules', 'Schedules')}</h2>
      <ScheduleSettings
        settings={settings}
        onUpdate={(updates) => updateSettings.mutate(updates)}
        updatePending={updateSettings.isPending}
      />
    </div>
  );
}
