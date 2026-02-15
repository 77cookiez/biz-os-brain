import type { SnapshotProvider } from '../types';

/**
 * BillingProvider — Metadata only (capture/restore is server-side).
 */
export const BillingProvider: SnapshotProvider = {
  id: 'billing',
  version: 1,

  describe() {
    return {
      name: 'Billing',
      description: 'Billing subscriptions & plan linkage',
      critical: true,
    };
  },
};
