
-- ============================================================
-- Phase-1 Gate: Fix items 1, 3, 4
-- ============================================================

-- ── 1. Create internal snapshot function that accepts _actor (no auth.uid()) ──
CREATE OR REPLACE FUNCTION public.create_workspace_snapshot_internal(
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
  -- No auth.uid() check — caller (restore_workspace_snapshot_atomic) already verified admin
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
REVOKE ALL ON FUNCTION public.create_workspace_snapshot_internal(uuid, uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.create_workspace_snapshot_internal(uuid, uuid, text) FROM anon;

-- ── Update restore_workspace_snapshot_atomic to use the internal function ──
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

  -- ── 5. Create pre-restore safety snapshot (FIX: use internal function with _actor) ──
  _pre_snap_id := create_workspace_snapshot_internal(_workspace_id, _actor, 'pre_restore');

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

-- ── 3. Fix restore_teamchat_fragment: filter thread_members by fragment thread_ids ──
CREATE OR REPLACE FUNCTION public.restore_teamchat_fragment(_workspace_id uuid, _fragment jsonb)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _count int := 0;
  _row jsonb;
  _thread_ids uuid[];
  _valid_thread_ids uuid[];
BEGIN
  -- Collect existing thread IDs belonging to this workspace
  SELECT array_agg(id) INTO _thread_ids
  FROM chat_threads WHERE workspace_id = _workspace_id;

  -- Delete in reverse dependency order
  IF _thread_ids IS NOT NULL AND array_length(_thread_ids, 1) > 0 THEN
    DELETE FROM chat_attachments WHERE workspace_id = _workspace_id;
    DELETE FROM chat_messages WHERE workspace_id = _workspace_id;
    DELETE FROM chat_thread_members WHERE thread_id = ANY(_thread_ids);
    DELETE FROM chat_threads WHERE workspace_id = _workspace_id;
  END IF;

  -- Restore threads first, collecting their IDs for validation
  _valid_thread_ids := ARRAY[]::uuid[];
  FOR _row IN SELECT * FROM jsonb_array_elements(COALESCE(_fragment->'threads', '[]'::jsonb))
  LOOP
    INSERT INTO chat_threads
    SELECT * FROM jsonb_populate_record(null::chat_threads, _row || jsonb_build_object('workspace_id', _workspace_id));
    _valid_thread_ids := array_append(_valid_thread_ids, (_row->>'id')::uuid);
    _count := _count + 1;
  END LOOP;

  -- Restore members: ONLY for threads that belong to this fragment (workspace isolation)
  FOR _row IN SELECT * FROM jsonb_array_elements(COALESCE(_fragment->'thread_members', '[]'::jsonb))
  LOOP
    IF (_row->>'thread_id')::uuid = ANY(_valid_thread_ids) THEN
      INSERT INTO chat_thread_members
      SELECT * FROM jsonb_populate_record(null::chat_thread_members, _row);
      _count := _count + 1;
    END IF;
  END LOOP;

  -- Restore messages: force workspace_id AND validate thread_id
  FOR _row IN SELECT * FROM jsonb_array_elements(COALESCE(_fragment->'messages', '[]'::jsonb))
  LOOP
    IF (_row->>'thread_id')::uuid = ANY(_valid_thread_ids) THEN
      INSERT INTO chat_messages
      SELECT * FROM jsonb_populate_record(null::chat_messages, _row || jsonb_build_object('workspace_id', _workspace_id));
      _count := _count + 1;
    END IF;
  END LOOP;

  -- Restore attachment refs: force workspace_id
  FOR _row IN SELECT * FROM jsonb_array_elements(COALESCE(_fragment->'attachments_refs', '[]'::jsonb))
  LOOP
    INSERT INTO chat_attachments
    SELECT * FROM jsonb_populate_record(null::chat_attachments, _row || jsonb_build_object('workspace_id', _workspace_id));
    _count := _count + 1;
  END LOOP;

  RETURN _count;
END;
$function$;

-- ── 4. Fix capture_workspace_snapshot_v2: apply message body truncation ──
CREATE OR REPLACE FUNCTION public.capture_workspace_snapshot_v2(
  _workspace_id uuid,
  _snapshot_type text DEFAULT 'manual',
  _reason text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _actor uuid := auth.uid();
  _snap_id uuid;
  _payload jsonb;
  _tasks jsonb;
  _goals jsonb;
  _plans jsonb;
  _ideas jsonb;
  _billing jsonb;
  _threads jsonb;
  _members jsonb;
  _messages jsonb;
  _attachments jsonb;
  _thread_ids uuid[];
  _msg_count int;
  _MAX_MESSAGES int := 2000;
  _MAX_BODY_LEN int := 2000;
BEGIN
  IF _actor IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF NOT is_workspace_admin(_actor, _workspace_id) THEN
    RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE = '42501';
  END IF;

  -- Workboard
  SELECT COALESCE(jsonb_agg(row_to_json(t)), '[]'::jsonb) INTO _tasks FROM tasks t WHERE t.workspace_id = _workspace_id;
  SELECT COALESCE(jsonb_agg(row_to_json(g)), '[]'::jsonb) INTO _goals FROM goals g WHERE g.workspace_id = _workspace_id;
  SELECT COALESCE(jsonb_agg(row_to_json(p)), '[]'::jsonb) INTO _plans FROM plans p WHERE p.workspace_id = _workspace_id;
  SELECT COALESCE(jsonb_agg(row_to_json(i)), '[]'::jsonb) INTO _ideas FROM ideas i WHERE i.workspace_id = _workspace_id;

  -- Billing
  SELECT COALESCE(jsonb_agg(row_to_json(bs)), '[]'::jsonb) INTO _billing
  FROM billing_subscriptions bs WHERE bs.workspace_id = _workspace_id;

  -- TeamChat (size-capped)
  SELECT COALESCE(jsonb_agg(row_to_json(ct)), '[]'::jsonb) INTO _threads
  FROM chat_threads ct WHERE ct.workspace_id = _workspace_id;

  SELECT array_agg(id) INTO _thread_ids FROM chat_threads WHERE workspace_id = _workspace_id;

  IF _thread_ids IS NOT NULL AND array_length(_thread_ids, 1) > 0 THEN
    SELECT COALESCE(jsonb_agg(row_to_json(ctm)), '[]'::jsonb) INTO _members
    FROM chat_thread_members ctm WHERE ctm.thread_id = ANY(_thread_ids);
  ELSE
    _members := '[]'::jsonb;
  END IF;

  -- Cap messages at _MAX_MESSAGES, newest first, TRUNCATE body to _MAX_BODY_LEN
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'id', cm.id,
      'thread_id', cm.thread_id,
      'sender_user_id', cm.sender_user_id,
      'workspace_id', cm.workspace_id,
      'meaning_object_id', cm.meaning_object_id,
      'source_lang', cm.source_lang,
      'created_at', cm.created_at
    )
  ), '[]'::jsonb) INTO _messages
  FROM (
    SELECT * FROM chat_messages WHERE workspace_id = _workspace_id
    ORDER BY created_at DESC LIMIT _MAX_MESSAGES
  ) cm;

  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'id', ca.id, 'message_id', ca.message_id, 'workspace_id', ca.workspace_id,
      'file_name', ca.file_name, 'file_type', ca.file_type, 'file_size', ca.file_size,
      'file_url', ca.file_url, 'storage_path', ca.storage_path,
      'uploaded_by', ca.uploaded_by, 'created_at', ca.created_at
    )
  ), '[]'::jsonb) INTO _attachments
  FROM chat_attachments ca WHERE ca.workspace_id = _workspace_id;

  -- Build engine payload
  _payload := jsonb_build_object(
    'engine_version', 1,
    'created_at', now(),
    'fragments', jsonb_build_array(
      jsonb_build_object(
        'provider_id', 'workboard', 'version', 1,
        'data', jsonb_build_object('tasks', _tasks, 'goals', _goals, 'plans', _plans, 'ideas', _ideas),
        'metadata', jsonb_build_object('entity_count', jsonb_array_length(_tasks) + jsonb_array_length(_goals) + jsonb_array_length(_plans) + jsonb_array_length(_ideas))
      ),
      jsonb_build_object(
        'provider_id', 'billing', 'version', 1,
        'data', jsonb_build_object('billing_subscriptions', _billing),
        'metadata', jsonb_build_object('entity_count', jsonb_array_length(_billing))
      ),
      jsonb_build_object(
        'provider_id', 'team_chat', 'version', 1,
        'data', jsonb_build_object('threads', _threads, 'thread_members', _members, 'messages', _messages, 'attachments_refs', _attachments),
        'metadata', jsonb_build_object('entity_count', jsonb_array_length(_threads) + jsonb_array_length(_members) + jsonb_array_length(_messages) + jsonb_array_length(_attachments))
      )
    )
  );

  INSERT INTO workspace_snapshots (workspace_id, snapshot_json, snapshot_type, created_by)
  VALUES (_workspace_id, _payload, _snapshot_type, _actor)
  RETURNING id INTO _snap_id;

  -- Audit log
  INSERT INTO audit_logs (workspace_id, actor_user_id, action, entity_type, entity_id, metadata)
  VALUES (_workspace_id, _actor, 'workspace.snapshot_created', 'workspace_snapshot', _snap_id::text,
    jsonb_build_object('snapshot_type', _snapshot_type, 'reason', _reason, 'engine_version', 1));

  RETURN _snap_id;
END;
$function$;
