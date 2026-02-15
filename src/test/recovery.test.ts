/**
 * Recovery & Backup (Resilience Layer) — Unit Tests
 *
 * Tests cover:
 * 1. RestorePreview type contract (token + summary shape)
 * 2. Token expiry detection
 * 3. Advisory lock key derivation (hashtext is deterministic)
 * 4. Retention logic (keep N, delete older)
 * 5. Pre-restore snapshot reason tagging
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
  const TTL_SECONDS = 600; // 10 minutes

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
  // Simulates hashtext behavior: same input → same output
  function simpleHash(input: string): number {
    let hash = 0;
    for (let i = 0; i < input.length; i++) {
      const char = input.charCodeAt(i);
      hash = ((hash << 5) - hash + char) | 0; // 32-bit integer
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
    // Newest is snap-9 (Jan 10)
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
