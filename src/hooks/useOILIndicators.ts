import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { useOILSettings } from '@/hooks/useOILSettings';

export interface OILIndicator {
  indicator_key: string;
  score: number;
  trend: 'up' | 'down' | 'stable';
  drivers: any[];
}

export interface CompanyMemoryItem {
  id: string;
  statement: string;
  memory_type: string;
  confidence: number;
  status: string;
}

export type HealthLevel = 'needsAttention' | 'steady' | 'strong';

export function getHealthLevel(score: number): HealthLevel {
  if (score < 40) return 'needsAttention';
  if (score < 70) return 'steady';
  return 'strong';
}

export function getHealthColor(level: HealthLevel): string {
  switch (level) {
    case 'needsAttention': return 'text-destructive';
    case 'steady': return 'text-orange-500';
    case 'strong': return 'text-emerald-500';
  }
}

export function getDotColor(level: HealthLevel): string {
  switch (level) {
    case 'needsAttention': return 'bg-destructive';
    case 'steady': return 'bg-orange-500';
    case 'strong': return 'bg-emerald-500';
  }
}

const CORE_KEYS = ['ExecutionHealth', 'DeliveryRisk', 'GoalProgress'];

export function useOILIndicators() {
  const { currentWorkspace } = useWorkspace();
  const { settings } = useOILSettings();
  const workspaceId = currentWorkspace?.id;
  const isMinimal = settings.insights_visibility === 'minimal';

  const { data: indicators = [], isLoading: indicatorsLoading } = useQuery({
    queryKey: ['oil-indicators', workspaceId],
    queryFn: async () => {
      if (!workspaceId) return [];
      const { data, error } = await (supabase as any)
        .from('org_indicators')
        .select('indicator_key, score, trend, drivers')
        .eq('workspace_id', workspaceId);
      if (error) throw error;
      return (data as OILIndicator[]) || [];
    },
    enabled: !!workspaceId && !isMinimal,
  });

  const { data: memories = [], isLoading: memoriesLoading } = useQuery({
    queryKey: ['company-memory', workspaceId],
    queryFn: async () => {
      if (!workspaceId) return [];
      const { data, error } = await (supabase as any)
        .from('company_memory')
        .select('id, statement, memory_type, confidence, status')
        .eq('workspace_id', workspaceId)
        .eq('status', 'active')
        .gte('confidence', 0.7)
        .order('confidence', { ascending: false })
        .limit(5);
      if (error) throw error;
      return (data as CompanyMemoryItem[]) || [];
    },
    enabled: !!workspaceId && !isMinimal,
  });

  const coreIndicators = CORE_KEYS.map(key => {
    const found = indicators.find(i => i.indicator_key === key);
    return found || { indicator_key: key, score: 50, trend: 'stable' as const, drivers: [] };
  });

  const topMemory = memories.length > 0 ? memories[0] : null;

  // Overall health: average of core indicators
  const avgScore = coreIndicators.reduce((sum, i) => sum + i.score, 0) / coreIndicators.length;
  const overallHealth = getHealthLevel(avgScore);

  return {
    coreIndicators,
    indicators,
    topMemory,
    memories,
    overallHealth,
    isLoading: indicatorsLoading || memoriesLoading,
    isMinimal,
    showStrip: settings.show_indicator_strip && !isMinimal,
    showInsight: (settings.insights_visibility === 'balanced' || settings.insights_visibility === 'proactive') && !isMinimal,
  };
}
