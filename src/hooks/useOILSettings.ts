import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { toast } from 'sonner';

export interface OILSettings {
  id: string;
  workspace_id: string;
  insights_visibility: 'minimal' | 'balanced' | 'proactive';
  show_in_brain_only: boolean;
  show_indicator_strip: boolean;
  guidance_style: 'conservative' | 'advisory' | 'challenging';
  leadership_guidance_enabled: boolean;
  show_best_practice_comparisons: boolean;
  always_explain_why: boolean;
  auto_surface_blind_spots: boolean;
  external_knowledge: 'off' | 'conditional' | 'on_demand';
  include_industry_benchmarks: boolean;
  include_operational_best_practices: boolean;
  exclude_market_news: boolean;
  updated_at: string;
  created_at: string;
}

const DEFAULTS: Omit<OILSettings, 'id' | 'workspace_id' | 'updated_at' | 'created_at'> = {
  insights_visibility: 'minimal',
  show_in_brain_only: true,
  show_indicator_strip: false,
  guidance_style: 'advisory',
  leadership_guidance_enabled: true,
  show_best_practice_comparisons: true,
  always_explain_why: true,
  auto_surface_blind_spots: true,
  external_knowledge: 'conditional',
  include_industry_benchmarks: false,
  include_operational_best_practices: true,
  exclude_market_news: true,
};

export function useOILSettings() {
  const { currentWorkspace } = useWorkspace();
  const queryClient = useQueryClient();
  const workspaceId = currentWorkspace?.id;

  const { data: settings, isLoading } = useQuery({
    queryKey: ['oil-settings', workspaceId],
    queryFn: async () => {
      if (!workspaceId) return null;
      const { data, error } = await (supabase as any)
        .from('oil_settings')
        .select('*')
        .eq('workspace_id', workspaceId)
        .maybeSingle();
      if (error) throw error;
      return (data as OILSettings | null) ?? null;
    },
    enabled: !!workspaceId,
  });

  const updateSettings = useMutation({
    mutationFn: async (updates: Partial<OILSettings>) => {
      if (!workspaceId) throw new Error('No workspace');

      if (settings?.id) {
        const { error } = await (supabase as any)
          .from('oil_settings')
          .update(updates)
          .eq('id', settings.id);
        if (error) throw error;
      } else {
        const { error } = await (supabase as any)
          .from('oil_settings')
          .insert({ workspace_id: workspaceId, ...updates });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['oil-settings', workspaceId] });
      toast.success('Intelligence settings saved');
    },
    onError: () => {
      toast.error('Failed to save settings');
    },
  });

  const effectiveSettings: Omit<OILSettings, 'id' | 'workspace_id' | 'updated_at' | 'created_at'> =
    settings ? { ...DEFAULTS, ...settings } : DEFAULTS;

  return { settings: effectiveSettings, isLoading, updateSettings };
}
