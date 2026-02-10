import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { useLanguage } from '@/contexts/LanguageContext';

const SIGNALS_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/decision-signals`;

export interface DecisionSuggestion {
  id: string;
  signal_type: string;
  title: string;
  explanation: string;
  confidence_level: 'low' | 'medium' | 'high';
  context_refs: { task_ids?: string[]; goal_ids?: string[]; thread_ids?: string[] };
}

export interface DecisionSignalsResponse {
  signals_count: number;
  suggestions: DecisionSuggestion[];
}

async function fetchDecisionSignals(
  workspaceId: string,
  contentLocale: string
): Promise<DecisionSignalsResponse> {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;

  const resp = await fetch(SIGNALS_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
      apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
    },
    body: JSON.stringify({ workspace_id: workspaceId, content_locale: contentLocale }),
  });

  if (!resp.ok) {
    const err = await resp.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(err.error || 'Failed to fetch decision signals');
  }

  return resp.json();
}

export function useDecisionSignals() {
  const { currentWorkspace } = useWorkspace();
  const { currentLanguage, contentLocale } = useLanguage();
  const wsId = currentWorkspace?.id;
  const locale = contentLocale || currentLanguage.code;

  const { data, isLoading, error } = useQuery({
    queryKey: ['decision-signals', wsId, locale],
    queryFn: () => fetchDecisionSignals(wsId!, locale),
    enabled: !!wsId,
    staleTime: 10 * 60 * 1000, // 10 minutes
    refetchOnWindowFocus: false,
  });

  return {
    suggestions: data?.suggestions || [],
    signalsCount: data?.signals_count || 0,
    loading: isLoading,
    error: error ? (error as Error).message : null,
  };
}
