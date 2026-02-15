
-- generate_restore_token: lightweight RPC that only creates the token
CREATE OR REPLACE FUNCTION public.generate_restore_token(_snapshot_id uuid, _actor uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $$
DECLARE
  _snap RECORD;
  _token text;
BEGIN
  IF _actor IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  SELECT * INTO _snap FROM workspace_snapshots WHERE id = _snapshot_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Snapshot not found'; END IF;

  IF NOT is_workspace_admin(_actor, _snap.workspace_id) THEN
    RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE = '42501';
  END IF;

  _token := encode(extensions.gen_random_bytes(32), 'hex');

  INSERT INTO restore_confirmation_tokens (snapshot_id, workspace_id, token, created_by, expires_at)
  VALUES (_snapshot_id, _snap.workspace_id, _token, _actor, now() + interval '10 minutes');

  RETURN _token;
END;
$$;

-- validate_restore_token: checks token validity, returns true/false, marks as used
CREATE OR REPLACE FUNCTION public.validate_restore_token(_snapshot_id uuid, _token text, _actor uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _rec RECORD;
BEGIN
  IF _actor IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  SELECT * INTO _rec
  FROM restore_confirmation_tokens
  WHERE snapshot_id = _snapshot_id
    AND token = _token
    AND used_at IS NULL
    AND expires_at > now();

  IF NOT FOUND THEN RETURN false; END IF;

  IF NOT is_workspace_admin(_actor, _rec.workspace_id) THEN
    RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE = '42501';
  END IF;

  UPDATE restore_confirmation_tokens SET used_at = now() WHERE id = _rec.id;

  RETURN true;
END;
$$;
