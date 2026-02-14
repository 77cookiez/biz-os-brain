import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useWorkspace } from '@/contexts/WorkspaceContext';

export interface CommissionEntry {
  id: string;
  workspace_id: string;
  booking_id: string;
  booking_amount: number;
  commission_rate: number;
  commission_amount: number;
  currency: string;
  status: string;
  invoice_id: string | null;
  created_at: string;
}

export function useCommissionTracking() {
  const { currentWorkspace } = useWorkspace();
  const workspaceId = currentWorkspace?.id;

  const { data: entries = [], isLoading } = useQuery({
    queryKey: ['commission-ledger', workspaceId],
    queryFn: async () => {
      if (!workspaceId) return [];
      const { data, error } = await supabase
        .from('booking_commission_ledger')
        .select('*')
        .eq('workspace_id', workspaceId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as CommissionEntry[];
    },
    enabled: !!workspaceId,
  });

  const totalPending = entries
    .filter(e => e.status === 'pending')
    .reduce((sum, e) => sum + e.commission_amount, 0);

  const totalCollected = entries
    .filter(e => e.status === 'collected')
    .reduce((sum, e) => sum + e.commission_amount, 0);

  return {
    entries,
    isLoading,
    totalPending,
    totalCollected,
  };
}
