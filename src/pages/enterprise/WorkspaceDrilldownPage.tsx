import { useTranslation } from 'react-i18next';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  ShieldAlert, TrendingUp, TrendingDown, Minus,
  AlertTriangle, Shield, Activity, Users, ArrowLeft,
} from 'lucide-react';
import {
  useCompanyRisk,
  getRiskLabel,
  getRiskDescription,
  getRiskColor,
  getRiskBgColor,
  getRiskBarColor,
} from '@/hooks/useEnterpriseRisk';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid } from 'recharts';

const RISK_ICONS: Record<string, React.ElementType> = {
  execution: AlertTriangle,
  alignment: Activity,
  engagement: Users,
  governance: Shield,
};
const RISK_TYPES = ['execution', 'alignment', 'engagement', 'governance'];

const chartConfig = {
  execution: { label: 'Execution', color: 'hsl(var(--destructive))' },
  alignment: { label: 'Alignment', color: 'hsl(var(--primary))' },
  engagement: { label: 'Engagement', color: 'hsl(25, 95%, 53%)' },
  governance: { label: 'Governance', color: 'hsl(280, 65%, 60%)' },
};

export default function WorkspaceDrilldownPage() {
  const { t } = useTranslation();
  const { workspaceId } = useParams<{ workspaceId: string }>();
  const navigate = useNavigate();
  const {
    workspaceRiskMap,
    workspaceNames,
    snapshots,
    forecasts,
    getWorkspaceDelta,
    isLoading,
  } = useCompanyRisk();

  const wsScores = workspaceRiskMap.get(workspaceId || '') || [];
  const wsName = workspaceNames.get(workspaceId || '') || workspaceId;
  const delta = getWorkspaceDelta(workspaceId || '');

  // Workspace snapshots for trend
  const wsSnapshots = snapshots
    .filter(s => s.workspace_id === workspaceId)
    .sort((a, b) => a.snapshot_date.localeCompare(b.snapshot_date));

  // Trend chart from snapshots
  const trendChartData = wsSnapshots.map(s => ({
    date: s.snapshot_date.slice(5),
    ...((s.metrics?.risks as Record<string, number>) || {}),
  }));

  // Forecast chart
  const wsForecasts = forecasts.filter(f => f.workspace_id === workspaceId);
  const forecastChartData = (() => {
    const dateMap: Record<string, Record<string, number>> = {};
    wsForecasts.forEach(f => {
      (f.forecast || []).forEach((pt: any) => {
        if (!dateMap[pt.date]) dateMap[pt.date] = {};
        dateMap[pt.date][f.risk_type] = pt.score;
      });
    });
    return Object.entries(dateMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, values]) => ({ date: date.slice(5), ...values }))
      .slice(0, 30);
  })();

  const maxScore = wsScores.length > 0 ? Math.max(...wsScores.map(s => s.risk_score)) : 0;
  const maxLevel = maxScore <= 20 ? 'low' : maxScore <= 40 ? 'moderate' : maxScore <= 60 ? 'elevated' : maxScore <= 80 ? 'high' : 'critical';

  if (isLoading) {
    return (
      <div className="mx-auto max-w-4xl space-y-6 pt-2 pb-8">
        <Skeleton className="h-8 w-64" />
        <div className="grid gap-4 grid-cols-2">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-40" />)}
        </div>
        <Skeleton className="h-64" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6 pb-8">
      {/* Header */}
      <div className="pt-2 flex items-center justify-between">
        <div>
          <Button variant="ghost" size="sm" className="gap-1 mb-1 -ml-2" onClick={() => navigate('/enterprise/workspaces')}>
            <ArrowLeft className="h-3.5 w-3.5" />
            {t('risk.backToWorkspaces', 'All Workspaces')}
          </Button>
          <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
            <ShieldAlert className="h-5 w-5 text-primary" />
            {wsName}
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {t('risk.drilldownSubtitle', 'Workspace risk drilldown')}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className={`capitalize ${getRiskColor(maxLevel)} border-current`}>
            {maxLevel}
          </Badge>
          {delta !== 0 && (
            <span className={`text-sm font-medium flex items-center gap-0.5 ${delta > 0 ? 'text-red-500' : 'text-emerald-500'}`}>
              {delta > 0 ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
              {delta > 0 ? '+' : ''}{delta} (7d)
            </span>
          )}
        </div>
      </div>

      {/* Risk Cards */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2">
        {RISK_TYPES.map(type => {
          const s = wsScores.find(sc => sc.risk_type === type);
          const Icon = RISK_ICONS[type] || ShieldAlert;
          const score = s?.risk_score ?? 0;
          const level = s?.risk_level || 'low';
          const drivers = (s?.metadata as any)?.drivers || [];

          return (
            <Card key={type} className={`border ${getRiskBgColor(level)}`}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Icon className={`h-4 w-4 ${getRiskColor(level)}`} />
                  {getRiskLabel(type)}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-end gap-3 mb-3">
                  <span className={`text-3xl font-bold ${getRiskColor(level)}`}>{score}</span>
                  <span className="text-xs text-muted-foreground mb-1">/100</span>
                </div>
                <div className="w-full h-2 bg-muted rounded-full overflow-hidden mb-3">
                  <div className={`h-full rounded-full ${getRiskBarColor(level)}`} style={{ width: `${score}%` }} />
                </div>
                <p className="text-xs text-muted-foreground mb-2">{getRiskDescription(type)}</p>
                {drivers.length > 0 && (
                  <div className="space-y-1">
                    {drivers.slice(0, 3).map((d: any, i: number) => (
                      <div key={i} className="text-xs flex items-center gap-1.5 text-muted-foreground">
                        <span className="w-1.5 h-1.5 rounded-full bg-current shrink-0" />
                        <span className="capitalize">{d.factor.replace(/_/g, ' ')}: {d.value}{d.rate != null ? ` (${d.rate}%)` : ''}</span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Historical Trend */}
      {trendChartData.length > 1 && (
        <Card className="border-border bg-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
              {t('risk.historicalTrend', 'Historical Trend')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ChartContainer config={chartConfig} className="h-48 w-full">
              <AreaChart data={trendChartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
                <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} />
                <ChartTooltip content={<ChartTooltipContent />} />
                {RISK_TYPES.map(type => (
                  <Area
                    key={type}
                    type="monotone"
                    dataKey={type}
                    stroke={chartConfig[type as keyof typeof chartConfig].color}
                    fill={chartConfig[type as keyof typeof chartConfig].color}
                    fillOpacity={0.05}
                    strokeWidth={2}
                  />
                ))}
              </AreaChart>
            </ChartContainer>
          </CardContent>
        </Card>
      )}

      {/* Forecast */}
      {forecastChartData.length > 0 && (
        <Card className="border-border bg-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" />
              {t('risk.forecastTitle', '30-Day Risk Forecast')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ChartContainer config={chartConfig} className="h-48 w-full">
              <AreaChart data={forecastChartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
                <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} />
                <ChartTooltip content={<ChartTooltipContent />} />
                {RISK_TYPES.map(type => (
                  <Area
                    key={type}
                    type="monotone"
                    dataKey={type}
                    stroke={chartConfig[type as keyof typeof chartConfig].color}
                    fill={chartConfig[type as keyof typeof chartConfig].color}
                    fillOpacity={0.1}
                    strokeWidth={2}
                    strokeDasharray="5 5"
                  />
                ))}
              </AreaChart>
            </ChartContainer>
          </CardContent>
        </Card>
      )}

      {/* Mitigations (read-only suggestions) */}
      <Card className="border-border bg-card">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
            {t('risk.mitigations', 'Recommended Mitigations')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground mb-3">
            {t('risk.mitigationsNote', 'These are read-only suggestions. Use the Brain to plan actions.')}
          </p>
          <div className="space-y-2">
            {wsScores
              .filter(s => s.risk_score > 40)
              .sort((a, b) => b.risk_score - a.risk_score)
              .map(s => {
                const suggestions: Record<string, string> = {
                  execution: 'Review overdue/stagnant tasks; assign owners; set realistic deadlines.',
                  alignment: 'Link orphan tasks to goals; create plans for goals missing them.',
                  engagement: 'Encourage team check-ins; use chat for discussions; run weekly reviews.',
                  governance: 'Stabilize role assignments; review admin action frequency; ensure delegation.',
                };
                return (
                  <div key={s.risk_type} className="p-3 rounded-lg bg-secondary/50">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant="outline" className={`text-[10px] capitalize ${getRiskColor(s.risk_level)} border-current`}>
                        {getRiskLabel(s.risk_type)}: {s.risk_score}
                      </Badge>
                    </div>
                    <p className="text-xs text-foreground">{suggestions[s.risk_type] || 'Review and address risk drivers.'}</p>
                  </div>
                );
              })}
            {wsScores.filter(s => s.risk_score > 40).length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-4">
                {t('risk.noMitigations', 'All risk scores are within acceptable range.')}
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
