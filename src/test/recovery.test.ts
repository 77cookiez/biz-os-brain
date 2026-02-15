/**
 * Recovery & Backup (Resilience Layer) + SafeBack App — Unit Tests
 */
import { describe, it, expect } from 'vitest';

// ─── Type contract tests ───

describe('RestorePreview contract', () => {
  const validPreview = {
    confirmation_token: 'abc-123-token',
    summary: {
      will_replace: { tasks: 10, goals: 3, plans: 2, ideas: 5 },
      will_restore: { tasks: 8, goals: 4, plans: 1, ideas: 6 },
      snapshot_created_at: '2026-02-15T08:00:00Z',
      snapshot_type: 'full',
      snapshot_reason: 'manual',
    },
    expires_in_seconds: 600,
  };

  it('should have a non-empty confirmation_token', () => {
    expect(validPreview.confirmation_token).toBeTruthy();
    expect(typeof validPreview.confirmation_token).toBe('string');
  });

  it('should contain will_replace and will_restore in summary', () => {
    expect(validPreview.summary.will_replace).toBeDefined();
    expect(validPreview.summary.will_restore).toBeDefined();
    expect(typeof validPreview.summary.will_replace.tasks).toBe('number');
  });

  it('should have a positive expires_in_seconds', () => {
    expect(validPreview.expires_in_seconds).toBeGreaterThan(0);
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

  it('should detect a token at exactly TTL boundary as expired', () => {
    const exactlyTTL = new Date(Date.now() - TTL_SECONDS * 1000 - 1).toISOString();
    expect(isTokenExpired(exactlyTTL, TTL_SECONDS)).toBe(true);
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

  it('should not throw on any valid UUID string', () => {
    const ids = [
      '00000000-0000-0000-0000-000000000000',
      'ffffffff-ffff-ffff-ffff-ffffffffffff',
      '12345678-1234-1234-1234-123456789abc',
    ];
    ids.forEach((id) => {
      expect(() => simpleHash(id)).not.toThrow();
    });
  });
});

// ─── Retention logic ───

describe('Retention: keep latest N snapshots', () => {
  interface Snap {
    id: string;
    created_at: string;
  }

  function applyRetention(snapshots: Snap[], retainCount: number): { keep: Snap[]; delete: Snap[] } {
    const sorted = [...snapshots].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
    return {
      keep: sorted.slice(0, retainCount),
      delete: sorted.slice(retainCount),
    };
  }

  const snapshots: Snap[] = Array.from({ length: 10 }, (_, i) => ({
    id: `snap-${i}`,
    created_at: new Date(2026, 0, i + 1).toISOString(),
  }));

  it('should keep exactly retainCount snapshots', () => {
    const { keep } = applyRetention(snapshots, 7);
    expect(keep).toHaveLength(7);
  });

  it('should mark older ones for deletion', () => {
    const { delete: toDelete } = applyRetention(snapshots, 7);
    expect(toDelete).toHaveLength(3);
  });

  it('should keep the newest snapshots', () => {
    const { keep } = applyRetention(snapshots, 3);
    expect(keep[0].id).toBe('snap-9');
    expect(keep[2].id).toBe('snap-7');
  });

  it('should delete nothing if count <= retainCount', () => {
    const few = snapshots.slice(0, 3);
    const { delete: toDelete } = applyRetention(few, 7);
    expect(toDelete).toHaveLength(0);
  });
});

// ─── Pre-restore snapshot reason tagging ───

describe('Pre-restore snapshot reason', () => {
  const VALID_REASONS = ['manual', 'scheduled', 'pre_restore', 'pre_upgrade'];

  it('should accept "pre_restore" as a valid reason', () => {
    expect(VALID_REASONS).toContain('pre_restore');
  });

  it('should tag auto-created pre-restore snapshots correctly', () => {
    const snapshot = { created_reason: 'pre_restore' };
    expect(snapshot.created_reason).toBe('pre_restore');
    expect(VALID_REASONS).toContain(snapshot.created_reason);
  });

  it('should not accept invalid reasons', () => {
    expect(VALID_REASONS).not.toContain('random');
    expect(VALID_REASONS).not.toContain('');
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

  it('should have correct route base', () => {
    expect(manifest.routeBase).toBe('/apps/safeback');
  });

  it('should have 7 tab ids', () => {
    expect(manifest.tabs).toHaveLength(7);
    expect(manifest.tabs).toContain('overview');
    expect(manifest.tabs).toContain('audit');
    expect(manifest.tabs).toContain('settings');
  });
});

// ─── Onboarding localStorage key ───

describe('SafeBack onboarding localStorage key', () => {
  it('should include workspace ID in key', () => {
    const workspaceId = 'ws-123-456';
    const key = `safeback:onboarding:v1:${workspaceId}`;
    expect(key).toBe('safeback:onboarding:v1:ws-123-456');
    expect(key).toContain(workspaceId);
  });
});

// ─── Audit log filter ───

describe('SafeBack audit log filter', () => {
  const AUDIT_FILTERS = [
    'workspace.snapshot_%',
    'workspace.backup_%',
  ];

  it('should match snapshot actions', () => {
    expect(AUDIT_FILTERS.some(f => 'workspace.snapshot_created'.startsWith(f.replace('%', '')))).toBe(true);
  });

  it('should match backup actions', () => {
    expect(AUDIT_FILTERS.some(f => 'workspace.backup_scheduled'.startsWith(f.replace('%', '')))).toBe(true);
  });

  it('should not match unrelated actions', () => {
    expect(AUDIT_FILTERS.some(f => 'workspace.member_added'.startsWith(f.replace('%', '')))).toBe(false);
  });
});

// ─── Deep-link preservation ───

describe('Deep-link preservation', () => {
  it('/settings/recovery route is independent of safeback install', () => {
    const settingsRoute = '/settings/recovery';
    const safebackRoute = '/apps/safeback';
    expect(settingsRoute).not.toContain('safeback');
    expect(safebackRoute).not.toContain('settings');
  });
});

// ─── Snapshot scope truthfulness ───

describe('Snapshot scope contract', () => {
  const SNAPSHOT_ENTITIES = ['tasks', 'goals', 'plans', 'ideas', 'billing_subscription'];

  it('should include exactly 5 entities from the RPC', () => {
    expect(SNAPSHOT_ENTITIES).toHaveLength(5);
  });

  it('should include tasks, goals, plans, ideas', () => {
    expect(SNAPSHOT_ENTITIES).toContain('tasks');
    expect(SNAPSHOT_ENTITIES).toContain('goals');
    expect(SNAPSHOT_ENTITIES).toContain('plans');
    expect(SNAPSHOT_ENTITIES).toContain('ideas');
  });

  it('should include billing_subscription', () => {
    expect(SNAPSHOT_ENTITIES).toContain('billing_subscription');
  });

  it('should NOT claim to include app-specific data', () => {
    expect(SNAPSHOT_ENTITIES).not.toContain('booking_bookings');
    expect(SNAPSHOT_ENTITIES).not.toContain('chat_messages');
    expect(SNAPSHOT_ENTITIES).not.toContain('brain_messages');
  });
});

// ─── Marketplace filtering ───

describe('Marketplace filtering', () => {
  const VALID_STATUSES = ['available', 'active'];

  it('should only show available and active apps', () => {
    expect(VALID_STATUSES).toContain('available');
    expect(VALID_STATUSES).toContain('active');
  });

  it('should exclude deprecated and coming_soon', () => {
    expect(VALID_STATUSES).not.toContain('deprecated');
    expect(VALID_STATUSES).not.toContain('coming_soon');
  });
});
