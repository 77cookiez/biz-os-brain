import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Grid3X3 } from 'lucide-react';
import { RiskSnapshot, computeRiskLevel, getRiskLabel } from '@/hooks/useEnterpriseRisk';

const RISK_TYPES = ['execution', 'alignment', 'engagement', 'governance'];

function getHeatColor(score: number): string {
  if (score <= 20) return 'bg-emerald-500/80';
  if (score <= 40) return 'bg-yellow-500/80';
  if (score <= 60) return 'bg-orange-500/80';
  if (score <= 80) return 'bg-red-500/80';
  return 'bg-destructive/80';
}

function getWeekLabel(dateStr: string): string {
  const d = new Date(dateStr);
  const month = d.toLocaleString('default', { month: 'short' });
  const day = d.getDate();
  return `${month} ${day}`;
}

interface RiskHeatmapProps {
  snapshots: RiskSnapshot[];
}

export default function RiskHeatmap({ snapshots }: RiskHeatmapProps) {
  const { t } = useTranslation();

  const weeklyData = useMemo(() => {
    // Filter company-level snapshots only
    const companySnaps = snapshots
      .filter(s => !s.workspace_id)
      .sort((a, b) => a.snapshot_date.localeCompare(b.snapshot_date));

    if (companySnaps.length === 0) return [];

    // Group by week (7-day buckets from the end)
    const weeks: Array<{ label: string; risks: Record<string, number> }> = [];
    const bucketSize = 7;
    let i = companySnaps.length - 1;

    while (i >= 0 && weeks.length < 8) {
      const endIdx = i;
      const startIdx = Math.max(0, i - bucketSize + 1);
      const bucket = companySnaps.slice(startIdx, endIdx + 1);

      const avgRisks: Record<string, number[]> = {};
      bucket.forEach(snap => {
        const risks = snap.metrics?.risks as Record<string, number> | undefined;
        if (risks) {
          Object.entries(risks).forEach(([type, score]) => {
            if (!avgRisks[type]) avgRisks[type] = [];
            avgRisks[type].push(score);
          });
        }
      });

      const averaged: Record<string, number> = {};
      Object.entries(avgRisks).forEach(([type, scores]) => {
        averaged[type] = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
      });

      weeks.unshift({
        label: getWeekLabel(companySnaps[startIdx].snapshot_date),
        risks: averaged,
      });

      i = startIdx - 1;
    }

    return weeks;
  }, [snapshots]);

  if (weeklyData.length < 2) return null;

  return (
    <Card className="border-border bg-card">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-2">
          <Grid3X3 className="h-4 w-4 text-primary" />
          {t('risk.heatmapTitle', 'Risk Heatmap (Weekly)')}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[400px]">
            <thead>
              <tr>
                <th className="text-xs font-medium text-muted-foreground text-right pr-3 pb-2 w-28">
                  {t('risk.dimension', 'Dimension')}
                </th>
                {weeklyData.map((week, idx) => (
                  <th key={idx} className="text-[10px] text-muted-foreground text-center pb-2 px-0.5">
                    {week.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {RISK_TYPES.map(type => (
                <tr key={type}>
                  <td className="text-xs font-medium text-foreground text-right pr-3 py-1">
                    {getRiskLabel(type)}
                  </td>
                  {weeklyData.map((week, idx) => {
                    const score = week.risks[type] ?? 0;
                    const level = computeRiskLevel(score);
                    return (
                      <td key={idx} className="px-0.5 py-1">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div
                              className={`mx-auto w-full aspect-square max-w-10 rounded-sm ${getHeatColor(score)} cursor-default transition-transform hover:scale-110`}
                            />
                          </TooltipTrigger>
                          <TooltipContent side="top" className="text-xs">
                            <p className="font-medium">{getRiskLabel(type)}</p>
                            <p>Score: {score} ({level})</p>
                            <p className="text-muted-foreground">{week.label}</p>
                          </TooltipContent>
                        </Tooltip>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {/* Legend */}
        <div className="flex items-center justify-center gap-3 mt-4 flex-wrap">
          {[
            { label: 'Low', cls: 'bg-emerald-500/80' },
            { label: 'Moderate', cls: 'bg-yellow-500/80' },
            { label: 'Elevated', cls: 'bg-orange-500/80' },
            { label: 'High', cls: 'bg-red-500/80' },
            { label: 'Critical', cls: 'bg-destructive/80' },
          ].map(item => (
            <div key={item.label} className="flex items-center gap-1.5">
              <div className={`w-3 h-3 rounded-sm ${item.cls}`} />
              <span className="text-[10px] text-muted-foreground">{item.label}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
