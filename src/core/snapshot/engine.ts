/**
 * Snapshot Engine v2 — Thin HTTP Client
 *
 * All capture/preview/restore goes through the safeback-engine Edge Function.
 * No direct table mutations from client.
 */
import { supabase } from '@/integrations/supabase/client';
import type { PreviewResult, EffectiveProvider } from './types';

// ─── Edge Function Caller ───

async function callEngine(action: string, body: Record<string, unknown>) {
  const { data: session } = await supabase.auth.getSession();
  const token = session.session?.access_token;
  if (!token) throw new Error('Not authenticated');

  const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/safeback-engine/${action}`;
  const resp = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  const data = await resp.json();
  if (!resp.ok) throw new Error(data.error || 'Engine call failed');
  return data;
}

// ─── Public API ───

export async function captureFullSnapshot(
  workspaceId: string,
  _createdBy: string,
  reason?: string,
): Promise<string> {
  const result = await callEngine('capture', {
    workspace_id: workspaceId,
    reason,
  });
  return result.snapshot_id;
}

export async function previewRestore(
  snapshotId: string,
  _actor: string,
): Promise<PreviewResult> {
  const result = await callEngine('preview', { snapshot_id: snapshotId });
  return result as PreviewResult;
}

export async function restoreFromSnapshot(
  snapshotId: string,
  confirmationToken: string,
  _actor: string,
  _workspaceId: string,
): Promise<Record<string, number>> {
  const result = await callEngine('restore', {
    snapshot_id: snapshotId,
    confirmation_token: confirmationToken,
  });
  return result.restored_counts || {};
}

export async function getEffectiveProviders(
  workspaceId: string,
): Promise<EffectiveProvider[]> {
  const result = await callEngine('providers', { workspace_id: workspaceId });
  return result.providers || [];
}
