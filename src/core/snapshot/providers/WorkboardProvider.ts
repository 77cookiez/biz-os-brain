/**
 * WorkboardProvider — Descriptor only (v2).
 * Capture/restore logic is entirely server-side.
 */
import type { ProviderDescriptor } from '../types';

export const WorkboardDescriptor: ProviderDescriptor = {
  provider_id: 'workboard',
  name: 'Workboard',
  description: 'Tasks, goals, plans, ideas',
  critical: true,
  default_policy: 'full',
  is_enabled: true,
};

// Legacy export for backward compat with tests
export const WorkboardProvider = {
  id: 'workboard',
  version: 1,
  describe: () => ({
    name: WorkboardDescriptor.name,
    description: WorkboardDescriptor.description,
    critical: WorkboardDescriptor.critical,
  }),
};
