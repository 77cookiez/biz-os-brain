import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { FileText, ChevronLeft, ChevronRight, Copy } from 'lucide-react';
import { useAuditLogs } from '@/apps/safeback/lib/hooks';
import { toast } from 'sonner';

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
}

const PAGE_SIZE = 20;

export default function AuditLogPanel() {
  const { t } = useTranslation();
  const [page, setPage] = useState(0);
  const { data, isLoading } = useAuditLogs(page, PAGE_SIZE);

  const logs = data?.data || [];
  const total = data?.count || 0;
  const totalPages = Math.ceil(total / PAGE_SIZE);

  const copyId = (id: string) => {
    navigator.clipboard.writeText(id);
    toast.success('Copied');
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <FileText className="h-4 w-4" />
          {t('apps.safeback.audit.title', 'Audit Log')}
          {!isLoading && <Badge variant="secondary">{total}</Badge>}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : logs.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">{t('apps.safeback.audit.empty', 'No audit entries yet.')}</p>
        ) : (
          <>
            <div className="space-y-2">
              {logs.map(log => (
                <div key={log.id} className="flex items-start justify-between rounded-lg border border-border p-3 gap-3">
                  <div className="flex flex-col min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs text-muted-foreground">{formatDate(log.created_at)}</span>
                      <Badge variant="outline" className="text-[10px]">{log.action}</Badge>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                      <span>Actor:</span>
                      <button onClick={() => copyId(log.actor_user_id)} className="flex items-center gap-0.5 hover:text-foreground">
                        <span className="font-mono truncate max-w-[120px]">{log.actor_user_id.slice(0, 8)}…</span>
                        <Copy className="h-3 w-3" />
                      </button>
                      {log.entity_id && (
                        <>
                          <span>Entity:</span>
                          <span className="font-mono truncate max-w-[120px]">{log.entity_id.slice(0, 8)}…</span>
                        </>
                      )}
                    </div>
                    {log.metadata && Object.keys(log.metadata).length > 0 && (
                      <p className="text-xs text-muted-foreground mt-1 truncate">
                        {JSON.stringify(log.metadata).slice(0, 100)}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
            {totalPages > 1 && (
              <div className="flex items-center justify-between mt-4">
                <Button variant="ghost" size="sm" disabled={page === 0} onClick={() => setPage(p => p - 1)}>
                  <ChevronLeft className="h-4 w-4 me-1" /> {t('common.back', 'Back')}
                </Button>
                <span className="text-xs text-muted-foreground">{page + 1}/{totalPages}</span>
                <Button variant="ghost" size="sm" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}>
                  {t('common.next', 'Next')} <ChevronRight className="h-4 w-4 ms-1" />
                </Button>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
