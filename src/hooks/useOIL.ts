import { useCallback } from 'react';
import { useWorkspace } from '@/contexts/WorkspaceContext';

const OIL_INGEST_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/oil-ingest`;

interface OrgEvent {
  event_type: string;
  object_type: string;
  meaning_object_id?: string;
  severity_hint?: 'info' | 'warning' | 'critical';
  metadata?: Record<string, unknown>;
}

/**
 * Hook for emitting organizational events to OIL.
 * 
 * Usage:
 *   const { emitEvent, emitEvents } = useOIL();
 *   emitEvent({ event_type: 'task.created', object_type: 'task', meaning_object_id: '...' });
 * 
 * Events are fire-and-forget — failures are silent and non-blocking.
 */
export function useOIL() {
  const { currentWorkspace } = useWorkspace();

  const emitEvents = useCallback(async (events: OrgEvent[]) => {
    if (!currentWorkspace || events.length === 0) return;

    try {
      await fetch(OIL_INGEST_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({
          workspace_id: currentWorkspace.id,
          events,
        }),
      });
    } catch {
      // Silent failure — OIL events are non-critical
    }
  }, [currentWorkspace]);

  const emitEvent = useCallback((event: OrgEvent) => {
    emitEvents([event]);
  }, [emitEvents]);

  return { emitEvent, emitEvents };
}
