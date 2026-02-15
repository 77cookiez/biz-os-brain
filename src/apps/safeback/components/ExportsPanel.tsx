import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Download, Loader2 } from 'lucide-react';
import type { Snapshot } from '@/hooks/useRecovery';

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

interface ExportsPanelProps {
  snapshots: Snapshot[];
  onExport: (id: string) => void;
  exportPending: boolean;
}

export default function ExportsPanel({ snapshots, onExport, exportPending }: ExportsPanelProps) {
  const { t } = useTranslation();

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Download className="h-4 w-4" />
          {t('apps.safeback.tabs.exports', 'Exports')}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {snapshots.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">{t('apps.safeback.exports.noSnapshots', 'No snapshots available to export.')}</p>
        ) : (
          <div className="space-y-2">
            {snapshots.map(snap => (
              <div key={snap.id} className="flex items-center justify-between rounded-lg border border-border p-3">
                <div>
                  <span className="text-sm font-medium text-foreground">{formatDate(snap.created_at)}</span>
                  <Badge variant="outline" className="ml-2 text-[10px]">{snap.created_reason}</Badge>
                </div>
                <Button size="sm" variant="outline" onClick={() => onExport(snap.id)} disabled={exportPending}>
                  {exportPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4 me-1" />}
                  {t('apps.safeback.exports.download', 'Export')}
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
