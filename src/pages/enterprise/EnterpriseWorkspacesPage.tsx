import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  ShieldAlert, TrendingUp, TrendingDown, Minus, ArrowRight, Building2,
} from 'lucide-react';
import {
  useCompanyRisk,
  getRiskLabel,
  getRiskColor,
  getRiskBgColor,
  getRiskBarColor,
} from '@/hooks/useEnterpriseRisk';

const RISK_TYPES = ['execution', 'alignment', 'engagement', 'governance'];

export default function EnterpriseWorkspacesPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { rankedWorkspaces, isLoading } = useCompanyRisk();

  if (isLoading) {
    return (
      <div className="mx-auto max-w-5xl space-y-6 pt-2 pb-8">
        <Skeleton className="h-8 w-72" />
        {[1, 2, 3].map(i => <Skeleton key={i} className="h-20" />)}
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
            {t('risk.workspacesTitle', 'Workspace Risk Comparison')}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {t('risk.workspacesSubtitle', 'Compare risk scores across all workspaces')}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => navigate('/enterprise/overview')}>
          {t('risk.backToOverview', 'Back to Overview')}
        </Button>
      </div>

      {/* Table */}
      {rankedWorkspaces.length === 0 ? (
        <Card className="border-border bg-card">
          <CardContent className="py-16 text-center">
            <ShieldAlert className="h-10 w-10 text-muted-foreground mx-auto mb-4" />
            <p className="text-sm text-muted-foreground">
              {t('risk.noWorkspaceData', 'No workspace risk data. Run a computation from the Overview page.')}
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-border bg-card overflow-hidden">
          {/* Header row */}
          <div className="grid grid-cols-[1fr_repeat(4,80px)_60px_40px] gap-2 px-4 py-3 bg-muted/50 border-b border-border text-xs font-medium text-muted-foreground uppercase tracking-wider">
            <span>{t('risk.workspace', 'Workspace')}</span>
            {RISK_TYPES.map(type => (
              <span key={type} className="text-center">{getRiskLabel(type).split(' ')[0]}</span>
            ))}
            <span className="text-center">{t('risk.delta', 'Δ 7d')}</span>
            <span></span>
          </div>

          {/* Data rows */}
          {rankedWorkspaces.map(ws => (
            <div
              key={ws.workspace_id}
              className="grid grid-cols-[1fr_repeat(4,80px)_60px_40px] gap-2 px-4 py-3 border-b border-border last:border-0 hover:bg-secondary/30 cursor-pointer transition-colors items-center"
              onClick={() => navigate(`/enterprise/workspaces/${ws.workspace_id}`)}
            >
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground truncate">{ws.name}</p>
                <Badge
                  variant="outline"
                  className={`text-[10px] mt-0.5 capitalize ${getRiskColor(ws.max_level)} border-current`}
                >
                  {ws.max_level}
                </Badge>
              </div>
              {RISK_TYPES.map(type => {
                const s = ws.scores.find(sc => sc.risk_type === type);
                const score = s?.risk_score ?? 0;
                const level = s?.risk_level || 'low';
                return (
                  <div key={type} className="text-center">
                    <span className={`text-sm font-bold ${getRiskColor(level)}`}>{score}</span>
                    <div className="w-full h-1 bg-muted rounded-full overflow-hidden mt-1 mx-auto max-w-[60px]">
                      <div className={`h-full rounded-full ${getRiskBarColor(level)}`} style={{ width: `${score}%` }} />
                    </div>
                  </div>
                );
              })}
              <div className="text-center">
                {ws.delta !== 0 ? (
                  <span className={`text-xs font-medium flex items-center justify-center gap-0.5 ${ws.delta > 0 ? 'text-red-500' : 'text-emerald-500'}`}>
                    {ws.delta > 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                    {ws.delta > 0 ? '+' : ''}{ws.delta}
                  </span>
                ) : (
                  <Minus className="h-3 w-3 text-muted-foreground mx-auto" />
                )}
              </div>
              <div className="flex justify-center">
                <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
              </div>
            </div>
          ))}
        </Card>
      )}
    </div>
  );
}
