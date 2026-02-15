import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ShieldCheck, Plus, Clock, Download, Loader2, Info } from 'lucide-react';
import type { BackupSettings, Snapshot } from '@/hooks/useRecovery';
import { useNavigate } from 'react-router-dom';

interface OverviewPanelProps {
  settings: BackupSettings | null;
  snapshots: Snapshot[];
  onCreateSnapshot: () => void;
  createPending: boolean;
  onExportLatest: () => void;
  exportPending: boolean;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

export default function OverviewPanel({
  settings, snapshots, onCreateSnapshot, createPending, onExportLatest, exportPending,
}: OverviewPanelProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const lastSnapshot = snapshots[0];

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <ShieldCheck className="h-4 w-4" />
            {t('apps.safeback.overview.status', 'Backup Status')}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-xs text-muted-foreground">{t('apps.safeback.overview.lastSnapshot', 'Last Snapshot')}</p>
              <p className="text-sm font-medium text-foreground">{lastSnapshot ? formatDate(lastSnapshot.created_at) : '—'}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">{t('apps.safeback.overview.backupStatus', 'Auto Backup')}</p>
              <Badge variant={settings?.is_enabled ? 'default' : 'secondary'}>
                {settings?.is_enabled ? t('common.enabled', 'Enabled') : t('common.disabled', 'Disabled')}
              </Badge>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">{t('apps.safeback.overview.retention', 'Retention')}</p>
              <p className="text-sm font-medium text-foreground">{settings?.retain_count || 30}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">{t('apps.safeback.overview.totalSnapshots', 'Total Snapshots')}</p>
              <p className="text-sm font-medium text-foreground">{snapshots.length}</p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 pt-2">
            <Button size="sm" onClick={onCreateSnapshot} disabled={createPending}>
              {createPending ? <Loader2 className="h-4 w-4 animate-spin me-1" /> : <Plus className="h-4 w-4 me-1" />}
              {t('apps.safeback.overview.createSnapshot', 'Create Snapshot')}
            </Button>
            <Button size="sm" variant="outline" onClick={() => navigate('/apps/safeback/schedules')}>
              <Clock className="h-4 w-4 me-1" />
              {t('apps.safeback.overview.viewSchedules', 'View Schedules')}
            </Button>
            {lastSnapshot && (
              <Button size="sm" variant="outline" onClick={onExportLatest} disabled={exportPending}>
                <Download className="h-4 w-4 me-1" />
                {t('apps.safeback.overview.exportLatest', 'Export Latest')}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Snapshot Scope — what's actually included today */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Info className="h-4 w-4" />
            {t('apps.safeback.included.title', "What's included in snapshots")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-1.5">{t('apps.safeback.included.subtitle', 'Current version captures:')}</p>
            <ul className="text-sm text-foreground space-y-1 list-disc list-inside">
              <li>{t('apps.safeback.included.items.tasks', 'Tasks')}</li>
              <li>{t('apps.safeback.included.items.goals', 'Goals')}</li>
              <li>{t('apps.safeback.included.items.plans', 'Plans')}</li>
              <li>{t('apps.safeback.included.items.ideas', 'Ideas')}</li>
              <li>{t('apps.safeback.included.items.billing', 'Billing subscription state')}</li>
            </ul>
          </div>
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-1.5">{t('apps.safeback.excluded.title', 'Not included yet:')}</p>
            <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
              <li>{t('apps.safeback.excluded.items.apps', 'Installed apps data (Booking, Chat, etc.)')}</li>
              <li>{t('apps.safeback.excluded.items.files', 'Uploaded files & media')}</li>
              <li>{t('apps.safeback.excluded.items.secrets', 'API keys & secrets')}</li>
              <li>{t('apps.safeback.excluded.items.queues', 'Runtime queues & notifications')}</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
