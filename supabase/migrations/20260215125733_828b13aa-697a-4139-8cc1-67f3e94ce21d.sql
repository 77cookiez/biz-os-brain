
CREATE OR REPLACE FUNCTION public.preview_restore_snapshot(_snapshot_id uuid, _actor uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
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
  _token := encode(extensions.gen_random_bytes(32), 'hex');

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
