/**
 * Snapshot Engine v1 — Orchestrator
 *
 * Coordinates all registered SnapshotProviders for capture & restore.
 * SafeBack and Recovery hooks call only this module.
 */
import { supabase } from '@/integrations/supabase/client';
import { SnapshotProviders } from './providerRegistry';
import type { ProviderFragment, SnapshotPayload } from './types';

// ─── Capture ───

export async function captureFullSnapshot(
  workspaceId: string,
  createdBy: string,
  snapshotType: string = 'manual',
): Promise<string> {
  const fragments: ProviderFragment[] = [];

  for (const provider of SnapshotProviders) {
    const fragment = await provider.capture(workspaceId);
    fragments.push(fragment);
  }

  const payload: SnapshotPayload = {
    engine_version: 1,
    created_at: new Date().toISOString(),
    fragments,
  };

  const { data, error } = await (supabase as any)
    .from('workspace_snapshots')
    .insert({
      workspace_id: workspaceId,
      snapshot_type: snapshotType,
      created_by: createdBy,
      snapshot_json: payload,
    })
    .select('id')
    .single();

  if (error) throw error;
  return data.id as string;
}

// ─── Preview ───

export interface PreviewResult {
  confirmation_token: string;
  summary: {
    providers: {
      provider_id: string;
      name: string;
      description: string;
      critical: boolean;
      entity_count: number;
    }[];
    snapshot_created_at: string;
    snapshot_type: string;
    will_replace: Record<string, number>;
    will_restore: Record<string, number>;
  };
  expires_in_seconds: number;
}

export async function previewRestore(
  snapshotId: string,
  actor: string,
): Promise<PreviewResult> {
  // Read the snapshot
  const { data: snap, error: snapErr } = await (supabase as any)
    .from('workspace_snapshots')
    .select('*')
    .eq('id', snapshotId)
    .single();

  if (snapErr || !snap) throw new Error('Snapshot not found');

  const payload = snap.snapshot_json as SnapshotPayload;

  // Generate confirmation token via RPC (keeps server-side security)
  const { data: tokenData, error: tokenErr } = await supabase.rpc(
    'generate_restore_token' as any,
    { _snapshot_id: snapshotId, _actor: actor },
  );
  if (tokenErr) throw tokenErr;

  // Build provider-aware summary
  const providerSummaries = payload.fragments.map((frag) => {
    const provider = SnapshotProviders.find((p) => p.id === frag.provider_id);
    const desc = provider?.describe() || {
      name: frag.provider_id,
      description: 'Unknown provider',
      critical: false,
    };
    return {
      provider_id: frag.provider_id,
      name: desc.name,
      description: desc.description,
      critical: desc.critical,
      entity_count: frag.metadata?.entity_count || 0,
    };
  });

  // Legacy compat — will_restore / will_replace maps
  const will_restore: Record<string, number> = {};
  const will_replace: Record<string, number> = {};
  for (const ps of providerSummaries) {
    will_restore[ps.provider_id] = ps.entity_count;
    will_replace[ps.provider_id] = 0; // actual counts are expensive; UI shows provider-level
  }

  return {
    confirmation_token: tokenData as string,
    summary: {
      providers: providerSummaries,
      snapshot_created_at: snap.created_at,
      snapshot_type: snap.snapshot_type,
      will_restore,
      will_replace,
    },
    expires_in_seconds: 600,
  };
}

// ─── Restore ───

export async function restoreFromSnapshot(
  snapshotId: string,
  confirmationToken: string,
  actor: string,
): Promise<Record<string, number>> {
  // Validate token via RPC
  const { data: valid, error: valErr } = await supabase.rpc(
    'validate_restore_token' as any,
    {
      _snapshot_id: snapshotId,
      _token: confirmationToken,
      _actor: actor,
    },
  );
  if (valErr || !valid) throw new Error('Invalid or expired confirmation token');

  // Read snapshot
  const { data: snap, error: snapErr } = await (supabase as any)
    .from('workspace_snapshots')
    .select('*')
    .eq('id', snapshotId)
    .single();

  if (snapErr || !snap) throw new Error('Snapshot not found');

  const payload = snap.snapshot_json as SnapshotPayload;
  const workspaceId = snap.workspace_id as string;

  // Safety snapshot before restore
  await captureFullSnapshot(workspaceId, actor, 'pre_restore');

  // Execute provider restores
  const restoredCounts: Record<string, number> = {};

  for (const fragment of payload.fragments) {
    const provider = SnapshotProviders.find(
      (p) => p.id === fragment.provider_id,
    );
    if (!provider) continue;

    const descriptor = provider.describe();

    try {
      await provider.restore(workspaceId, fragment);
      restoredCounts[fragment.provider_id] =
        fragment.metadata?.entity_count || 0;
    } catch (err) {
      if (descriptor.critical) {
        throw err; // Critical providers must not fail silently
      }
      console.error(
        `Non-critical provider ${provider.id} restore failed:`,
        err,
      );
    }
  }

  return restoredCounts;
}
