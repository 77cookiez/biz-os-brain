
-- ══════════════════════════════════════════════════════════════
-- Milestone 6: Cleanup, Indexing & Observability
-- ══════════════════════════════════════════════════════════════

-- ── 1. Indexes ──

-- draft_confirmations: ensure draft_id is unique (PK or unique)
-- draft_id is already PK from migration, but add workspace+expires index for cleanup queries
CREATE INDEX IF NOT EXISTS idx_draft_confirmations_ws_expires
  ON public.draft_confirmations (workspace_id, expires_at);

-- executed_drafts: status + updated_at for cleanup queries
CREATE INDEX IF NOT EXISTS idx_executed_drafts_status_updated
  ON public.executed_drafts (status, updated_at);

-- executed_drafts: workspace + updated_at for workspace-scoped queries
CREATE INDEX IF NOT EXISTS idx_executed_drafts_ws_updated
  ON public.executed_drafts (workspace_id, updated_at);

-- ── 2. Cleanup RPC: expired draft confirmations ──

CREATE OR REPLACE FUNCTION public.cleanup_expired_draft_confirmations(
  _now timestamptz DEFAULT now(),
  _batch int DEFAULT 500
)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _deleted int;
  _epoch_ms bigint;
BEGIN
  -- expires_at is stored as bigint (epoch milliseconds)
  _epoch_ms := (EXTRACT(EPOCH FROM _now) * 1000)::bigint;
  
  DELETE FROM draft_confirmations
  WHERE ctid IN (
    SELECT ctid FROM draft_confirmations
    WHERE expires_at < _epoch_ms
    ORDER BY expires_at ASC
    LIMIT _batch
  );
  
  GET DIAGNOSTICS _deleted = ROW_COUNT;
  RETURN _deleted;
END;
$$;

-- ── 3. Cleanup RPC: stale reserved executed_drafts ──

CREATE OR REPLACE FUNCTION public.cleanup_stale_executed_drafts(
  _stale_threshold interval DEFAULT interval '10 minutes',
  _batch int DEFAULT 500
)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _deleted int;
BEGIN
  DELETE FROM executed_drafts
  WHERE ctid IN (
    SELECT ctid FROM executed_drafts
    WHERE status = 'reserved'
      AND COALESCE(updated_at, created_at) < (now() - _stale_threshold)
    ORDER BY COALESCE(updated_at, created_at) ASC
    LIMIT _batch
  );
  
  GET DIAGNOSTICS _deleted = ROW_COUNT;
  RETURN _deleted;
END;
$$;

-- ── 4. Permission lockdown: only service_role can call cleanup functions ──

REVOKE ALL ON FUNCTION public.cleanup_expired_draft_confirmations(timestamptz, int) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.cleanup_expired_draft_confirmations(timestamptz, int) FROM anon;
REVOKE ALL ON FUNCTION public.cleanup_expired_draft_confirmations(timestamptz, int) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.cleanup_expired_draft_confirmations(timestamptz, int) TO service_role;

REVOKE ALL ON FUNCTION public.cleanup_stale_executed_drafts(interval, int) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.cleanup_stale_executed_drafts(interval, int) FROM anon;
REVOKE ALL ON FUNCTION public.cleanup_stale_executed_drafts(interval, int) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.cleanup_stale_executed_drafts(interval, int) TO service_role;
