import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ShieldAlert, RefreshCw } from 'lucide-react';
import {
  useCompanyRisk,
  getRiskLabel,
  getRiskColor,
  getRiskBgColor,
  getRiskBarColor,
  computeRiskLevel,
} from '@/hooks/useEnterpriseRisk';

const RISK_TYPES = ['execution', 'alignment', 'engagement', 'governance'];

export default function RiskDashboardPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { companyScores, overallScore, compute, isComputing, isLoading } = useCompanyRisk();
  const overallLevel = computeRiskLevel(overallScore);

  if (isLoading) {
    return (
      <div className="mx-auto max-w-4xl space-y-6 pt-2 pb-8">
        <Skeleton className="h-8 w-64" />
        <div className="grid gap-4 grid-cols-2">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-32" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6 pb-8">
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
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => navigate('/enterprise/overview')}>
            {t('risk.fullOverview', 'Full Overview')}
          </Button>
          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => compute(7)} disabled={isComputing}>
            <RefreshCw className={`h-3.5 w-3.5 ${isComputing ? 'animate-spin' : ''}`} />
            {isComputing ? t('risk.computing', 'Computing...') : t('risk.recompute', 'Recompute')}
          </Button>
        </div>
      </div>

      <Card className={`border ${getRiskBgColor(overallLevel)}`}>
        <CardContent className="py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`text-3xl font-bold ${getRiskColor(overallLevel)}`}>{overallScore}</div>
            <div>
              <p className="text-sm font-medium text-foreground">{t('risk.overallRisk', 'Overall Risk Score')}</p>
              <p className="text-xs text-muted-foreground capitalize">{overallLevel}</p>
            </div>
          </div>
          <Badge variant="outline" className={`capitalize ${getRiskColor(overallLevel)} border-current`}>{overallLevel}</Badge>
        </CardContent>
      </Card>

      <div className="grid gap-4 grid-cols-2">
        {RISK_TYPES.map(type => {
          const score = companyScores.find(s => s.risk_type === type);
          const value = score?.risk_score ?? 0;
          const level = score?.risk_level || 'low';
          return (
            <Card key={type} className={`border ${getRiskBgColor(level)}`}>
              <CardContent className="pt-4 pb-4">
                <p className="text-xs font-medium text-muted-foreground mb-1">{getRiskLabel(type)}</p>
                <div className={`text-2xl font-bold ${getRiskColor(level)}`}>{value}</div>
                <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden mt-2">
                  <div className={`h-full rounded-full ${getRiskBarColor(level)}`} style={{ width: `${value}%` }} />
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {companyScores.length === 0 && (
        <Card className="border-border bg-card">
          <CardContent className="py-16 text-center">
            <ShieldAlert className="h-10 w-10 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-base font-medium text-foreground mb-1">{t('risk.emptyTitle', 'No risk data yet')}</h3>
            <p className="text-sm text-muted-foreground max-w-sm mx-auto mb-4">{t('risk.emptyDesc', 'Click "Recompute" to run your first enterprise risk assessment.')}</p>
            <Button onClick={() => compute(7)} disabled={isComputing} size="sm">
              <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${isComputing ? 'animate-spin' : ''}`} />
              {t('risk.runFirst', 'Run Assessment')}
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
