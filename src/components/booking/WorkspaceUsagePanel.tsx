import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { BarChart3, Activity } from 'lucide-react';
import { useWorkspaceUsage, UsageMetric, UsageEvent } from '@/hooks/useWorkspaceUsage';
import { cn } from '@/lib/utils';

function UsageBar({ metric }: { metric: UsageMetric }) {
  const { t } = useTranslation();
  const isUnlimited = metric.limit === null;
  const isWarning = metric.percent >= 80 && metric.percent < 95;
  const isCritical = metric.percent >= 95;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium text-foreground">
          {t(metric.labelKey)}
          {metric.isMonthly && (
            <span className="text-muted-foreground text-xs ml-1">({t('usage.monthly')})</span>
          )}
        </span>
        <span className={cn(
          'font-mono text-xs',
          isCritical ? 'text-destructive font-semibold' : isWarning ? 'text-yellow-600 dark:text-yellow-400' : 'text-muted-foreground'
        )}>
          {isUnlimited
            ? `${metric.current} / ${t('usage.unlimited')}`
            : `${metric.current} / ${metric.limit}`}
        </span>
      </div>
      {!isUnlimited && (
        <Progress
          value={Math.min(metric.percent, 100)}
          className={cn(
            'h-2',
            isCritical ? '[&>div]:bg-destructive' : isWarning ? '[&>div]:bg-yellow-500' : ''
          )}
        />
      )}
      {isUnlimited && (
        <div className="h-2 rounded-full bg-muted flex items-center justify-center">
          <span className="text-[9px] text-muted-foreground">∞</span>
        </div>
      )}
    </div>
  );
}

const RESOURCE_I18N: Record<string, string> = {
  vendors: 'usage.vendors',
  services: 'usage.services',
  bookings: 'usage.bookingsMonth',
  quotes: 'usage.quotesMonth',
  seats: 'usage.seats',
};

function EventRow({ event }: { event: UsageEvent }) {
  const { t } = useTranslation();
  const meta = event.meta as Record<string, unknown>;
  const resource = (meta?.resource as string) || '';
  const resourceLabel = resource && RESOURCE_I18N[resource] ? t(RESOURCE_I18N[resource]) : resource;
  const ts = new Date(event.created_at);

  return (
    <div className="flex items-start justify-between gap-2 py-2 border-b border-border last:border-0">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-xs shrink-0">
            {event.event_type}
          </Badge>
          {resourceLabel && (
            <span className="text-xs text-muted-foreground truncate">{resourceLabel}</span>
          )}
        </div>
        {meta?.current !== undefined && meta?.limit !== undefined && (
          <p className="text-xs text-muted-foreground mt-0.5">
            {t('usage.eventDetail', { current: String(meta.current), limit: String(meta.limit) })}
          </p>
        )}
      </div>
      <time className="text-xs text-muted-foreground whitespace-nowrap" dateTime={event.created_at}>
        {ts.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}{' '}
        {ts.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
      </time>
    </div>
  );
}

export function WorkspaceUsagePanel() {
  const { t } = useTranslation();
  const { metrics, events, isLoading, eventsLoading, currentPlan } = useWorkspaceUsage();

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-40" />
        </CardHeader>
        <CardContent className="space-y-4">
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} className="space-y-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-2 w-full" />
            </div>
          ))}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <Tabs defaultValue="usage">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base font-semibold text-foreground flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              {t('usage.title')}
            </CardTitle>
            {currentPlan && (
              <Badge variant="secondary" className="text-xs">
                {currentPlan.name}
              </Badge>
            )}
          </div>
          <TabsList className="mt-2">
            <TabsTrigger value="usage" className="text-xs gap-1">
              <BarChart3 className="h-3 w-3" />
              {t('usage.tabUsage')}
            </TabsTrigger>
            <TabsTrigger value="activity" className="text-xs gap-1">
              <Activity className="h-3 w-3" />
              {t('usage.tabActivity')}
            </TabsTrigger>
          </TabsList>
        </CardHeader>

        <CardContent>
          <TabsContent value="usage" className="mt-0 space-y-4">
            {metrics.map(m => (
              <UsageBar key={m.key} metric={m} />
            ))}
            {metrics.length === 0 && (
              <p className="text-sm text-muted-foreground">{t('usage.noData')}</p>
            )}
          </TabsContent>

          <TabsContent value="activity" className="mt-0">
            {eventsLoading ? (
              <div className="space-y-2">
                {[1, 2, 3].map(i => <Skeleton key={i} className="h-10 w-full" />)}
              </div>
            ) : events.length > 0 ? (
              <div className="max-h-64 overflow-y-auto">
                {events.map(e => (
                  <EventRow key={e.id} event={e} />
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground py-4 text-center">
                {t('usage.noEvents')}
              </p>
            )}
          </TabsContent>
        </CardContent>
      </Tabs>
    </Card>
  );
}
