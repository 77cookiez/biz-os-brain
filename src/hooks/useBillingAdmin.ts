import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { getErrorMessage } from '@/lib/errorMapper';

export interface UpgradeRequest {
  id: string;
  workspace_id: string;
  requested_plan_id: string;
  requested_by: string;
  status: string;
  decided_by: string | null;
  decided_at: string | null;
  notes: string | null;
  created_at: string;
}

export function useBillingAdmin() {
  const { currentWorkspace } = useWorkspace();
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const workspaceId = currentWorkspace?.id;

  // Check if current user is billing admin
  const { data: isBillingAdmin = false, isLoading: adminCheckLoading } = useQuery({
    queryKey: ['can-manage-billing', workspaceId],
    queryFn: async () => {
      if (!workspaceId) return false;
      const { data, error } = await supabase.rpc('can_manage_billing', {
        _workspace_id: workspaceId,
      });
      if (error) return false;
      return data as boolean;
    },
    enabled: !!workspaceId,
  });

  // Fetch upgrade requests
  const { data: upgradeRequests = [], isLoading: requestsLoading } = useQuery({
    queryKey: ['billing-upgrade-requests', workspaceId],
    queryFn: async () => {
      if (!workspaceId) return [];
      const { data, error } = await supabase
        .from('billing_upgrade_requests')
        .select('*')
        .eq('workspace_id', workspaceId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as UpgradeRequest[];
    },
    enabled: !!workspaceId,
  });

  // Request upgrade via server-side RPC (any member)
  const requestUpgrade = useMutation({
    mutationFn: async ({ planId, notes }: { planId: string; notes?: string }) => {
      if (!workspaceId) throw new Error('No workspace');
      const { data, error } = await supabase.rpc('request_upgrade', {
        _workspace_id: workspaceId,
        _plan_id: planId,
        _notes: notes || null,
      });
      if (error) throw error;
      return data as string;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['billing-upgrade-requests'] });
      toast.success(t('billing.upgradeRequested', 'Upgrade request submitted'));
    },
    onError: (err) => toast.error(getErrorMessage(err, t('billing.upgradeRequestFailed', 'Failed to submit upgrade request'))),
  });

  // Approve upgrade via atomic server-side RPC (admin only)
  const approveUpgrade = useMutation({
    mutationFn: async ({ requestId, notes }: { requestId: string; notes?: string }) => {
      const { data, error } = await supabase.rpc('decide_upgrade', {
        _request_id: requestId,
        _decision: 'approved',
        _notes: notes || null,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['billing-upgrade-requests'] });
      queryClient.invalidateQueries({ queryKey: ['billing-subscription'] });
      toast.success(t('billing.upgradeApproved', 'Upgrade approved'));
    },
    onError: (err) => toast.error(getErrorMessage(err, t('billing.upgradeApproveFailed', 'Failed to approve upgrade'))),
  });

  // Reject upgrade via atomic server-side RPC (admin only)
  const rejectUpgrade = useMutation({
    mutationFn: async ({ requestId, notes }: { requestId: string; notes?: string }) => {
      const { data, error } = await supabase.rpc('decide_upgrade', {
        _request_id: requestId,
        _decision: 'rejected',
        _notes: notes || null,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['billing-upgrade-requests'] });
      toast.success(t('billing.upgradeRejected', 'Upgrade request rejected'));
    },
    onError: (err) => toast.error(getErrorMessage(err, t('billing.upgradeRejectFailed', 'Failed to reject'))),
  });

  return {
    isBillingAdmin,
    isLoading: adminCheckLoading || requestsLoading,
    upgradeRequests,
    requestUpgrade,
    approveUpgrade,
    rejectUpgrade,
  };
}
