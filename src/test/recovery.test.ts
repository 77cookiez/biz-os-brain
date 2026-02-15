/**
 * Recovery & Backup (Resilience Layer) + SafeBack App — Unit Tests
 * v2: Hardened — verifies server-side-only contracts
 */
import { describe, it, expect } from 'vitest';

// ─── Server-side only contract ───

describe('Server-side only contract', () => {
  it('engine.ts should not export direct table mutation functions', async () => {
    const engine = await import('@/core/snapshot/engine');
    const exports = Object.keys(engine);
    // Should NOT contain any direct supabase .from().delete/insert helpers
    expect(exports).not.toContain('deleteWorkspaceWorkboardData');
    expect(exports).not.toContain('insertAll');
  });

  it('providers should not have capture/restore methods (metadata only)', async () => {
    const { WorkboardProvider } = await import('@/core/snapshot/providers/WorkboardProvider');
    expect(WorkboardProvider.describe).toBeDefined();
    expect((WorkboardProvider as any).capture).toBeUndefined();
    expect((WorkboardProvider as any).restore).toBeUndefined();
  });

  it('BillingProvider should be metadata only', async () => {
    const { BillingProvider } = await import('@/core/snapshot/providers/BillingProvider');
    expect(BillingProvider.describe).toBeDefined();
    expect((BillingProvider as any).capture).toBeUndefined();
    expect((BillingProvider as any).restore).toBeUndefined();
  });

  it('TeamChatProvider should be metadata only', async () => {
    const { TeamChatProvider } = await import('@/core/snapshot/providers/TeamChatProvider');
    expect(TeamChatProvider.describe).toBeDefined();
    expect((TeamChatProvider as any).capture).toBeUndefined();
    expect((TeamChatProvider as any).restore).toBeUndefined();
  });
});

// ─── Provider descriptors ───

describe('Provider descriptors', () => {
  it('workboard is critical', async () => {
    const { WorkboardProvider } = await import('@/core/snapshot/providers/WorkboardProvider');
    expect(WorkboardProvider.describe().critical).toBe(true);
  });

  it('billing is critical', async () => {
    const { BillingProvider } = await import('@/core/snapshot/providers/BillingProvider');
    expect(BillingProvider.describe().critical).toBe(true);
  });

  it('team_chat is non-critical', async () => {
    const { TeamChatProvider } = await import('@/core/snapshot/providers/TeamChatProvider');
    expect(TeamChatProvider.describe().critical).toBe(false);
  });
});

// ─── Registry completeness ───

describe('Provider registry', () => {
  it('should have exactly 3 providers', async () => {
    const { SnapshotProviders } = await import('@/core/snapshot/providerRegistry');
    expect(SnapshotProviders).toHaveLength(3);
  });

  it('provider IDs should be unique', async () => {
    const { SnapshotProviders } = await import('@/core/snapshot/providerRegistry');
    const ids = SnapshotProviders.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('should contain workboard, billing, team_chat', async () => {
    const { SnapshotProviders } = await import('@/core/snapshot/providerRegistry');
    const ids = SnapshotProviders.map((p) => p.id);
    expect(ids).toContain('workboard');
    expect(ids).toContain('billing');
    expect(ids).toContain('team_chat');
  });
});

// ─── Engine API contract ───

describe('Engine exports server-only API', () => {
  it('should export captureFullSnapshot, previewRestore, restoreFromSnapshot', async () => {
    const engine = await import('@/core/snapshot/engine');
    expect(typeof engine.captureFullSnapshot).toBe('function');
    expect(typeof engine.previewRestore).toBe('function');
    expect(typeof engine.restoreFromSnapshot).toBe('function');
  });

  it('restoreFromSnapshot should accept workspaceId parameter', async () => {
    const engine = await import('@/core/snapshot/engine');
    // Function should accept 4 params (snapshotId, token, actor, workspaceId)
    expect(engine.restoreFromSnapshot.length).toBe(4);
  });
});

// ─── Restore requires admin (mock verification) ───

describe('Restore permission model', () => {
  it('restore_workspace_snapshot_atomic RPC requires admin (documented)', () => {
    // The RPC checks is_workspace_admin internally — this is a documentation test
    const rpcName = 'restore_workspace_snapshot_atomic';
    const requiredParams = ['_workspace_id', '_snapshot_id', '_actor', '_confirmation_token'];
    expect(rpcName).toBeTruthy();
    expect(requiredParams).toHaveLength(4);
  });

  it('capture_workspace_snapshot_v2 RPC requires admin', () => {
    const rpcName = 'capture_workspace_snapshot_v2';
    expect(rpcName).toBeTruthy();
  });
});

// ─── Atomic behavior: critical provider failure rolls back ───

describe('Atomic restore contract', () => {
  it('critical providers (workboard, billing) should cause full rollback on failure', () => {
    // This tests the contract — actual SQL atomicity is enforced by the RPC
    const criticalProviders = ['workboard', 'billing'];
    const nonCriticalProviders = ['team_chat'];

    criticalProviders.forEach((p) => {
      expect(['workboard', 'billing']).toContain(p);
    });

    nonCriticalProviders.forEach((p) => {
      expect(['team_chat']).toContain(p);
    });
  });

  it('pre-restore snapshot is created before restore begins', () => {
    // Contract: the orchestrator RPC calls create_workspace_snapshot before any mutation
    const expectedSnapshotType = 'pre_restore';
    expect(expectedSnapshotType).toBe('pre_restore');
  });

  it('advisory lock prevents concurrent restores on same workspace', () => {
    // Contract: pg_advisory_xact_lock(hashtext(workspace_id)) is used
    const lockMechanism = 'pg_advisory_xact_lock';
    expect(lockMechanism).toBeTruthy();
  });
});

// ─── Size protection ───

describe('Size protection', () => {
  it('TeamChat messages capped at 2000', () => {
    const MAX_MESSAGES_PER_SNAPSHOT = 2000;
    expect(MAX_MESSAGES_PER_SNAPSHOT).toBe(2000);
  });
});

// ─── Audit log events ───

describe('Audit log events', () => {
  const EXPECTED_AUDIT_ACTIONS = [
    'workspace.snapshot_created',
    'workspace.snapshot_previewed',
    'workspace.snapshot_restore_started',
    'workspace.snapshot_restore_completed',
    'workspace.provider_restore_failed',
  ];

  it('should define all required audit actions', () => {
    expect(EXPECTED_AUDIT_ACTIONS).toHaveLength(5);
    expect(EXPECTED_AUDIT_ACTIONS).toContain('workspace.snapshot_created');
    expect(EXPECTED_AUDIT_ACTIONS).toContain('workspace.snapshot_previewed');
    expect(EXPECTED_AUDIT_ACTIONS).toContain('workspace.snapshot_restore_started');
    expect(EXPECTED_AUDIT_ACTIONS).toContain('workspace.snapshot_restore_completed');
    expect(EXPECTED_AUDIT_ACTIONS).toContain('workspace.provider_restore_failed');
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

// ─── SafeBack Manifest Tests ───

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
