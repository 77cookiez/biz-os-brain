import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useWorkspace } from '@/contexts/WorkspaceContext';

// ===== Types =====
export interface CompanyRiskScore {
  risk_type: string;
  risk_score: number;
  risk_level: string;
  computed_at: string;
  window_days: number;
  metadata: {
    worst_workspace?: { name: string; score: number };
    workspace_breakdown?: Array<{
      workspace_id: string;
      name: string;
      score: number;
      level: string;
      weight: number;
    }>;
    total_workspaces?: number;
    total_members?: number;
  };
}

export interface WorkspaceRiskScore {
  workspace_id: string;
  risk_type: string;
  risk_score: number;
  risk_level: string;
  computed_at: string;
  metadata: { drivers?: any[] };
}

export interface RiskSnapshot {
  company_id: string;
  workspace_id: string | null;
  snapshot_date: string;
  metrics: Record<string, any>;
}

export interface RiskForecast {
  workspace_id: string | null;
  risk_type: string;
  forecast: Array<{ date: string; score: number; confidence: number }>;
  model_meta: Record<string, any>;
}

// ===== Helpers =====
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

export const getRiskLabel = (type: string) => RISK_LABELS[type] || type;
export const getRiskDescription = (type: string) => RISK_DESCRIPTIONS[type] || '';

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

export function getRiskBarColor(level: string) {
  switch (level) {
    case 'low': return 'bg-emerald-500';
    case 'moderate': return 'bg-yellow-500';
    case 'elevated': return 'bg-orange-500';
    case 'high': return 'bg-red-500';
    case 'critical': return 'bg-destructive';
    default: return 'bg-muted';
  }
}

export function computeRiskLevel(score: number): string {
  if (score <= 20) return 'low';
  if (score <= 40) return 'moderate';
  if (score <= 60) return 'elevated';
  if (score <= 80) return 'high';
  return 'critical';
}

// ===== Company-level hook =====
export function useCompanyRisk() {
  const { currentCompany } = useWorkspace();
  const companyId = currentCompany?.id;
  const queryClient = useQueryClient();

  const { data: companyScores = [], isLoading: scoresLoading } = useQuery({
    queryKey: ['company-risk-scores', companyId],
    queryFn: async () => {
      if (!companyId) return [];
      const { data, error } = await (supabase as any)
        .from('company_risk_scores')
        .select('risk_type, risk_score, risk_level, computed_at, window_days, metadata')
        .eq('company_id', companyId);
      if (error) throw error;
      return (data as CompanyRiskScore[]) || [];
    },
    enabled: !!companyId,
    staleTime: 60_000,
  });

  const { data: workspaceScores = [], isLoading: wsScoresLoading } = useQuery({
    queryKey: ['workspace-risk-scores', companyId],
    queryFn: async () => {
      if (!companyId) return [];
      const { data, error } = await (supabase as any)
        .from('workspace_risk_scores')
        .select('workspace_id, risk_type, risk_score, risk_level, computed_at, metadata')
        .eq('company_id', companyId);
      if (error) throw error;
      return (data as WorkspaceRiskScore[]) || [];
    },
    enabled: !!companyId,
    staleTime: 60_000,
  });

  const { data: snapshots = [], isLoading: snapshotsLoading } = useQuery({
    queryKey: ['company-risk-snapshots', companyId],
    queryFn: async () => {
      if (!companyId) return [];
      const { data, error } = await (supabase as any)
        .from('risk_snapshots')
        .select('company_id, workspace_id, snapshot_date, metrics')
        .eq('company_id', companyId)
        .order('snapshot_date', { ascending: true })
        .limit(500);
      if (error) throw error;
      return (data as RiskSnapshot[]) || [];
    },
    enabled: !!companyId,
    staleTime: 60_000,
  });

  const { data: forecasts = [], isLoading: forecastsLoading } = useQuery({
    queryKey: ['company-risk-forecasts', companyId],
    queryFn: async () => {
      if (!companyId) return [];
      const { data, error } = await (supabase as any)
        .from('risk_forecasts')
        .select('workspace_id, risk_type, forecast, model_meta')
        .eq('company_id', companyId);
      if (error) throw error;
      return (data as RiskForecast[]) || [];
    },
    enabled: !!companyId,
    staleTime: 60_000,
  });

  const computeMutation = useMutation({
    mutationFn: async (windowDays?: number) => {
      const days = windowDays ?? 7;
      const { data: { session } } = await supabase.auth.getSession();
      const resp = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/enterprise-risk-compute`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session?.access_token}`,
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify({ company_id: companyId, window_days: days }),
        }
      );
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({ error: 'Failed' }));
        throw new Error(err.error);
      }
      return resp.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['company-risk-scores', companyId] });
      queryClient.invalidateQueries({ queryKey: ['workspace-risk-scores', companyId] });
      queryClient.invalidateQueries({ queryKey: ['company-risk-snapshots', companyId] });
      queryClient.invalidateQueries({ queryKey: ['company-risk-forecasts', companyId] });
    },
  });

  // Derived data
  const overallScore = companyScores.length > 0
    ? Math.max(...companyScores.map(s => s.risk_score))
    : 0;

  // Group workspace scores by workspace
  const workspaceRiskMap = new Map<string, WorkspaceRiskScore[]>();
  workspaceScores.forEach(ws => {
    const existing = workspaceRiskMap.get(ws.workspace_id) || [];
    existing.push(ws);
    workspaceRiskMap.set(ws.workspace_id, existing);
  });

  // Company snapshots only
  const companySnapshots = snapshots.filter(s => !s.workspace_id);

  // Get workspace names from breakdown metadata
  const workspaceNames = new Map<string, string>();
  companyScores.forEach(s => {
    s.metadata?.workspace_breakdown?.forEach(wb => {
      workspaceNames.set(wb.workspace_id, wb.name);
    });
  });

  // Compute 7-day delta per workspace
  function getWorkspaceDelta(wsId: string): number {
    const wsSnaps = snapshots
      .filter(s => s.workspace_id === wsId)
      .sort((a, b) => a.snapshot_date.localeCompare(b.snapshot_date));
    if (wsSnaps.length < 2) return 0;
    const latest = wsSnaps[wsSnaps.length - 1].metrics?.risks;
    const prev = wsSnaps[Math.max(0, wsSnaps.length - 7)].metrics?.risks;
    if (!latest || !prev) return 0;
    const latestMax = Math.max(...Object.values(latest as Record<string, number>));
    const prevMax = Math.max(...Object.values(prev as Record<string, number>));
    return latestMax - prevMax;
  }

  // Worst 5 workspaces
  const rankedWorkspaces = Array.from(workspaceRiskMap.entries())
    .map(([wsId, scores]) => {
      const maxScore = Math.max(...scores.map(s => s.risk_score));
      const maxLevel = computeRiskLevel(maxScore);
      return {
        workspace_id: wsId,
        name: workspaceNames.get(wsId) || wsId,
        max_score: maxScore,
        max_level: maxLevel,
        delta: getWorkspaceDelta(wsId),
        scores,
      };
    })
    .sort((a, b) => b.max_score - a.max_score);

  return {
    companyScores,
    workspaceScores,
    snapshots,
    companySnapshots,
    forecasts,
    overallScore,
    rankedWorkspaces,
    workspaceRiskMap,
    workspaceNames,
    getWorkspaceDelta,
    compute: computeMutation.mutate,
    isComputing: computeMutation.isPending,
    isLoading: scoresLoading || wsScoresLoading || snapshotsLoading || forecastsLoading,
  };
}
