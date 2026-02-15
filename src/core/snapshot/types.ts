/**
 * Snapshot Provider Engine v2 — Core Contract
 *
 * Providers are registry-driven. Client holds descriptors only.
 * All capture/restore logic is server-side (RPCs).
 */

export type SnapshotPolicy = 'none' | 'metadata_only' | 'full' | 'full_plus_files';

export interface ProviderDescriptor {
  provider_id: string;
  name: string;
  description: string;
  critical: boolean;
  default_policy: SnapshotPolicy;
  is_enabled: boolean;
}

export interface EffectiveProvider extends ProviderDescriptor {
  effective_policy: SnapshotPolicy;
  include_files: boolean;
  limits: Record<string, unknown>;
}

export interface ProviderFragment {
  provider_id: string;
  version: number;
  policy: SnapshotPolicy;
  data: unknown;
  metadata?: {
    entity_count?: number;
    skipped?: boolean;
    size_estimate?: number;
  };
}

export interface PreviewProviderSummary {
  provider_id: string;
  name: string;
  critical: boolean;
  policy: SnapshotPolicy;
  entity_count: number;
  skipped: boolean;
}

export interface PreviewResult {
  confirmation_token: string;
  summary: {
    providers: PreviewProviderSummary[];
    snapshot_created_at: string;
    snapshot_type: string;
    engine_version: number;
  };
  expires_in_seconds: number;
}

export interface SnapshotPayload {
  engine_version: number;
  created_at: string;
  fragments: ProviderFragment[];
}
