/**
 * BillingProvider — Descriptor only (v2).
 * Capture/restore logic is entirely server-side.
 */
import type { ProviderDescriptor } from '../types';

export const BillingDescriptor: ProviderDescriptor = {
  provider_id: 'billing',
  name: 'Billing',
  description: 'Billing subscriptions & plan linkage',
  critical: true,
  default_policy: 'full',
  is_enabled: true,
};

// Legacy export for backward compat with tests
export const BillingProvider = {
  id: 'billing',
  version: 1,
  describe: () => ({
    name: BillingDescriptor.name,
    description: BillingDescriptor.description,
    critical: BillingDescriptor.critical,
  }),
};
