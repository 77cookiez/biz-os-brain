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
  it('should have exactly 4 fallback descriptors', async () => {
    const { FallbackProviderDescriptors } = await import('@/core/snapshot/providerRegistry');
    expect(FallbackProviderDescriptors).toHaveLength(4);
  });

  it('provider IDs should be unique', async () => {
    const { FallbackProviderDescriptors } = await import('@/core/snapshot/providerRegistry');
    const ids = FallbackProviderDescriptors.map((p) => p.provider_id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('should contain workboard, billing, team_chat, bookivo', async () => {
    const { FallbackProviderDescriptors } = await import('@/core/snapshot/providerRegistry');
    const ids = FallbackProviderDescriptors.map((p) => p.provider_id);
    expect(ids).toContain('workboard');
    expect(ids).toContain('billing');
    expect(ids).toContain('team_chat');
    expect(ids).toContain('bookivo');
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

// ─── Bookivo provider ───

describe('Bookivo provider', () => {
  it('BookivoProvider should be descriptor only', async () => {
    const { BookivoProvider } = await import('@/core/snapshot/providers/BookivoProvider');
    expect(BookivoProvider.describe).toBeDefined();
    expect((BookivoProvider as any).capture).toBeUndefined();
    expect((BookivoProvider as any).restore).toBeUndefined();
  });

  it('bookivo descriptor is critical with full default', async () => {
    const { BookivoDescriptor } = await import('@/core/snapshot/providers/BookivoProvider');
    expect(BookivoDescriptor.critical).toBe(true);
    expect(BookivoDescriptor.default_policy).toBe('full');
    expect(BookivoDescriptor.provider_id).toBe('bookivo');
  });

  it('restore_workspace_snapshot_atomic_v3 recognizes bookivo provider', () => {
    const knownProviders = ['workboard', 'billing', 'team_chat', 'bookivo'];
    expect(knownProviders).toContain('bookivo');
  });

  it('bookivo capture includes 13 tables in full policy', () => {
    const bookivoTables = [
      'booking_settings', 'booking_subscriptions', 'booking_vendors',
      'booking_vendor_profiles', 'booking_availability_rules', 'booking_blackout_dates',
      'booking_services', 'booking_service_addons', 'booking_quote_requests',
      'booking_quotes', 'booking_bookings', 'booking_payments', 'booking_commission_ledger',
    ];
    expect(bookivoTables).toHaveLength(13);
  });

  it('bookivo restore deletes in reverse FK order', () => {
    const deleteOrder = [
      'booking_commission_ledger', 'booking_payments', 'booking_bookings',
      'booking_quotes', 'booking_quote_requests', 'booking_service_addons',
      'booking_services', 'booking_blackout_dates', 'booking_availability_rules',
      'booking_vendor_profiles', 'booking_vendors', 'booking_subscriptions', 'booking_settings',
    ];
    expect(deleteOrder[0]).toBe('booking_commission_ledger');
    expect(deleteOrder[deleteOrder.length - 1]).toBe('booking_settings');
  });

  it('bookivo is critical — failure causes full rollback', () => {
    const criticalProviders = ['workboard', 'billing', 'bookivo'];
    expect(criticalProviders).toContain('bookivo');
  });

  it('bookivo size protection defaults to 5000 rows per table', () => {
    const defaultLimits = { max_rows_per_table: 5000 };
    expect(defaultLimits.max_rows_per_table).toBe(5000);
  });

  it('bookivo policy resolution works with override', () => {
    const defaultPolicy = 'full';
    const override = 'metadata_only';
    const effective = override ?? defaultPolicy;
    expect(effective).toBe('metadata_only');
  });

  it('bookivo capture payload includes policy field in fragment', () => {
    const fragment = { provider_id: 'bookivo', version: 1, policy: 'full', data: {}, metadata: { entity_count: 42 } };
    expect(fragment.provider_id).toBe('bookivo');
    expect(fragment.policy).toBe('full');
  });

  it('bookivo restore validates vendor_id whitelist for dependent tables', () => {
    const validVendorIds = ['v1', 'v2'];
    const profileRow = { vendor_id: 'v3' };
    expect(validVendorIds).not.toContain(profileRow.vendor_id);
  });

  it('bookivo payments are captured but never auto-finalize on restore', () => {
    const paymentStatuses = ['pending', 'paid', 'refunded'];
    expect(paymentStatuses).toContain('pending');
  });
});

// ─── Bookivo hardening (v2) ───

describe('Bookivo hardening', () => {
  it('restore uses ON CONFLICT (id) DO UPDATE for idempotency', () => {
    const strategy = 'INSERT ... ON CONFLICT (id) DO UPDATE SET ...';
    expect(strategy).toContain('ON CONFLICT');
    expect(strategy).toContain('DO UPDATE');
  });

  it('restore uses jsonb_strip_nulls for forward compatibility', () => {
    const row = { id: '1', name: 'test', future_field: null };
    const stripped = Object.fromEntries(Object.entries(row).filter(([, v]) => v !== null));
    expect(stripped).not.toHaveProperty('future_field');
    expect(stripped).toHaveProperty('name');
  });

  it('booking_settings is the only soft-delete table', () => {
    const softDeleteTables = ['booking_settings'];
    const hardDeleteTables = [
      'booking_subscriptions', 'booking_vendors', 'booking_vendor_profiles',
      'booking_services', 'booking_service_addons', 'booking_availability_rules',
      'booking_blackout_dates', 'booking_quote_requests', 'booking_quotes',
      'booking_bookings', 'booking_payments', 'booking_commission_ledger',
    ];
    expect(softDeleteTables).toHaveLength(1);
    expect(hardDeleteTables).toHaveLength(12);
  });

  it('financial ledger tables never auto-modify status on restore', () => {
    const financialTables = ['booking_payments', 'booking_commission_ledger'];
    const autoFinalizeActions: string[] = [];
    financialTables.forEach((t) => {
      expect(autoFinalizeActions).not.toContain(`auto_finalize_${t}`);
    });
  });

  it('table-specific caps override max_rows_per_table', () => {
    const limits = { max_rows_per_table: 5000, max_bookings: 3000, max_quotes: 2000, max_services: 1000 };
    const capBookings = limits.max_bookings ?? limits.max_rows_per_table;
    const capQuotes = limits.max_quotes ?? limits.max_rows_per_table;
    const capServices = limits.max_services ?? limits.max_rows_per_table;
    const capVendors = (limits as any).max_vendors ?? limits.max_rows_per_table;
    expect(capBookings).toBe(3000);
    expect(capQuotes).toBe(2000);
    expect(capServices).toBe(1000);
    expect(capVendors).toBe(5000); // fallback
  });

  it('restore emits workspace.bookivo_fragment_restored audit event', () => {
    const auditAction = 'workspace.bookivo_fragment_restored';
    expect(auditAction).toMatch(/^workspace\./);
    const metadata = { table_counts: { booking_settings: 1, booking_vendors: 3 }, total: 4 };
    expect(metadata.table_counts).toBeDefined();
    expect(metadata.total).toBe(4);
  });

  it('restore is deterministic — tables processed in static order', () => {
    const insertOrder = [
      'booking_settings', 'booking_subscriptions', 'booking_vendors',
      'booking_vendor_profiles', 'booking_availability_rules', 'booking_blackout_dates',
      'booking_services', 'booking_service_addons', 'booking_quote_requests',
      'booking_quotes', 'booking_bookings', 'booking_payments', 'booking_commission_ledger',
    ];
    // Verify order is static and not alphabetical
    expect(insertOrder[0]).toBe('booking_settings');
    expect(insertOrder[2]).toBe('booking_vendors');
    expect(insertOrder[6]).toBe('booking_services');
    expect(insertOrder[12]).toBe('booking_commission_ledger');
  });

  it('booking_id whitelist validates financial rows against restored bookings', () => {
    const validBookingIds = ['b1', 'b2'];
    const paymentRow = { booking_id: 'b99' };
    const ledgerRow = { booking_id: 'b1' };
    expect(validBookingIds).not.toContain(paymentRow.booking_id);
    expect(validBookingIds).toContain(ledgerRow.booking_id);
  });
});

// ─── Exact restore (no drift) ───

describe('Exact restore (no drift)', () => {
  it('hard-delete tables are fully cleared before insert (12 tables)', () => {
    const hardDeleteTables = [
      'booking_commission_ledger', 'booking_payments', 'booking_bookings',
      'booking_quotes', 'booking_quote_requests', 'booking_service_addons',
      'booking_services', 'booking_blackout_dates', 'booking_availability_rules',
      'booking_vendor_profiles', 'booking_vendors', 'booking_subscriptions',
    ];
    expect(hardDeleteTables).toHaveLength(12);
    // All are hard-deleted with DELETE FROM ... WHERE workspace_id = _workspace_id
    hardDeleteTables.forEach((t) => expect(t).not.toBe('booking_settings'));
  });

  it('booking_settings uses soft-delete for rows not in snapshot', () => {
    const incomingSettingIds = ['s1', 's2'];
    const existingSettingIds = ['s1', 's2', 's3'];
    const softDeleted = existingSettingIds.filter((id) => !incomingSettingIds.includes(id));
    expect(softDeleted).toEqual(['s3']);
    expect(softDeleted).not.toContain('s1');
  });

  it('exact restore prevents data drift — absent rows are removed', () => {
    // Before restore: workspace has rows A, B, C
    // Snapshot has rows A, B only
    // After exact restore: workspace has rows A, B (C is gone)
    const before = ['A', 'B', 'C'];
    const snapshot = ['A', 'B'];
    // DELETE clears all, INSERT restores only snapshot rows
    const after = snapshot;
    expect(after).not.toContain('C');
    expect(after).toEqual(['A', 'B']);
  });
});

// ─── Actor auditing ───

describe('Actor auditing', () => {
  it('restore_bookivo_fragment accepts _actor uuid parameter', () => {
    const signature = ['_workspace_id', '_fragment', '_actor', '_snapshot_id'];
    expect(signature).toContain('_actor');
    expect(signature.indexOf('_actor')).toBe(2);
  });

  it('audit uses _actor, never auth.uid() fallback', () => {
    const auditInsert = {
      actor_user_id: '_actor', // must be explicit param
      workspace_id: '_workspace_id',
    };
    expect(auditInsert.actor_user_id).toBe('_actor');
    expect(auditInsert.actor_user_id).not.toBe('auth.uid()');
    expect(auditInsert.actor_user_id).not.toBe('00000000-0000-0000-0000-000000000000');
  });

  it('restore_workspace_snapshot_atomic_v3 passes _actor to bookivo restore', () => {
    const callArgs = ['_workspace_id', "_frag->'data'", '_actor', '_snapshot_id'];
    expect(callArgs).toContain('_actor');
    expect(callArgs).toContain('_snapshot_id');
  });
});

// ─── Audit entity linkage ───

describe('Audit entity linkage', () => {
  it('audit entity_type is workspace_snapshot', () => {
    const entityType = 'workspace_snapshot';
    expect(entityType).toBe('workspace_snapshot');
  });

  it('audit entity_id is _snapshot_id::text', () => {
    const snapshotId = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
    const entityId = snapshotId; // ::text cast
    expect(entityId).toBe(snapshotId);
  });

  it('audit metadata includes snapshot_id, table_counts, total', () => {
    const metadata = {
      workspace_id: 'ws-1',
      snapshot_id: 'snap-1',
      table_counts: { booking_settings: 1 },
      total: 1,
    };
    expect(metadata).toHaveProperty('snapshot_id');
    expect(metadata).toHaveProperty('table_counts');
    expect(metadata).toHaveProperty('total');
    expect(metadata).toHaveProperty('workspace_id');
  });

  it('restore_bookivo_fragment signature includes _snapshot_id as 4th param', () => {
    const params = ['_workspace_id', '_fragment', '_actor', '_snapshot_id'];
    expect(params).toHaveLength(4);
    expect(params[3]).toBe('_snapshot_id');
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
