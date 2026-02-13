/**
 * Booking Audit & OIL Event Helpers
 *
 * writeAudit → audit_logs table
 * emitOrgEvent → oil-ingest edge function
 *
 * Both are fire-and-forget: failures log to console but never block UX.
 */
import { supabase } from '@/integrations/supabase/client';

const OIL_INGEST_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/oil-ingest`;

// ── Audit Log ──

export async function writeAudit(params: {
  workspace_id: string;
  actor_user_id: string;
  action: string;       // e.g. 'booking.service_created'
  entity_type: string;  // e.g. 'booking_service'
  entity_id?: string;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  try {
    const { error } = await supabase.from('audit_logs').insert({
      workspace_id: params.workspace_id,
      actor_user_id: params.actor_user_id,
      action: params.action,
      entity_type: params.entity_type,
      entity_id: params.entity_id || null,
      metadata: (params.metadata || {}) as any,
    } as any);
    if (error) {
      console.error('[Audit] Insert failed (non-fatal):', error.message);
    }
  } catch (err) {
    console.error('[Audit] Unexpected error (non-fatal):', err);
  }
}

// ── OIL Org Event ──

export async function emitOrgEvent(params: {
  workspace_id: string;
  actor_user_id: string;
  event_type: string;           // e.g. 'booking.service_published'
  entity_type: string;          // e.g. 'booking_service'
  entity_id?: string;
  meaning_object_id?: string;
  severity_hint?: 'info' | 'warning' | 'critical';
  metadata?: Record<string, unknown>;
}): Promise<void> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    if (!token) return;

    await fetch(OIL_INGEST_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        workspace_id: params.workspace_id,
        events: [{
          event_type: params.event_type,
          object_type: params.entity_type,
          meaning_object_id: params.meaning_object_id,
          severity_hint: params.severity_hint || 'info',
          metadata: {
            entity_id: params.entity_id,
            actor_user_id: params.actor_user_id,
            ...params.metadata,
          },
        }],
      }),
    });
  } catch {
    // Silent — OIL events are non-critical
  }
}

// ── Combined Helper (audit + OIL in one call) ──

export async function auditAndEmit(params: {
  workspace_id: string;
  actor_user_id: string;
  action: string;
  event_type: string;
  entity_type: string;
  entity_id?: string;
  meaning_object_id?: string;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  await Promise.all([
    writeAudit({
      workspace_id: params.workspace_id,
      actor_user_id: params.actor_user_id,
      action: params.action,
      entity_type: params.entity_type,
      entity_id: params.entity_id,
      metadata: params.metadata,
    }),
    emitOrgEvent({
      workspace_id: params.workspace_id,
      actor_user_id: params.actor_user_id,
      event_type: params.event_type,
      entity_type: params.entity_type,
      entity_id: params.entity_id,
      meaning_object_id: params.meaning_object_id,
      metadata: params.metadata,
    }),
  ]);
}
