
-- ═══════════════════════════════════════════════
-- Milestone 8: Rate Limits + Request Deduplication
-- ═══════════════════════════════════════════════

-- ── 1. Rate Limits table ──
CREATE TABLE IF NOT EXISTS public.rate_limits (
  workspace_id uuid NOT NULL,
  user_id uuid NOT NULL,
  action text NOT NULL,
  window_start timestamptz NOT NULL,
  counter int NOT NULL DEFAULT 1,
  PRIMARY KEY (workspace_id, user_id, action, window_start)
);

ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;

-- No RLS policies needed — accessed only via SECURITY DEFINER RPC

-- ── 2. Request Deduplication table ──
CREATE TABLE IF NOT EXISTS public.request_dedupes (
  request_id text PRIMARY KEY,
  workspace_id uuid NOT NULL,
  user_id uuid NOT NULL,
  mode text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.request_dedupes ENABLE ROW LEVEL SECURITY;

-- No RLS policies needed — accessed only via SECURITY DEFINER RPC / service role

-- ── 3. Indexes ──
CREATE INDEX IF NOT EXISTS idx_rate_limits_lookup
  ON public.rate_limits (workspace_id, user_id, action, window_start);

CREATE INDEX IF NOT EXISTS idx_request_dedupes_ws_created
  ON public.request_dedupes (workspace_id, created_at);

-- ── 4. Rate limit check RPC (atomic increment) ──
CREATE OR REPLACE FUNCTION public.check_rate_limit(
  _action text,
  _workspace_id uuid,
  _user_id uuid,
  _limit int,
  _window_seconds int DEFAULT 60
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _window_start timestamptz;
  _current int;
  _reset_at timestamptz;
BEGIN
  _window_start := date_trunc('second', now()) - (EXTRACT(EPOCH FROM now())::int % _window_seconds) * interval '1 second';
  _reset_at := _window_start + (_window_seconds * interval '1 second');

  INSERT INTO rate_limits (workspace_id, user_id, action, window_start, counter)
  VALUES (_workspace_id, _user_id, _action, _window_start, 1)
  ON CONFLICT (workspace_id, user_id, action, window_start)
  DO UPDATE SET counter = rate_limits.counter + 1
  RETURNING counter INTO _current;

  RETURN jsonb_build_object(
    'allowed', _current <= _limit,
    'remaining', GREATEST(_limit - _current, 0),
    'reset_at', _reset_at
  );
END;
$$;

-- Restrict to service_role only
REVOKE ALL ON FUNCTION public.check_rate_limit(text, uuid, uuid, int, int) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.check_rate_limit(text, uuid, uuid, int, int) FROM anon;
REVOKE ALL ON FUNCTION public.check_rate_limit(text, uuid, uuid, int, int) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.check_rate_limit(text, uuid, uuid, int, int) TO service_role;

-- ── 5. Cleanup RPCs ──
CREATE OR REPLACE FUNCTION public.cleanup_request_dedupes(
  _older_than_minutes int DEFAULT 60,
  _batch int DEFAULT 1000
)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE _deleted int;
BEGIN
  DELETE FROM request_dedupes
  WHERE ctid IN (
    SELECT ctid FROM request_dedupes
    WHERE created_at < now() - (_older_than_minutes * interval '1 minute')
    ORDER BY created_at ASC
    LIMIT _batch
  );
  GET DIAGNOSTICS _deleted = ROW_COUNT;
  RETURN _deleted;
END;
$$;

REVOKE ALL ON FUNCTION public.cleanup_request_dedupes(int, int) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.cleanup_request_dedupes(int, int) FROM anon;
REVOKE ALL ON FUNCTION public.cleanup_request_dedupes(int, int) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.cleanup_request_dedupes(int, int) TO service_role;

CREATE OR REPLACE FUNCTION public.cleanup_rate_limits(
  _older_than_hours int DEFAULT 24,
  _batch int DEFAULT 1000
)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE _deleted int;
BEGIN
  DELETE FROM rate_limits
  WHERE ctid IN (
    SELECT ctid FROM rate_limits
    WHERE window_start < now() - (_older_than_hours * interval '1 hour')
    ORDER BY window_start ASC
    LIMIT _batch
  );
  GET DIAGNOSTICS _deleted = ROW_COUNT;
  RETURN _deleted;
END;
$$;

REVOKE ALL ON FUNCTION public.cleanup_rate_limits(int, int) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.cleanup_rate_limits(int, int) FROM anon;
REVOKE ALL ON FUNCTION public.cleanup_rate_limits(int, int) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.cleanup_rate_limits(int, int) TO service_role;
