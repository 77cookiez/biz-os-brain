import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useWorkspace } from '@/contexts/WorkspaceContext';

export interface RiskScore {
  risk_type: string;
  risk_score: number;
  risk_level: string;
  drivers: Array<{ factor: string; value: number; ratio?: number }>;
  computed_at: string;
}

export interface RiskSnapshot {
  risk_type: string;
  risk_score: number;
  risk_level: string;
  snapshot_date: string;
}

export interface RiskForecast {
  risk_type: string;
  forecast_date: string;
  predicted_score: number;
  confidence: number;
}

const RISK_LABELS: Record<string, string> = {
  execution: 'Execution Risk',
  alignment: 'Alignment Risk',
  engagement: 'Engagement Risk',
  governance: 'Governance Risk',
};

const RISK_DESCRIPTIONS: Record<string, string> = {
  execution: 'Overdue, unassigned, or stagnant tasks',
  alignment: 'Goals without plans or unlinked tasks',
  engagement: 'Team activity and communication levels',
  governance: 'Admin actions frequency and role changes',
};

export function getRiskLabel(type: string) {
  return RISK_LABELS[type] || type;
}

export function getRiskDescription(type: string) {
  return RISK_DESCRIPTIONS[type] || '';
}

export function getRiskColor(level: string) {
  switch (level) {
    case 'low': return 'text-emerald-500';
    case 'moderate': return 'text-yellow-500';
    case 'elevated': return 'text-orange-500';
    case 'high': return 'text-red-500';
    case 'critical': return 'text-destructive';
    default: return 'text-muted-foreground';
  }
}

export function getRiskBgColor(level: string) {
  switch (level) {
    case 'low': return 'bg-emerald-500/10 border-emerald-500/20';
    case 'moderate': return 'bg-yellow-500/10 border-yellow-500/20';
    case 'elevated': return 'bg-orange-500/10 border-orange-500/20';
    case 'high': return 'bg-red-500/10 border-red-500/20';
    case 'critical': return 'bg-destructive/10 border-destructive/20';
    default: return 'bg-muted/50 border-border';
  }
}

export function useEnterpriseRisk() {
  const { currentWorkspace } = useWorkspace();
  const wsId = currentWorkspace?.id;
  const queryClient = useQueryClient();

  const { data: scores = [], isLoading: scoresLoading } = useQuery({
    queryKey: ['enterprise-risk-scores', wsId],
    queryFn: async () => {
      if (!wsId) return [];
      const { data, error } = await (supabase as any)
        .from('enterprise_risk_scores')
        .select('risk_type, risk_score, risk_level, drivers, computed_at')
        .eq('workspace_id', wsId);
      if (error) throw error;
      return (data as RiskScore[]) || [];
    },
    enabled: !!wsId,
    staleTime: 60_000,
  });

  const { data: snapshots = [], isLoading: snapshotsLoading } = useQuery({
    queryKey: ['risk-snapshots', wsId],
    queryFn: async () => {
      if (!wsId) return [];
      const { data, error } = await (supabase as any)
        .from('risk_snapshots')
        .select('risk_type, risk_score, risk_level, snapshot_date')
        .eq('workspace_id', wsId)
        .order('snapshot_date', { ascending: true })
        .limit(120); // ~30 days * 4 types
      if (error) throw error;
      return (data as RiskSnapshot[]) || [];
    },
    enabled: !!wsId,
    staleTime: 60_000,
  });

  const { data: forecasts = [], isLoading: forecastsLoading } = useQuery({
    queryKey: ['risk-forecasts', wsId],
    queryFn: async () => {
      if (!wsId) return [];
      const { data, error } = await (supabase as any)
        .from('risk_forecasts')
        .select('risk_type, forecast_date, predicted_score, confidence')
        .eq('workspace_id', wsId)
        .order('forecast_date', { ascending: true });
      if (error) throw error;
      return (data as RiskForecast[]) || [];
    },
    enabled: !!wsId,
    staleTime: 60_000,
  });

  const computeMutation = useMutation({
    mutationFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      const resp = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/enterprise-risk-compute`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify({ workspace_id: wsId }),
        }
      );
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({ error: 'Failed' }));
        throw new Error(err.error);
      }
      return resp.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['enterprise-risk-scores', wsId] });
      queryClient.invalidateQueries({ queryKey: ['risk-snapshots', wsId] });
      queryClient.invalidateQueries({ queryKey: ['risk-forecasts', wsId] });
    },
  });

  // Overall risk = max of all scores
  const overallScore = scores.length > 0
    ? Math.max(...scores.map(s => s.risk_score))
    : 0;

  // Trend from snapshots (compare latest to 7 days ago)
  function getTrend(riskType: string): 'up' | 'down' | 'stable' {
    const typeSnaps = snapshots.filter(s => s.risk_type === riskType);
    if (typeSnaps.length < 2) return 'stable';
    const latest = typeSnaps[typeSnaps.length - 1].risk_score;
    const prev = typeSnaps[Math.max(0, typeSnaps.length - 7)].risk_score;
    if (latest > prev + 5) return 'up';
    if (latest < prev - 5) return 'down';
    return 'stable';
  }

  return {
    scores,
    snapshots,
    forecasts,
    overallScore,
    getTrend,
    compute: computeMutation.mutate,
    isComputing: computeMutation.isPending,
    isLoading: scoresLoading || snapshotsLoading || forecastsLoading,
  };
}
