/**
 * Snapshot Engine v1 — Server-Side Only
 *
 * All capture/preview/restore goes through the safeback-engine Edge Function
 * or server-side RPCs. No direct table mutations from client.
 */
import { supabase } from '@/integrations/supabase/client';

// ─── Types ───

export interface PreviewProviderSummary {
  provider_id: string;
  name: string;
  description: string;
  critical: boolean;
  entity_count: number;
}

export interface PreviewResult {
  confirmation_token: string;
  summary: {
    providers: PreviewProviderSummary[];
    snapshot_created_at: string;
    snapshot_type: string;
  };
  expires_in_seconds: number;
}

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
  workspaceId: string,
): Promise<Record<string, number>> {
  const result = await callEngine('restore', {
    snapshot_id: snapshotId,
    confirmation_token: confirmationToken,
    workspace_id: workspaceId,
  });
  return result.restored_counts || {};
}
