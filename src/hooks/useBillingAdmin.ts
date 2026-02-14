import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';

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
  const { user } = useAuth();
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

  // Request upgrade (any member)
  const requestUpgrade = useMutation({
    mutationFn: async ({ planId, notes }: { planId: string; notes?: string }) => {
      if (!workspaceId || !user) throw new Error('Not authenticated');
      const { error } = await supabase
        .from('billing_upgrade_requests')
        .insert({
          workspace_id: workspaceId,
          requested_plan_id: planId,
          requested_by: user.id,
          notes: notes || null,
        } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['billing-upgrade-requests'] });
      toast.success(t('billing.upgradeRequested', 'Upgrade request submitted'));
    },
    onError: () => toast.error(t('billing.upgradeRequestFailed', 'Failed to submit upgrade request')),
  });

  // Approve upgrade (admin only)
  const approveUpgrade = useMutation({
    mutationFn: async ({ requestId, planId }: { requestId: string; planId: string }) => {
      if (!workspaceId || !user) throw new Error('Not authenticated');

      // Update the request
      await supabase
        .from('billing_upgrade_requests')
        .update({
          status: 'approved',
          decided_by: user.id,
          decided_at: new Date().toISOString(),
        } as any)
        .eq('id', requestId);

      // Update or create subscription
      const { data: existing } = await supabase
        .from('billing_subscriptions')
        .select('id')
        .eq('workspace_id', workspaceId)
        .maybeSingle();

      if (existing) {
        await supabase
          .from('billing_subscriptions')
          .update({
            plan_id: planId,
            status: 'active',
            current_period_start: new Date().toISOString(),
          } as any)
          .eq('id', existing.id);
      } else {
        await supabase
          .from('billing_subscriptions')
          .insert({
            workspace_id: workspaceId,
            plan_id: planId,
            status: 'active',
            billing_provider: 'offline_invoice',
          } as any);
      }

      // Audit
      await supabase.from('audit_logs').insert({
        workspace_id: workspaceId,
        actor_user_id: user.id,
        action: 'billing.upgrade_approved',
        entity_type: 'billing_upgrade_request',
        entity_id: requestId,
        metadata: { plan_id: planId },
      } as any);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['billing-upgrade-requests'] });
      queryClient.invalidateQueries({ queryKey: ['billing-subscription'] });
      toast.success(t('billing.upgradeApproved', 'Upgrade approved'));
    },
    onError: () => toast.error(t('billing.upgradeApproveFailed', 'Failed to approve upgrade')),
  });

  // Reject upgrade (admin only)
  const rejectUpgrade = useMutation({
    mutationFn: async ({ requestId, notes }: { requestId: string; notes?: string }) => {
      if (!workspaceId || !user) throw new Error('Not authenticated');
      await supabase
        .from('billing_upgrade_requests')
        .update({
          status: 'rejected',
          decided_by: user.id,
          decided_at: new Date().toISOString(),
          notes: notes || null,
        } as any)
        .eq('id', requestId);

      await supabase.from('audit_logs').insert({
        workspace_id: workspaceId,
        actor_user_id: user.id,
        action: 'billing.upgrade_rejected',
        entity_type: 'billing_upgrade_request',
        entity_id: requestId,
      } as any);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['billing-upgrade-requests'] });
      toast.success(t('billing.upgradeRejected', 'Upgrade request rejected'));
    },
    onError: () => toast.error(t('billing.upgradeRejectFailed', 'Failed to reject')),
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
