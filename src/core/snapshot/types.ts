/**
 * Snapshot Provider Engine — Core Contract
 *
 * SafeBack never knows app tables directly.
 * All snapshot data flows through registered SnapshotProviders.
 *
 * NOTE: Provider capture/restore is now server-side only (RPCs).
 * These types remain for registry metadata (describe()) used by UI.
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

/**
 * SnapshotProvider interface — UI-side only.
 * capture() and restore() are no longer called from client.
 * They exist for type compatibility; actual work is in server RPCs.
 */
export interface SnapshotProvider {
  id: string;
  version: number;
  describe(): ProviderDescriptor;
}

export interface SnapshotPayload {
  engine_version: number;
  created_at: string;
  fragments: ProviderFragment[];
}
