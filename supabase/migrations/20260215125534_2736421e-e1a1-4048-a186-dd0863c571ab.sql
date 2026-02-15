
-- Preview restore: generates a summary + confirmation token
CREATE OR REPLACE FUNCTION public.preview_restore_snapshot(_snapshot_id uuid, _actor uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _snap RECORD;
  _token text;
  _summary jsonb;
  _snap_json jsonb;
BEGIN
  IF _actor IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  SELECT * INTO _snap FROM workspace_snapshots WHERE id = _snapshot_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Snapshot not found'; END IF;

  IF NOT is_workspace_admin(_actor, _snap.workspace_id) THEN
    RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE = '42501';
  END IF;

  _snap_json := _snap.snapshot_json;
  _token := encode(gen_random_bytes(32), 'hex');

  -- Store token with 10-min expiry
  INSERT INTO restore_confirmation_tokens (snapshot_id, workspace_id, token, actor_id, expires_at)
  VALUES (_snapshot_id, _snap.workspace_id, _token, _actor, now() + interval '10 minutes');

  _summary := jsonb_build_object(
    'will_restore', jsonb_build_object(
      'tasks', COALESCE(jsonb_array_length(_snap_json->'tasks'), 0),
      'goals', COALESCE(jsonb_array_length(_snap_json->'goals'), 0),
      'plans', COALESCE(jsonb_array_length(_snap_json->'plans'), 0),
      'ideas', COALESCE(jsonb_array_length(_snap_json->'ideas'), 0)
    ),
    'will_replace', jsonb_build_object(
      'tasks', (SELECT count(*) FROM tasks WHERE workspace_id = _snap.workspace_id),
      'goals', (SELECT count(*) FROM goals WHERE workspace_id = _snap.workspace_id),
      'plans', (SELECT count(*) FROM plans WHERE workspace_id = _snap.workspace_id),
      'ideas', (SELECT count(*) FROM ideas WHERE workspace_id = _snap.workspace_id)
    ),
    'snapshot_created_at', _snap.created_at,
    'snapshot_type', _snap.snapshot_type,
    'snapshot_reason', COALESCE(_snap.snapshot_type, 'manual')
  );

  RETURN jsonb_build_object(
    'confirmation_token', _token,
    'summary', _summary,
    'expires_in_seconds', 600
  );
END;
$$;

-- Restore snapshot: validates token, creates pre_restore safety snapshot, then restores
CREATE OR REPLACE FUNCTION public.restore_workspace_snapshot(_snapshot_id uuid, _actor uuid, _confirmation_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _snap RECORD;
  _tok RECORD;
  _snap_json jsonb;
  _pre_snap_id uuid;
  _counts jsonb;
BEGIN
  IF _actor IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  SELECT * INTO _snap FROM workspace_snapshots WHERE id = _snapshot_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Snapshot not found'; END IF;

  IF NOT is_workspace_admin(_actor, _snap.workspace_id) THEN
    RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE = '42501';
  END IF;

  -- Validate token
  SELECT * INTO _tok FROM restore_confirmation_tokens
  WHERE snapshot_id = _snapshot_id AND token = _confirmation_token AND used_at IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'Invalid or expired confirmation token'; END IF;
  IF _tok.expires_at < now() THEN RAISE EXCEPTION 'Confirmation token expired'; END IF;

  -- Lock workspace to prevent concurrent restores
  PERFORM pg_advisory_xact_lock(hashtext(_snap.workspace_id::text));

  -- Mark token used
  UPDATE restore_confirmation_tokens SET used_at = now() WHERE id = _tok.id;

  -- Create pre_restore safety snapshot
  _pre_snap_id := create_workspace_snapshot(_snap.workspace_id, 'pre_restore');

  _snap_json := _snap.snapshot_json;

  -- Delete current data
  DELETE FROM tasks WHERE workspace_id = _snap.workspace_id;
  DELETE FROM goals WHERE workspace_id = _snap.workspace_id;
  DELETE FROM plans WHERE workspace_id = _snap.workspace_id;
  DELETE FROM ideas WHERE workspace_id = _snap.workspace_id;

  -- Restore from snapshot JSON
  INSERT INTO tasks SELECT * FROM jsonb_populate_recordset(null::tasks, _snap_json->'tasks');
  INSERT INTO goals SELECT * FROM jsonb_populate_recordset(null::goals, _snap_json->'goals');
  INSERT INTO plans SELECT * FROM jsonb_populate_recordset(null::plans, _snap_json->'plans');
  INSERT INTO ideas SELECT * FROM jsonb_populate_recordset(null::ideas, _snap_json->'ideas');

  _counts := jsonb_build_object(
    'tasks', COALESCE(jsonb_array_length(_snap_json->'tasks'), 0),
    'goals', COALESCE(jsonb_array_length(_snap_json->'goals'), 0),
    'plans', COALESCE(jsonb_array_length(_snap_json->'plans'), 0),
    'ideas', COALESCE(jsonb_array_length(_snap_json->'ideas'), 0)
  );

  -- Audit
  INSERT INTO audit_logs (workspace_id, actor_user_id, action, entity_type, entity_id, metadata)
  VALUES (_snap.workspace_id, _actor, 'workspace.snapshot_restored', 'workspace_snapshot', _snapshot_id::text,
    jsonb_build_object('restored_counts', _counts, 'pre_restore_snapshot_id', _pre_snap_id));

  RETURN jsonb_build_object('success', true, 'restored_counts', _counts);
END;
$$;

-- Ensure restore_confirmation_tokens table exists
CREATE TABLE IF NOT EXISTS public.restore_confirmation_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  snapshot_id uuid NOT NULL,
  workspace_id uuid NOT NULL,
  token text NOT NULL,
  actor_id uuid NOT NULL,
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.restore_confirmation_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Only admins can view tokens" ON public.restore_confirmation_tokens
  FOR SELECT USING (is_workspace_admin(auth.uid(), workspace_id));
