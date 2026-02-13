import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  ShieldAlert, TrendingUp, TrendingDown, Minus,
  RefreshCw, AlertTriangle, Shield, Activity, Users,
} from 'lucide-react';
import {
  useEnterpriseRisk,
  getRiskLabel,
  getRiskDescription,
  getRiskColor,
  getRiskBgColor,
} from '@/hooks/useEnterpriseRisk';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  Area,
  AreaChart,
} from 'recharts';

const RISK_ICONS: Record<string, React.ElementType> = {
  execution: AlertTriangle,
  alignment: Activity,
  engagement: Users,
  governance: Shield,
};

const RISK_TYPES = ['execution', 'alignment', 'engagement', 'governance'];

export default function RiskDashboardPage() {
  const { t } = useTranslation();
  const {
    scores,
    snapshots,
    forecasts,
    overallScore,
    getTrend,
    compute,
    isComputing,
    isLoading,
  } = useEnterpriseRisk();

  const overallLevel =
    overallScore <= 20 ? 'low' :
    overallScore <= 40 ? 'moderate' :
    overallScore <= 60 ? 'elevated' :
    overallScore <= 80 ? 'high' : 'critical';

  // Prepare forecast chart data
  const forecastChartData = (() => {
    const dateMap: Record<string, Record<string, number>> = {};
    forecasts.forEach((f) => {
      if (!dateMap[f.forecast_date]) dateMap[f.forecast_date] = {};
      dateMap[f.forecast_date][f.risk_type] = f.predicted_score;
    });
    return Object.entries(dateMap)
      .map(([date, values]) => ({ date: date.slice(5), ...values }))
      .slice(0, 30);
  })();

  const chartConfig = {
    execution: { label: 'Execution', color: 'hsl(var(--destructive))' },
    alignment: { label: 'Alignment', color: 'hsl(var(--primary))' },
    engagement: { label: 'Engagement', color: 'hsl(25, 95%, 53%)' },
    governance: { label: 'Governance', color: 'hsl(280, 65%, 60%)' },
  };

  if (isLoading) {
    return (
      <div className="mx-auto max-w-4xl space-y-6 pt-2 pb-8">
        <Skeleton className="h-8 w-64" />
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-40" />
          ))}
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
          <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
            <ShieldAlert className="h-5 w-5 text-primary" />
            {t('risk.title', 'Enterprise Risk Dashboard')}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {t('risk.subtitle', 'Real-time risk assessment across 4 dimensions')}
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5"
          onClick={() => compute()}
          disabled={isComputing}
        >
          <RefreshCw className={`h-3.5 w-3.5 ${isComputing ? 'animate-spin' : ''}`} />
          {isComputing
            ? t('risk.computing', 'Computing...')
            : t('risk.recompute', 'Recompute')}
        </Button>
      </div>

      {/* Overall Risk Banner */}
      <Card className={`border ${getRiskBgColor(overallLevel)}`}>
        <CardContent className="py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`text-3xl font-bold ${getRiskColor(overallLevel)}`}>
              {overallScore}
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">
                {t('risk.overallRisk', 'Overall Risk Score')}
              </p>
              <p className="text-xs text-muted-foreground capitalize">{overallLevel}</p>
            </div>
          </div>
          <Badge
            variant="outline"
            className={`capitalize ${getRiskColor(overallLevel)} border-current`}
          >
            {overallLevel}
          </Badge>
        </CardContent>
      </Card>

      {/* Risk Cards Grid */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2">
        {RISK_TYPES.map((type) => {
          const score = scores.find((s) => s.risk_type === type);
          const Icon = RISK_ICONS[type] || ShieldAlert;
          const trend = getTrend(type);
          const level = score?.risk_level || 'moderate';
          const value = score?.risk_score ?? 50;
          const drivers = score?.drivers || [];

          return (
            <Card key={type} className={`border ${getRiskBgColor(level)}`}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <Icon className={`h-4 w-4 ${getRiskColor(level)}`} />
                    {getRiskLabel(type)}
                  </span>
                  <span className="flex items-center gap-1 text-xs text-muted-foreground">
                    {trend === 'up' && (
                      <TrendingUp className="h-3.5 w-3.5 text-red-500" />
                    )}
                    {trend === 'down' && (
                      <TrendingDown className="h-3.5 w-3.5 text-emerald-500" />
                    )}
                    {trend === 'stable' && (
                      <Minus className="h-3.5 w-3.5 text-muted-foreground" />
                    )}
                    {trend}
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-end gap-3 mb-3">
                  <span className={`text-3xl font-bold ${getRiskColor(level)}`}>
                    {value}
                  </span>
                  <span className="text-xs text-muted-foreground mb-1">/100</span>
                </div>

                {/* Progress bar */}
                <div className="w-full h-2 bg-muted rounded-full overflow-hidden mb-3">
                  <div
                    className={`h-full rounded-full transition-all ${
                      level === 'low' ? 'bg-emerald-500' :
                      level === 'moderate' ? 'bg-yellow-500' :
                      level === 'elevated' ? 'bg-orange-500' :
                      level === 'high' ? 'bg-red-500' : 'bg-destructive'
                    }`}
                    style={{ width: `${value}%` }}
                  />
                </div>

                <p className="text-xs text-muted-foreground mb-2">
                  {getRiskDescription(type)}
                </p>

                {drivers.length > 0 && (
                  <div className="space-y-1">
                    {drivers.slice(0, 2).map((d, i) => (
                      <div
                        key={i}
                        className="text-xs flex items-center gap-1.5 text-muted-foreground"
                      >
                        <span className="w-1.5 h-1.5 rounded-full bg-current shrink-0" />
                        <span className="capitalize">
                          {d.factor.replace(/_/g, ' ')}: {d.value}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* 30-Day Forecast Chart */}
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
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 10 }}
                  interval="preserveStartEnd"
                />
                <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Area
                  type="monotone"
                  dataKey="execution"
                  stroke="hsl(var(--destructive))"
                  fill="hsl(var(--destructive))"
                  fillOpacity={0.1}
                  strokeWidth={2}
                />
                <Area
                  type="monotone"
                  dataKey="alignment"
                  stroke="hsl(var(--primary))"
                  fill="hsl(var(--primary))"
                  fillOpacity={0.1}
                  strokeWidth={2}
                />
                <Area
                  type="monotone"
                  dataKey="engagement"
                  stroke="hsl(25, 95%, 53%)"
                  fill="hsl(25, 95%, 53%)"
                  fillOpacity={0.1}
                  strokeWidth={2}
                />
                <Area
                  type="monotone"
                  dataKey="governance"
                  stroke="hsl(280, 65%, 60%)"
                  fill="hsl(280, 65%, 60%)"
                  fillOpacity={0.1}
                  strokeWidth={2}
                />
              </AreaChart>
            </ChartContainer>
          </CardContent>
        </Card>
      )}

      {/* Empty state when no scores */}
      {scores.length === 0 && (
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
