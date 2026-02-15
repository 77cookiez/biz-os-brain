import { supabase } from '@/integrations/supabase/client';
import type { SnapshotProvider, ProviderFragment } from '../types';

export const BillingProvider: SnapshotProvider = {
  id: 'billing',
  version: 1,

  async capture(workspaceId: string): Promise<ProviderFragment> {
    const { data: subscriptions } = await supabase
      .from('billing_subscriptions')
      .select('*')
      .eq('workspace_id', workspaceId);

    const subs = subscriptions || [];

    return {
      provider_id: 'billing',
      version: 1,
      data: { billing_subscriptions: subs },
      metadata: {
        entity_count: subs.length,
      },
    };
  },

  async restore(workspaceId: string, fragment: ProviderFragment): Promise<void> {
    const { billing_subscriptions } = fragment.data as {
      billing_subscriptions: any[];
    };

    if (!billing_subscriptions || billing_subscriptions.length === 0) return;

    // Upsert subscriptions — workspace_id is unique constraint
    for (const sub of billing_subscriptions) {
      const { error } = await supabase
        .from('billing_subscriptions')
        .upsert(sub, { onConflict: 'workspace_id' });
      if (error) throw new Error(`Failed to restore billing subscription: ${error.message}`);
    }
  },

  describe() {
    return {
      name: 'Billing',
      description: 'Billing subscriptions & plan linkage',
      critical: true,
    };
  },
};
