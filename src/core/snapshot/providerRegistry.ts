/**
 * Provider Registry v2 — Reads from DB via Edge Function.
 *
 * Client-side descriptors are kept as fallback for offline/SSR.
 * The source of truth is snapshot_providers_registry in the DB.
 */

import type { ProviderDescriptor } from './types';

/**
 * Static fallback descriptors (used when DB is unreachable).
 * These match the seeded rows in snapshot_providers_registry.
 */
export const FallbackProviderDescriptors: ProviderDescriptor[] = [
  {
    provider_id: 'workboard',
    name: 'Workboard',
    description: 'Tasks, goals, plans, ideas',
    critical: true,
    default_policy: 'full',
    is_enabled: true,
  },
  {
    provider_id: 'billing',
    name: 'Billing',
    description: 'Billing subscriptions & plan linkage',
    critical: true,
    default_policy: 'full',
    is_enabled: true,
  },
  {
    provider_id: 'team_chat',
    name: 'Team Chat',
    description: 'Channels, messages, threads, attachment references (no file blobs)',
    critical: false,
    default_policy: 'metadata_only',
    is_enabled: true,
  },
];
