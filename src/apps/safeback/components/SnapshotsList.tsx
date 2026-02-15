import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Clock, Download, RotateCcw } from 'lucide-react';
import type { Snapshot } from '@/hooks/useRecovery';

const TYPE_LABELS: Record<string, string> = {
  manual: 'Manual',
  scheduled: 'Scheduled',
  pre_restore: 'Pre-Restore',
  pre_upgrade: 'Pre-Upgrade',
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

interface SnapshotsListProps {
  snapshots: Snapshot[];
  isLoading: boolean;
  onExport: (id: string) => void;
  onRestore: (id: string) => void;
  exportPending?: boolean;
  restorePending?: boolean;
}

export default function SnapshotsList({
  snapshots, isLoading, onExport, onRestore, exportPending, restorePending,
}: SnapshotsListProps) {
  const { t } = useTranslation();

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Clock className="h-4 w-4" />
          {t('recovery.snapshots', 'Snapshots')}
          {!isLoading && <Badge variant="secondary">{snapshots.length}</Badge>}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
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
                          {TYPE_LABELS[snap.snapshot_type] || snap.snapshot_type}
                        </Badge>
                      </div>
                    </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Button variant="ghost" size="sm" onClick={() => onExport(snap.id)} disabled={exportPending} title="Download">
                    <Download className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => onRestore(snap.id)} disabled={restorePending} title="Restore">
                    <RotateCcw className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
