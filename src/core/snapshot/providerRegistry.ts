/**
 * Provider Registry — Single source of all snapshot providers.
 *
 * To add a new app to SafeBack snapshots:
 *   1. Create a provider implementing SnapshotProvider
 *   2. Add it to this array
 *   3. SafeBack never changes.
 */
import type { SnapshotProvider } from './types';
import { WorkboardProvider } from './providers/WorkboardProvider';
import { BillingProvider } from './providers/BillingProvider';
import { TeamChatProvider } from './providers/TeamChatProvider';

export const SnapshotProviders: SnapshotProvider[] = [
  WorkboardProvider,
  BillingProvider,
  TeamChatProvider,
];
