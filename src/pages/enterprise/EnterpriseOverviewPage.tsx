import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  ShieldAlert, TrendingUp, TrendingDown, Minus,
  RefreshCw, AlertTriangle, Shield, Activity, Users, Building2, ArrowRight,
} from 'lucide-react';
import {
  useCompanyRisk,
  getRiskLabel,
  getRiskColor,
  getRiskBgColor,
  getRiskBarColor,
  computeRiskLevel,
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

export default function EnterpriseOverviewPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const {
    companyScores,
    companySnapshots,
    forecasts,
    overallScore,
    rankedWorkspaces,
    compute,
    isComputing,
    isLoading,
  } = useCompanyRisk();

  const overallLevel = computeRiskLevel(overallScore);

  // Company-level forecast chart
  const companyForecasts = forecasts.filter(f => !f.workspace_id);
  const forecastChartData = (() => {
    const dateMap: Record<string, Record<string, number>> = {};
    companyForecasts.forEach(f => {
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

  // Trend from company snapshots
  const getTrend = (riskType: string): 'up' | 'down' | 'stable' => {
    if (companySnapshots.length < 2) return 'stable';
    const latest = companySnapshots[companySnapshots.length - 1]?.metrics?.risks?.[riskType];
    const prev = companySnapshots[Math.max(0, companySnapshots.length - 7)]?.metrics?.risks?.[riskType];
    if (latest == null || prev == null) return 'stable';
    if (latest > prev + 5) return 'up';
    if (latest < prev - 5) return 'down';
    return 'stable';
  };

  // Worst 5 and most improved/declined
  const worst5 = rankedWorkspaces.slice(0, 5);
  const mostImproved = [...rankedWorkspaces].sort((a, b) => a.delta - b.delta).slice(0, 3);
  const mostDeclined = [...rankedWorkspaces].sort((a, b) => b.delta - a.delta).filter(w => w.delta > 0).slice(0, 3);

  if (isLoading) {
    return (
      <div className="mx-auto max-w-5xl space-y-6 pt-2 pb-8">
        <Skeleton className="h-8 w-72" />
        <Skeleton className="h-20" />
        <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-32" />)}
        </div>
        <Skeleton className="h-64" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6 pb-8">
      {/* Header */}
      <div className="pt-2 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
            <Building2 className="h-5 w-5 text-primary" />
            {t('risk.overviewTitle', 'Enterprise Risk Overview')}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {t('risk.overviewSubtitle', 'Company-wide risk across all workspaces')}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate('/enterprise/workspaces')}
          >
            {t('risk.compareWorkspaces', 'Compare Workspaces')}
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={() => compute()}
            disabled={isComputing}
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isComputing ? 'animate-spin' : ''}`} />
            {isComputing ? t('risk.computing', 'Computing...') : t('risk.recompute', 'Recompute')}
          </Button>
        </div>
      </div>

      {/* Overall Banner */}
      <Card className={`border ${getRiskBgColor(overallLevel)}`}>
        <CardContent className="py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`text-3xl font-bold ${getRiskColor(overallLevel)}`}>
              {overallScore}
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">
                {t('risk.companyRisk', 'Company Risk Score')}
              </p>
              <p className="text-xs text-muted-foreground capitalize">{overallLevel}</p>
            </div>
          </div>
          <Badge variant="outline" className={`capitalize ${getRiskColor(overallLevel)} border-current`}>
            {overallLevel}
          </Badge>
        </CardContent>
      </Card>

      {/* Risk Cards */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        {RISK_TYPES.map(type => {
          const score = companyScores.find(s => s.risk_type === type);
          const Icon = RISK_ICONS[type] || ShieldAlert;
          const trend = getTrend(type);
          const level = score?.risk_level || 'moderate';
          const value = score?.risk_score ?? 0;
          const worst = score?.metadata?.worst_workspace;

          return (
            <Card key={type} className={`border ${getRiskBgColor(level)}`}>
              <CardHeader className="pb-1 pt-4 px-4">
                <CardTitle className="text-xs font-medium flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <Icon className={`h-3.5 w-3.5 ${getRiskColor(level)}`} />
                    {getRiskLabel(type)}
                  </span>
                  {trend === 'up' && <TrendingUp className="h-3 w-3 text-red-500" />}
                  {trend === 'down' && <TrendingDown className="h-3 w-3 text-emerald-500" />}
                  {trend === 'stable' && <Minus className="h-3 w-3 text-muted-foreground" />}
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-4">
                <div className={`text-2xl font-bold ${getRiskColor(level)}`}>{value}</div>
                <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden mt-2 mb-2">
                  <div className={`h-full rounded-full ${getRiskBarColor(level)}`} style={{ width: `${value}%` }} />
                </div>
                {worst && worst.score > 40 && (
                  <p className="text-[10px] text-muted-foreground truncate">
                    Worst: {worst.name} ({worst.score})
                  </p>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Worst 5 Workspaces */}
      {worst5.length > 0 && (
        <Card className="border-border bg-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-orange-500" />
              {t('risk.worst5', 'Highest Risk Workspaces')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {worst5.map((ws, idx) => (
              <div
                key={ws.workspace_id}
                className="flex items-center gap-3 p-3 rounded-lg bg-secondary/50 cursor-pointer hover:bg-secondary/80 transition-colors"
                onClick={() => navigate(`/enterprise/workspaces/${ws.workspace_id}`)}
              >
                <span className="text-xs font-bold text-muted-foreground w-5 text-center">{idx + 1}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{ws.name}</p>
                  <div className="flex gap-2 mt-1">
                    {ws.scores.map(s => (
                      <Badge
                        key={s.risk_type}
                        variant="outline"
                        className={`text-[10px] ${getRiskColor(s.risk_level)} border-current`}
                      >
                        {s.risk_type.slice(0, 4)}: {s.risk_score}
                      </Badge>
                    ))}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className={`text-lg font-bold ${getRiskColor(ws.max_level)}`}>{ws.max_score}</span>
                  {ws.delta !== 0 && (
                    <span className={`text-xs flex items-center ${ws.delta > 0 ? 'text-red-500' : 'text-emerald-500'}`}>
                      {ws.delta > 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                      {Math.abs(ws.delta)}
                    </span>
                  )}
                  <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Most Improved / Most Declined */}
      <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
        {mostImproved.length > 0 && mostImproved[0].delta < 0 && (
          <Card className="border-border bg-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-emerald-500 uppercase tracking-wider flex items-center gap-2">
                <TrendingDown className="h-4 w-4" />
                {t('risk.mostImproved', 'Most Improved (7-day)')}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {mostImproved.filter(w => w.delta < 0).map(ws => (
                <div key={ws.workspace_id} className="flex items-center justify-between p-2 rounded bg-secondary/30">
                  <span className="text-sm text-foreground truncate">{ws.name}</span>
                  <span className="text-sm font-medium text-emerald-500">{ws.delta}</span>
                </div>
              ))}
            </CardContent>
          </Card>
        )}
        {mostDeclined.length > 0 && (
          <Card className="border-border bg-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-red-500 uppercase tracking-wider flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                {t('risk.mostDeclined', 'Most Declined (7-day)')}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {mostDeclined.map(ws => (
                <div key={ws.workspace_id} className="flex items-center justify-between p-2 rounded bg-secondary/30">
                  <span className="text-sm text-foreground truncate">{ws.name}</span>
                  <span className="text-sm font-medium text-red-500">+{ws.delta}</span>
                </div>
              ))}
            </CardContent>
          </Card>
        )}
      </div>

      {/* 30-Day Forecast */}
      {forecastChartData.length > 0 && (
        <Card className="border-border bg-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" />
              {t('risk.forecastTitle', '30-Day Risk Forecast')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ChartContainer config={chartConfig} className="h-64 w-full">
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
                  />
                ))}
              </AreaChart>
            </ChartContainer>
          </CardContent>
        </Card>
      )}

      {/* Empty State */}
      {companyScores.length === 0 && (
        <Card className="border-border bg-card">
          <CardContent className="py-16 text-center">
            <ShieldAlert className="h-10 w-10 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-base font-medium text-foreground mb-1">
              {t('risk.emptyTitle', 'No risk data yet')}
            </h3>
            <p className="text-sm text-muted-foreground max-w-sm mx-auto mb-4">
              {t('risk.emptyDesc', 'Click "Recompute" to run your first enterprise risk assessment.')}
            </p>
            <Button onClick={() => compute()} disabled={isComputing} size="sm">
              <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${isComputing ? 'animate-spin' : ''}`} />
              {t('risk.runFirst', 'Run Assessment')}
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
