
-- ============================================================
-- Rename create_workspace_snapshot_internal -> capture_pre_restore_snapshot_as
-- per architecture spec
-- ============================================================

-- Create the renamed function
CREATE OR REPLACE FUNCTION public.capture_pre_restore_snapshot_as(
  _workspace_id uuid,
  _actor uuid,
  _snapshot_type text DEFAULT 'pre_restore'
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _snap_id uuid;
  _snap jsonb;
BEGIN
  -- No auth.uid() check — caller already verified admin
  _snap := jsonb_build_object(
    'tasks', (SELECT COALESCE(jsonb_agg(row_to_json(t)), '[]'::jsonb) FROM tasks t WHERE t.workspace_id = _workspace_id),
    'goals', (SELECT COALESCE(jsonb_agg(row_to_json(g)), '[]'::jsonb) FROM goals g WHERE g.workspace_id = _workspace_id),
    'plans', (SELECT COALESCE(jsonb_agg(row_to_json(p)), '[]'::jsonb) FROM plans p WHERE p.workspace_id = _workspace_id),
    'ideas', (SELECT COALESCE(jsonb_agg(row_to_json(i)), '[]'::jsonb) FROM ideas i WHERE i.workspace_id = _workspace_id),
    'billing_subscription', (SELECT row_to_json(bs) FROM billing_subscriptions bs WHERE bs.workspace_id = _workspace_id LIMIT 1),
    'snapshot_at', now()
  );

  INSERT INTO workspace_snapshots (workspace_id, snapshot_json, snapshot_type, created_by)
  VALUES (_workspace_id, _snap, _snapshot_type, _actor)
  RETURNING id INTO _snap_id;

  INSERT INTO audit_logs (workspace_id, actor_user_id, action, entity_type, entity_id, metadata)
  VALUES (_workspace_id, _actor, 'workspace.snapshot_created', 'workspace_snapshot', _snap_id::text,
    jsonb_build_object('snapshot_type', _snapshot_type, 'reason', 'pre_restore safety snapshot'));

  RETURN _snap_id;
END;
$function$;

-- Revoke public access
REVOKE ALL ON FUNCTION public.capture_pre_restore_snapshot_as(uuid, uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.capture_pre_restore_snapshot_as(uuid, uuid, text) FROM anon;

-- Update restore_workspace_snapshot_atomic to use the renamed function
CREATE OR REPLACE FUNCTION public.restore_workspace_snapshot_atomic(
  _workspace_id uuid,
  _snapshot_id uuid,
  _actor uuid,
  _confirmation_token text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  _snap RECORD;
  _payload jsonb;
  _fragments jsonb;
  _fragment jsonb;
  _provider_id text;
  _is_critical boolean;
  _restored_counts jsonb := '{}'::jsonb;
  _count int;
  _pre_snap_id uuid;
  _provider_map jsonb := '{
    "workboard": true,
    "billing": true,
    "team_chat": false
  }'::jsonb;
BEGIN
  -- ── 0. Auth & permission check ──
  IF _actor IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT is_workspace_admin(_actor, _workspace_id) THEN
    RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE = '42501';
  END IF;

  -- ── 1. Validate token ──
  IF NOT validate_restore_token(_snapshot_id, _confirmation_token, _actor) THEN
    RAISE EXCEPTION 'Invalid or expired confirmation token';
  END IF;

  -- ── 2. Advisory lock on workspace ──
  PERFORM pg_advisory_xact_lock(hashtext(_workspace_id::text));

  -- ── 3. Audit: restore started ──
  INSERT INTO audit_logs (workspace_id, actor_user_id, action, entity_type, entity_id, metadata)
  VALUES (_workspace_id, _actor, 'workspace.snapshot_restore_started', 'workspace_snapshot', _snapshot_id::text,
    jsonb_build_object('snapshot_id', _snapshot_id));

  -- ── 4. Read snapshot ──
  SELECT * INTO _snap FROM workspace_snapshots WHERE id = _snapshot_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Snapshot not found';
  END IF;

  IF _snap.workspace_id != _workspace_id THEN
    RAISE EXCEPTION 'Snapshot does not belong to workspace';
  END IF;

  _payload := _snap.snapshot_json;
  _fragments := COALESCE(_payload->'fragments', '[]'::jsonb);

  -- ── 5. Create pre-restore safety snapshot (uses _actor, no auth.uid()) ──
  _pre_snap_id := capture_pre_restore_snapshot_as(_workspace_id, _actor, 'pre_restore');

  -- ── 6. Restore each provider fragment ──
  FOR _fragment IN SELECT * FROM jsonb_array_elements(_fragments)
  LOOP
    _provider_id := _fragment->>'provider_id';
    _is_critical := COALESCE((_provider_map->>_provider_id)::boolean, false);

    BEGIN
      IF _provider_id = 'workboard' THEN
        _count := restore_workboard_fragment(_workspace_id, _fragment->'data');
      ELSIF _provider_id = 'billing' THEN
        _count := restore_billing_fragment(_workspace_id, _fragment->'data');
      ELSIF _provider_id = 'team_chat' THEN
        _count := restore_teamchat_fragment(_workspace_id, _fragment->'data');
      ELSE
        _count := 0;
      END IF;

      _restored_counts := _restored_counts || jsonb_build_object(_provider_id, _count);

    EXCEPTION WHEN OTHERS THEN
      INSERT INTO audit_logs (workspace_id, actor_user_id, action, entity_type, entity_id, metadata)
      VALUES (_workspace_id, _actor, 'workspace.provider_restore_failed', 'workspace_snapshot', _snapshot_id::text,
        jsonb_build_object('provider_id', _provider_id, 'error', SQLERRM, 'critical', _is_critical));

      IF _is_critical THEN
        RAISE EXCEPTION 'Critical provider % failed: %', _provider_id, SQLERRM;
      END IF;
      _restored_counts := _restored_counts || jsonb_build_object(_provider_id, -1);
    END;
  END LOOP;

  -- ── 7. Audit: restore completed ──
  INSERT INTO audit_logs (workspace_id, actor_user_id, action, entity_type, entity_id, metadata)
  VALUES (_workspace_id, _actor, 'workspace.snapshot_restore_completed', 'workspace_snapshot', _snapshot_id::text,
    jsonb_build_object('snapshot_id', _snapshot_id, 'pre_restore_snapshot_id', _pre_snap_id, 'restored_counts', _restored_counts));

  RETURN jsonb_build_object(
    'success', true,
    'restored_counts', _restored_counts,
    'pre_restore_snapshot_id', _pre_snap_id
  );
END;
$function$;

-- Drop old function (keep backward compat by leaving it; it's SECURITY DEFINER so safe)
-- DROP FUNCTION IF EXISTS public.create_workspace_snapshot_internal(uuid, uuid, text);
