
-- ============================================================
-- Atomic Restore via Provider Fragments
-- Per-provider SQL helper functions + orchestrator RPC
-- ============================================================

-- 1) Workboard restore helper
CREATE OR REPLACE FUNCTION public.restore_workboard_fragment(
  _workspace_id uuid,
  _fragment jsonb
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _count int := 0;
  _row jsonb;
BEGIN
  -- Delete existing (dependency-safe order)
  DELETE FROM ideas WHERE workspace_id = _workspace_id;
  DELETE FROM plans WHERE workspace_id = _workspace_id;
  DELETE FROM goals WHERE workspace_id = _workspace_id;
  DELETE FROM tasks WHERE workspace_id = _workspace_id;

  -- Insert tasks
  FOR _row IN SELECT * FROM jsonb_array_elements(COALESCE(_fragment->'tasks', '[]'::jsonb))
  LOOP
    INSERT INTO tasks
    SELECT * FROM jsonb_populate_record(null::tasks, _row || jsonb_build_object('workspace_id', _workspace_id));
    _count := _count + 1;
  END LOOP;

  -- Insert goals
  FOR _row IN SELECT * FROM jsonb_array_elements(COALESCE(_fragment->'goals', '[]'::jsonb))
  LOOP
    INSERT INTO goals
    SELECT * FROM jsonb_populate_record(null::goals, _row || jsonb_build_object('workspace_id', _workspace_id));
    _count := _count + 1;
  END LOOP;

  -- Insert plans
  FOR _row IN SELECT * FROM jsonb_array_elements(COALESCE(_fragment->'plans', '[]'::jsonb))
  LOOP
    INSERT INTO plans
    SELECT * FROM jsonb_populate_record(null::plans, _row || jsonb_build_object('workspace_id', _workspace_id));
    _count := _count + 1;
  END LOOP;

  -- Insert ideas
  FOR _row IN SELECT * FROM jsonb_array_elements(COALESCE(_fragment->'ideas', '[]'::jsonb))
  LOOP
    INSERT INTO ideas
    SELECT * FROM jsonb_populate_record(null::ideas, _row || jsonb_build_object('workspace_id', _workspace_id));
    _count := _count + 1;
  END LOOP;

  RETURN _count;
END;
$$;

-- 2) Billing restore helper
CREATE OR REPLACE FUNCTION public.restore_billing_fragment(
  _workspace_id uuid,
  _fragment jsonb
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _count int := 0;
  _row jsonb;
BEGIN
  FOR _row IN SELECT * FROM jsonb_array_elements(COALESCE(_fragment->'billing_subscriptions', '[]'::jsonb))
  LOOP
    INSERT INTO billing_subscriptions
    SELECT * FROM jsonb_populate_record(null::billing_subscriptions, _row || jsonb_build_object('workspace_id', _workspace_id))
    ON CONFLICT (workspace_id) DO UPDATE SET
      plan_id = EXCLUDED.plan_id,
      status = EXCLUDED.status,
      billing_cycle = EXCLUDED.billing_cycle,
      billing_provider = EXCLUDED.billing_provider,
      current_period_start = EXCLUDED.current_period_start,
      current_period_end = EXCLUDED.current_period_end,
      external_subscription_id = EXCLUDED.external_subscription_id,
      cancelled_at = EXCLUDED.cancelled_at,
      updated_at = now();
    _count := _count + 1;
  END LOOP;

  RETURN _count;
END;
$$;

-- 3) TeamChat restore helper
CREATE OR REPLACE FUNCTION public.restore_teamchat_fragment(
  _workspace_id uuid,
  _fragment jsonb
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _count int := 0;
  _row jsonb;
  _thread_ids uuid[];
BEGIN
  -- Collect thread IDs belonging to this workspace
  SELECT array_agg(id) INTO _thread_ids
  FROM chat_threads WHERE workspace_id = _workspace_id;

  -- Delete in reverse dependency order
  IF _thread_ids IS NOT NULL AND array_length(_thread_ids, 1) > 0 THEN
    DELETE FROM chat_attachments WHERE workspace_id = _workspace_id;
    DELETE FROM chat_messages WHERE workspace_id = _workspace_id;
    DELETE FROM chat_thread_members WHERE thread_id = ANY(_thread_ids);
    DELETE FROM chat_threads WHERE workspace_id = _workspace_id;
  END IF;

  -- Restore in dependency order: threads -> members -> messages -> attachments
  FOR _row IN SELECT * FROM jsonb_array_elements(COALESCE(_fragment->'threads', '[]'::jsonb))
  LOOP
    INSERT INTO chat_threads
    SELECT * FROM jsonb_populate_record(null::chat_threads, _row || jsonb_build_object('workspace_id', _workspace_id));
    _count := _count + 1;
  END LOOP;

  FOR _row IN SELECT * FROM jsonb_array_elements(COALESCE(_fragment->'thread_members', '[]'::jsonb))
  LOOP
    INSERT INTO chat_thread_members
    SELECT * FROM jsonb_populate_record(null::chat_thread_members, _row);
    _count := _count + 1;
  END LOOP;

  FOR _row IN SELECT * FROM jsonb_array_elements(COALESCE(_fragment->'messages', '[]'::jsonb))
  LOOP
    INSERT INTO chat_messages
    SELECT * FROM jsonb_populate_record(null::chat_messages, _row || jsonb_build_object('workspace_id', _workspace_id));
    _count := _count + 1;
  END LOOP;

  FOR _row IN SELECT * FROM jsonb_array_elements(COALESCE(_fragment->'attachments_refs', '[]'::jsonb))
  LOOP
    INSERT INTO chat_attachments
    SELECT * FROM jsonb_populate_record(null::chat_attachments, _row || jsonb_build_object('workspace_id', _workspace_id));
    _count := _count + 1;
  END LOOP;

  RETURN _count;
END;
$$;

-- 4) Main atomic restore orchestrator
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
AS $$
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

  -- ── 5. Create pre-restore safety snapshot ──
  _pre_snap_id := create_workspace_snapshot(_workspace_id, 'pre_restore');

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
        -- Unknown provider: skip
        _count := 0;
      END IF;

      _restored_counts := _restored_counts || jsonb_build_object(_provider_id, _count);

    EXCEPTION WHEN OTHERS THEN
      -- Audit the failure
      INSERT INTO audit_logs (workspace_id, actor_user_id, action, entity_type, entity_id, metadata)
      VALUES (_workspace_id, _actor, 'workspace.provider_restore_failed', 'workspace_snapshot', _snapshot_id::text,
        jsonb_build_object('provider_id', _provider_id, 'error', SQLERRM, 'critical', _is_critical));

      IF _is_critical THEN
        -- Critical failure → RAISE to rollback entire transaction
        RAISE EXCEPTION 'Critical provider % failed: %', _provider_id, SQLERRM;
      END IF;
      -- Non-critical → continue
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
$$;

-- 5) Server-side capture with audit + size-capped chat
CREATE OR REPLACE FUNCTION public.capture_workspace_snapshot_v2(
  _workspace_id uuid,
  _snapshot_type text DEFAULT 'manual',
  _reason text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
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

  -- Cap messages at _MAX_MESSAGES, newest first
  SELECT COALESCE(jsonb_agg(row_to_json(cm)), '[]'::jsonb) INTO _messages
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
$$;

-- 6) Server-side preview RPC
CREATE OR REPLACE FUNCTION public.preview_restore_v2(
  _snapshot_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $$
DECLARE
  _actor uuid := auth.uid();
  _snap RECORD;
  _payload jsonb;
  _fragments jsonb;
  _fragment jsonb;
  _providers jsonb := '[]'::jsonb;
  _token text;
  _provider_names jsonb := '{"workboard":"Workboard","billing":"Billing","team_chat":"Team Chat"}'::jsonb;
  _provider_descs jsonb := '{"workboard":"Tasks, goals, plans, ideas","billing":"Billing subscriptions & plan linkage","team_chat":"Channels, messages, threads, attachment references"}'::jsonb;
  _provider_critical jsonb := '{"workboard":true,"billing":true,"team_chat":false}'::jsonb;
BEGIN
  IF _actor IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  SELECT * INTO _snap FROM workspace_snapshots WHERE id = _snapshot_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Snapshot not found'; END IF;

  IF NOT is_workspace_admin(_actor, _snap.workspace_id) THEN
    RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE = '42501';
  END IF;

  _payload := _snap.snapshot_json;
  _fragments := COALESCE(_payload->'fragments', '[]'::jsonb);

  -- Build provider summaries
  FOR _fragment IN SELECT * FROM jsonb_array_elements(_fragments)
  LOOP
    _providers := _providers || jsonb_build_array(jsonb_build_object(
      'provider_id', _fragment->>'provider_id',
      'name', COALESCE(_provider_names->>(_fragment->>'provider_id'), _fragment->>'provider_id'),
      'description', COALESCE(_provider_descs->>(_fragment->>'provider_id'), 'Unknown'),
      'critical', COALESCE((_provider_critical->>(_fragment->>'provider_id'))::boolean, false),
      'entity_count', COALESCE((_fragment->'metadata'->>'entity_count')::int, 0)
    ));
  END LOOP;

  -- Generate token
  _token := encode(extensions.gen_random_bytes(32), 'hex');
  INSERT INTO restore_confirmation_tokens (snapshot_id, workspace_id, token, created_by, expires_at)
  VALUES (_snapshot_id, _snap.workspace_id, _token, _actor, now() + interval '10 minutes');

  -- Audit: previewed
  INSERT INTO audit_logs (workspace_id, actor_user_id, action, entity_type, entity_id, metadata)
  VALUES (_snap.workspace_id, _actor, 'workspace.snapshot_previewed', 'workspace_snapshot', _snapshot_id::text,
    jsonb_build_object('snapshot_id', _snapshot_id));

  RETURN jsonb_build_object(
    'confirmation_token', _token,
    'summary', jsonb_build_object(
      'providers', _providers,
      'snapshot_created_at', _snap.created_at,
      'snapshot_type', _snap.snapshot_type
    ),
    'expires_in_seconds', 600
  );
END;
$$;
