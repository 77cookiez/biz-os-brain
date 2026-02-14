import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';

export interface BillingPlan {
  id: string;
  name: string;
  display_order: number;
  billing_cycles: string[];
  price_monthly: number;
  price_yearly: number;
  currency: string;
  vendors_limit: number | null;
  services_limit: number | null;
  quotes_limit: number | null;
  bookings_limit: number | null;
  seats_limit: number | null;
  modules: string[];
  features: Record<string, boolean>;
  is_active: boolean;
}

export interface BillingSubscription {
  id: string;
  workspace_id: string;
  plan_id: string;
  status: string;
  billing_cycle: string;
  billing_provider: string;
  current_period_start: string;
  current_period_end: string | null;
  cancelled_at: string | null;
  external_subscription_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface BillingInvoice {
  id: string;
  workspace_id: string;
  subscription_id: string;
  amount: number;
  currency: string;
  status: string;
  invoice_number: string | null;
  period_start: string;
  period_end: string;
  paid_at: string | null;
  payment_method: string | null;
  notes: string | null;
  created_at: string;
}

export function useBilling() {
  const { currentWorkspace } = useWorkspace();
  const { user } = useAuth();
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const workspaceId = currentWorkspace?.id;

  // Fetch all active plans
  const { data: plans = [], isLoading: plansLoading } = useQuery({
    queryKey: ['billing-plans'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('billing_plans')
        .select('*')
        .eq('is_active', true)
        .order('display_order');
      if (error) throw error;
      return data as BillingPlan[];
    },
  });

  // Fetch current subscription
  const { data: subscription, isLoading: subLoading } = useQuery({
    queryKey: ['billing-subscription', workspaceId],
    queryFn: async () => {
      if (!workspaceId) return null;
      const { data, error } = await supabase
        .from('billing_subscriptions')
        .select('*')
        .eq('workspace_id', workspaceId)
        .maybeSingle();
      if (error) throw error;
      return data as BillingSubscription | null;
    },
    enabled: !!workspaceId,
  });

  // Fetch invoices
  const { data: invoices = [], isLoading: invoicesLoading } = useQuery({
    queryKey: ['billing-invoices', workspaceId],
    queryFn: async () => {
      if (!workspaceId) return [];
      const { data, error } = await supabase
        .from('billing_invoices')
        .select('*')
        .eq('workspace_id', workspaceId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as BillingInvoice[];
    },
    enabled: !!workspaceId,
  });

  const currentPlan = plans.find(p => p.id === (subscription?.plan_id || 'free')) || null;

  const isFreePlan = !subscription || subscription.plan_id === 'free';
  const isActive = !subscription || subscription.status === 'active' || subscription.status === 'trial';
  const isPastDue = subscription?.status === 'past_due';

  // Change plan (admin only)
  const changePlan = useMutation({
    mutationFn: async ({ planId, billingCycle }: { planId: string; billingCycle: string }) => {
      if (!workspaceId || !user) throw new Error('Not authenticated');

      if (subscription) {
        const { error } = await supabase
          .from('billing_subscriptions')
          .update({
            plan_id: planId,
            billing_cycle: billingCycle,
            status: 'active',
            current_period_start: new Date().toISOString(),
          } as any)
          .eq('id', subscription.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('billing_subscriptions')
          .insert({
            workspace_id: workspaceId,
            plan_id: planId,
            billing_cycle: billingCycle,
            status: 'active',
            billing_provider: 'offline_invoice',
          } as any);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['billing-subscription'] });
      queryClient.invalidateQueries({ queryKey: ['billing-invoices'] });
      toast.success(t('billing.planChanged', 'Plan updated successfully'));
    },
    onError: () => toast.error(t('billing.planChangeFailed', 'Failed to update plan')),
  });

  // Mark invoice as paid (admin only, offline mode)
  const markInvoicePaid = useMutation({
    mutationFn: async ({ invoiceId, paymentMethod }: { invoiceId: string; paymentMethod?: string }) => {
      if (!workspaceId) throw new Error('No workspace');
      const { error } = await supabase
        .from('billing_invoices')
        .update({
          status: 'paid',
          paid_at: new Date().toISOString(),
          payment_method: paymentMethod || 'bank_transfer',
        } as any)
        .eq('id', invoiceId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['billing-invoices'] });
      toast.success(t('billing.invoicePaid', 'Invoice marked as paid'));
    },
    onError: () => toast.error(t('billing.invoicePaidFailed', 'Failed to update invoice')),
  });

  return {
    plans,
    subscription,
    currentPlan,
    invoices,
    isLoading: plansLoading || subLoading,
    invoicesLoading,
    isFreePlan,
    isActive,
    isPastDue,
    changePlan,
    markInvoicePaid,
  };
}
