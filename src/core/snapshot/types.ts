/**
 * Snapshot Provider Engine — Core Contract
 *
 * SafeBack never knows app tables directly.
 * All snapshot data flows through registered SnapshotProviders.
 */

export interface ProviderFragment {
  provider_id: string;
  version: number;
  data: unknown;
  metadata?: {
    entity_count?: number;
    size_estimate?: number;
  };
}

export interface ProviderDescriptor {
  name: string;
  description: string;
  critical: boolean;
}

export interface SnapshotProvider {
  id: string;
  version: number;

  capture(workspaceId: string): Promise<ProviderFragment>;

  restore(
    workspaceId: string,
    fragment: ProviderFragment,
  ): Promise<void>;

  describe(): ProviderDescriptor;
}

export interface SnapshotPayload {
  engine_version: number;
  created_at: string;
  fragments: ProviderFragment[];
}
