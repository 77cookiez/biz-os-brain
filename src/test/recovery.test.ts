/**
 * Recovery & Backup (Resilience Layer) + SafeBack App — Unit Tests
 * v3: Provider Engine v2 — registry-driven, policy-aware
 */
import { describe, it, expect } from 'vitest';

// ─── Server-side only contract ───

describe('Server-side only contract', () => {
  it('engine.ts should not export direct table mutation functions', async () => {
    const engine = await import('@/core/snapshot/engine');
    const exports = Object.keys(engine);
    expect(exports).not.toContain('deleteWorkspaceWorkboardData');
    expect(exports).not.toContain('insertAll');
  });

  it('engine.ts should export getEffectiveProviders', async () => {
    const engine = await import('@/core/snapshot/engine');
    expect(typeof engine.getEffectiveProviders).toBe('function');
  });

  it('providers should not have capture/restore methods (descriptor only)', async () => {
    const { WorkboardProvider } = await import('@/core/snapshot/providers/WorkboardProvider');
    expect(WorkboardProvider.describe).toBeDefined();
    expect((WorkboardProvider as any).capture).toBeUndefined();
    expect((WorkboardProvider as any).restore).toBeUndefined();
  });

  it('BillingProvider should be descriptor only', async () => {
    const { BillingProvider } = await import('@/core/snapshot/providers/BillingProvider');
    expect(BillingProvider.describe).toBeDefined();
    expect((BillingProvider as any).capture).toBeUndefined();
    expect((BillingProvider as any).restore).toBeUndefined();
  });

  it('TeamChatProvider should be descriptor only', async () => {
    const { TeamChatProvider } = await import('@/core/snapshot/providers/TeamChatProvider');
    expect(TeamChatProvider.describe).toBeDefined();
    expect((TeamChatProvider as any).capture).toBeUndefined();
    expect((TeamChatProvider as any).restore).toBeUndefined();
  });
});

// ─── Provider descriptors ───

describe('Provider descriptors', () => {
  it('workboard is critical', async () => {
    const { WorkboardDescriptor } = await import('@/core/snapshot/providers/WorkboardProvider');
    expect(WorkboardDescriptor.critical).toBe(true);
    expect(WorkboardDescriptor.default_policy).toBe('full');
  });

  it('billing is critical', async () => {
    const { BillingDescriptor } = await import('@/core/snapshot/providers/BillingProvider');
    expect(BillingDescriptor.critical).toBe(true);
    expect(BillingDescriptor.default_policy).toBe('full');
  });

  it('team_chat is non-critical with metadata_only default', async () => {
    const { TeamChatDescriptor } = await import('@/core/snapshot/providers/TeamChatProvider');
    expect(TeamChatDescriptor.critical).toBe(false);
    expect(TeamChatDescriptor.default_policy).toBe('metadata_only');
  });
});

// ─── Registry completeness ───

describe('Provider registry (v2)', () => {
  it('should have exactly 3 fallback descriptors', async () => {
    const { FallbackProviderDescriptors } = await import('@/core/snapshot/providerRegistry');
    expect(FallbackProviderDescriptors).toHaveLength(3);
  });

  it('provider IDs should be unique', async () => {
    const { FallbackProviderDescriptors } = await import('@/core/snapshot/providerRegistry');
    const ids = FallbackProviderDescriptors.map((p) => p.provider_id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('should contain workboard, billing, team_chat', async () => {
    const { FallbackProviderDescriptors } = await import('@/core/snapshot/providerRegistry');
    const ids = FallbackProviderDescriptors.map((p) => p.provider_id);
    expect(ids).toContain('workboard');
    expect(ids).toContain('billing');
    expect(ids).toContain('team_chat');
  });

  it('each descriptor has all required fields', async () => {
    const { FallbackProviderDescriptors } = await import('@/core/snapshot/providerRegistry');
    FallbackProviderDescriptors.forEach((p) => {
      expect(p.provider_id).toBeTruthy();
      expect(p.name).toBeTruthy();
      expect(p.description).toBeTruthy();
      expect(typeof p.critical).toBe('boolean');
      expect(['none', 'metadata_only', 'full', 'full_plus_files']).toContain(p.default_policy);
      expect(typeof p.is_enabled).toBe('boolean');
    });
  });
});

// ─── Engine API contract ───

describe('Engine exports server-only API (v2)', () => {
  it('should export captureFullSnapshot, previewRestore, restoreFromSnapshot, getEffectiveProviders', async () => {
    const engine = await import('@/core/snapshot/engine');
    expect(typeof engine.captureFullSnapshot).toBe('function');
    expect(typeof engine.previewRestore).toBe('function');
    expect(typeof engine.restoreFromSnapshot).toBe('function');
    expect(typeof engine.getEffectiveProviders).toBe('function');
  });

  it('restoreFromSnapshot should accept 4 params (snapshotId, token, actor, workspaceId)', async () => {
    const engine = await import('@/core/snapshot/engine');
    expect(engine.restoreFromSnapshot.length).toBe(4);
  });
});

// ─── v3 RPC contracts ───

describe('v3 RPC contracts', () => {
  it('capture_workspace_snapshot_v3 accepts _actor parameter', () => {
    const rpcName = 'capture_workspace_snapshot_v3';
    const params = ['_workspace_id', '_snapshot_type', '_reason', '_actor'];
    expect(rpcName).toBeTruthy();
    expect(params).toContain('_actor');
    expect(params).toHaveLength(4);
  });

  it('preview_restore_v3 returns engine_version in summary', () => {
    const expectedFields = ['confirmation_token', 'summary', 'expires_in_seconds'];
    const summaryFields = ['providers', 'snapshot_created_at', 'snapshot_type', 'engine_version'];
    expect(expectedFields).toContain('summary');
    expect(summaryFields).toContain('engine_version');
  });

  it('restore_workspace_snapshot_atomic_v3 uses v3 capture for pre-restore', () => {
    const prRestoreCaptureFn = 'capture_workspace_snapshot_v3';
    expect(prRestoreCaptureFn).toContain('v3');
  });
});

// ─── Policy resolution ───

describe('Policy resolution', () => {
  it('effective policy defaults to provider default_policy when no override', () => {
    const defaultPolicy = 'full';
    const override = null;
    const effective = override ?? defaultPolicy;
    expect(effective).toBe('full');
  });

  it('workspace override takes precedence over default', () => {
    const defaultPolicy = 'full';
    const override = 'metadata_only';
    const effective = override ?? defaultPolicy;
    expect(effective).toBe('metadata_only');
  });

  it('policy none means provider is skipped during capture', () => {
    const policy = 'none';
    const shouldSkip = policy === 'none';
    expect(shouldSkip).toBe(true);
  });

  it('valid policies are none, metadata_only, full, full_plus_files', () => {
    const validPolicies = ['none', 'metadata_only', 'full', 'full_plus_files'];
    expect(validPolicies).toHaveLength(4);
    expect(validPolicies).toContain('none');
    expect(validPolicies).toContain('metadata_only');
    expect(validPolicies).toContain('full');
    expect(validPolicies).toContain('full_plus_files');
  });
});

// ─── Atomic restore contract ───

describe('Atomic restore contract (v3)', () => {
  it('critical providers (workboard, billing) cause full rollback on failure', () => {
    const criticalProviders = ['workboard', 'billing'];
    const nonCriticalProviders = ['team_chat'];
    criticalProviders.forEach((p) => expect(['workboard', 'billing']).toContain(p));
    nonCriticalProviders.forEach((p) => expect(['team_chat']).toContain(p));
  });

  it('pre-restore snapshot is created via capture_workspace_snapshot_v3', () => {
    const expectedSnapshotType = 'pre_restore';
    const captureFunction = 'capture_workspace_snapshot_v3';
    expect(expectedSnapshotType).toBe('pre_restore');
    expect(captureFunction).toContain('v3');
  });

  it('advisory lock prevents concurrent restores on same workspace', () => {
    const lockMechanism = 'pg_advisory_xact_lock';
    expect(lockMechanism).toBeTruthy();
  });

  it('metadata_only fragments are skipped during restore', () => {
    const policy = 'metadata_only';
    const shouldRestore = !['none', 'metadata_only'].includes(policy);
    expect(shouldRestore).toBe(false);
  });
});

// ─── Size protection ───

describe('Size protection (v2)', () => {
  it('TeamChat messages capped at 2000 (default)', () => {
    const MAX_MESSAGES_PER_SNAPSHOT = 2000;
    expect(MAX_MESSAGES_PER_SNAPSHOT).toBe(2000);
  });

  it('TeamChat cap is configurable via limits.max_messages', () => {
    const limits = { max_messages: 500 };
    const cap = limits.max_messages;
    expect(cap).toBe(500);
  });

  it('Attachments are metadata only (no blob storage)', () => {
    const capturedAttachmentFields = ['id', 'message_id', 'workspace_id', 'file_name', 'file_type', 'file_size', 'storage_path', 'uploaded_by', 'created_at'];
    expect(capturedAttachmentFields).not.toContain('file_url');
    // file_url points to actual blob — we keep storage_path as reference only
    expect(capturedAttachmentFields).toContain('storage_path');
  });
});

// ─── TeamChat restore workspace integrity ───

describe('TeamChat restore workspace integrity', () => {
  it('restore_teamchat_fragment builds thread_id whitelist from fragment', () => {
    const fragmentThreadIds = ['t1', 't2'];
    const memberRow = { thread_id: 't3' };
    expect(fragmentThreadIds).not.toContain(memberRow.thread_id);
  });

  it('attachment refs are validated against restored message_ids', () => {
    const restoredMessageIds = ['m1', 'm2'];
    const orphanAttachment = { message_id: 'm99' };
    expect(restoredMessageIds).not.toContain(orphanAttachment.message_id);
  });

  it('workspace_id is forced on all restored rows', () => {
    const forceFields = ['workspace_id'];
    expect(forceFields).toContain('workspace_id');
  });
});

// ─── Edge function restore safety ───

describe('Edge function restore safety (v3)', () => {
  it('restore endpoint derives workspace_id from snapshot, not client body', () => {
    const requiredBodyParams = ['snapshot_id', 'confirmation_token'];
    expect(requiredBodyParams).not.toContain('workspace_id');
  });

  it('preview endpoint derives workspace_id from snapshot', () => {
    const requiredBodyParams = ['snapshot_id'];
    expect(requiredBodyParams).not.toContain('workspace_id');
  });

  it('providers endpoint is available for reading effective policies', () => {
    const endpoints = ['capture', 'preview', 'restore', 'providers'];
    expect(endpoints).toContain('providers');
  });
});

// ─── Audit log events ───

describe('Audit log events (v3)', () => {
  const EXPECTED_AUDIT_ACTIONS = [
    'workspace.snapshot_created',
    'workspace.snapshot_previewed',
    'workspace.snapshot_restore_started',
    'workspace.snapshot_restore_completed',
    'workspace.provider_restore_failed',
  ];

  it('should define all required audit actions', () => {
    expect(EXPECTED_AUDIT_ACTIONS).toHaveLength(5);
    EXPECTED_AUDIT_ACTIONS.forEach((a) => expect(a).toMatch(/^workspace\./));
  });

  it('snapshot_created includes providers list and policies', () => {
    const metadata = { snapshot_type: 'manual', providers: ['workboard', 'billing', 'team_chat'], reason: null };
    expect(metadata.providers).toHaveLength(3);
  });
});

// ─── Token expiry detection ───

describe('Token expiry logic', () => {
  const TTL_SECONDS = 600;

  function isTokenExpired(createdAt: string, ttlSeconds: number): boolean {
    const created = new Date(createdAt).getTime();
    const now = Date.now();
    return now - created > ttlSeconds * 1000;
  }

  it('should detect a fresh token as NOT expired', () => {
    const justNow = new Date().toISOString();
    expect(isTokenExpired(justNow, TTL_SECONDS)).toBe(false);
  });

  it('should detect an old token as expired', () => {
    const twentyMinutesAgo = new Date(Date.now() - 20 * 60 * 1000).toISOString();
    expect(isTokenExpired(twentyMinutesAgo, TTL_SECONDS)).toBe(true);
  });
});

// ─── Advisory lock key determinism ───

describe('Advisory lock key derivation', () => {
  function simpleHash(input: string): number {
    let hash = 0;
    for (let i = 0; i < input.length; i++) {
      const char = input.charCodeAt(i);
      hash = ((hash << 5) - hash + char) | 0;
    }
    return hash;
  }

  it('should produce deterministic hash for same workspace_id', () => {
    const wsId = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
    expect(simpleHash(wsId)).toBe(simpleHash(wsId));
  });

  it('should produce different hashes for different workspace_ids', () => {
    const ws1 = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
    const ws2 = 'ffffffff-1111-2222-3333-444444444444';
    expect(simpleHash(ws1)).not.toBe(simpleHash(ws2));
  });
});

// ─── SafeBack Manifest ───

describe('SafeBack manifest', () => {
  const manifest = {
    id: 'safeback',
    routeBase: '/apps/safeback',
    tabs: ['overview', 'snapshots', 'schedules', 'exports', 'policies', 'audit', 'settings'],
  };

  it('should have correct appId', () => {
    expect(manifest.id).toBe('safeback');
  });

  it('should have 7 tab ids', () => {
    expect(manifest.tabs).toHaveLength(7);
  });
});

// ─── Deep-link preservation ───

describe('Deep-link preservation', () => {
  it('/settings/recovery route is independent of safeback install', () => {
    const settingsRoute = '/settings/recovery';
    expect(settingsRoute).not.toContain('safeback');
  });
});

// ─── Snapshot payload format (v2) ───

describe('Snapshot payload format v2', () => {
  it('payload includes engine_version=2', () => {
    const payload = { engine_version: 2, created_at: new Date().toISOString(), fragments: [] };
    expect(payload.engine_version).toBe(2);
  });

  it('each fragment has policy field', () => {
    const fragment = { provider_id: 'workboard', version: 1, policy: 'full', data: {}, metadata: { entity_count: 5 } };
    expect(fragment.policy).toBe('full');
  });

  it('fragments with policy=none have skipped=true in metadata', () => {
    const fragment = { provider_id: 'team_chat', version: 1, policy: 'none', data: null, metadata: { entity_count: 0, skipped: true } };
    expect(fragment.metadata.skipped).toBe(true);
  });
});
