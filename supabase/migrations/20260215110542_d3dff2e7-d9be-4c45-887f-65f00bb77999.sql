
-- Drop old restore function signature that conflicts
DROP FUNCTION IF EXISTS public.restore_workspace_snapshot(uuid);
DROP FUNCTION IF EXISTS public.restore_workspace_snapshot(uuid, uuid, text);

-- ─── Fix restore_workspace_snapshot to REQUIRE token ───
CREATE OR REPLACE FUNCTION public.restore_workspace_snapshot(
  _snapshot_id uuid,
  _actor uuid,
  _confirmation_token text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _snap RECORD;
  _token_row RECORD;
  _task RECORD;
  _goal RECORD;
  _plan RECORD;
  _idea RECORD;
  _restored_counts jsonb;
  _tasks_count int := 0;
  _goals_count int := 0;
  _plans_count int := 0;
  _ideas_count int := 0;
BEGIN
  IF _actor IS NULL THEN RAISE EXCEPTION 'Actor is required'; END IF;
  IF _confirmation_token IS NULL OR _confirmation_token = '' THEN
    RAISE EXCEPTION 'Confirmation token is required. Call preview_restore_snapshot first.';
  END IF;

  SELECT * INTO _snap FROM workspace_snapshots WHERE id = _snapshot_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Snapshot not found'; END IF;

  IF NOT is_workspace_admin(_actor, _snap.workspace_id) THEN
    RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE = '42501';
  END IF;

  -- Validate token
  SELECT * INTO _token_row FROM restore_confirmation_tokens
  WHERE token = _confirmation_token
    AND snapshot_id = _snapshot_id
    AND workspace_id = _snap.workspace_id
    AND used_at IS NULL
    AND expires_at > now();
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invalid, expired, or already-used confirmation token';
  END IF;

  UPDATE restore_confirmation_tokens SET used_at = now() WHERE id = _token_row.id;

  -- Advisory lock
  PERFORM pg_advisory_xact_lock(hashtext(_snap.workspace_id::text));

  -- Pre-restore snapshot
  INSERT INTO workspace_snapshots (workspace_id, snapshot_json, snapshot_type, created_by, created_reason)
  VALUES (
    _snap.workspace_id,
    jsonb_build_object(
      'tasks', (SELECT COALESCE(jsonb_agg(row_to_json(t)), '[]'::jsonb) FROM tasks t WHERE t.workspace_id = _snap.workspace_id),
      'goals', (SELECT COALESCE(jsonb_agg(row_to_json(g)), '[]'::jsonb) FROM goals g WHERE g.workspace_id = _snap.workspace_id),
      'plans', (SELECT COALESCE(jsonb_agg(row_to_json(p)), '[]'::jsonb) FROM plans p WHERE p.workspace_id = _snap.workspace_id),
      'ideas', (SELECT COALESCE(jsonb_agg(row_to_json(i)), '[]'::jsonb) FROM ideas i WHERE i.workspace_id = _snap.workspace_id),
      'snapshot_at', now()
    ),
    'pre_restore', _actor, 'pre_restore'
  );

  DELETE FROM tasks WHERE workspace_id = _snap.workspace_id;
  DELETE FROM goals WHERE workspace_id = _snap.workspace_id;
  DELETE FROM plans WHERE workspace_id = _snap.workspace_id;
  DELETE FROM ideas WHERE workspace_id = _snap.workspace_id;

  FOR _task IN SELECT * FROM jsonb_array_elements(_snap.snapshot_json->'tasks')
  LOOP
    INSERT INTO tasks (id, workspace_id, created_by, title, description, status, due_date, assigned_to, meaning_object_id, source_lang, is_priority, created_at)
    VALUES ((_task.value->>'id')::uuid, _snap.workspace_id, (_task.value->>'created_by')::uuid,
      _task.value->>'title', _task.value->>'description', _task.value->>'status',
      CASE WHEN _task.value->>'due_date' IS NOT NULL THEN (_task.value->>'due_date')::date ELSE NULL END,
      CASE WHEN _task.value->>'assigned_to' IS NOT NULL THEN (_task.value->>'assigned_to')::uuid ELSE NULL END,
      (_task.value->>'meaning_object_id')::uuid, COALESCE(_task.value->>'source_lang', 'en'),
      COALESCE((_task.value->>'is_priority')::boolean, false),
      COALESCE((_task.value->>'created_at')::timestamptz, now()))
    ON CONFLICT (id) DO NOTHING;
    _tasks_count := _tasks_count + 1;
  END LOOP;

  FOR _goal IN SELECT * FROM jsonb_array_elements(_snap.snapshot_json->'goals')
  LOOP
    INSERT INTO goals (id, workspace_id, created_by, title, description, status, due_date, meaning_object_id, source_lang, created_at)
    VALUES ((_goal.value->>'id')::uuid, _snap.workspace_id, (_goal.value->>'created_by')::uuid,
      _goal.value->>'title', _goal.value->>'description', _goal.value->>'status',
      CASE WHEN _goal.value->>'due_date' IS NOT NULL THEN (_goal.value->>'due_date')::date ELSE NULL END,
      (_goal.value->>'meaning_object_id')::uuid, COALESCE(_goal.value->>'source_lang', 'en'),
      COALESCE((_goal.value->>'created_at')::timestamptz, now()))
    ON CONFLICT (id) DO NOTHING;
    _goals_count := _goals_count + 1;
  END LOOP;

  FOR _plan IN SELECT * FROM jsonb_array_elements(_snap.snapshot_json->'plans')
  LOOP
    INSERT INTO plans (id, workspace_id, created_by, title, description, plan_type, ai_generated, meaning_object_id, source_lang, created_at)
    VALUES ((_plan.value->>'id')::uuid, _snap.workspace_id, (_plan.value->>'created_by')::uuid,
      _plan.value->>'title', _plan.value->>'description', COALESCE(_plan.value->>'plan_type', 'custom'),
      COALESCE((_plan.value->>'ai_generated')::boolean, false),
      (_plan.value->>'meaning_object_id')::uuid, COALESCE(_plan.value->>'source_lang', 'en'),
      COALESCE((_plan.value->>'created_at')::timestamptz, now()))
    ON CONFLICT (id) DO NOTHING;
    _plans_count := _plans_count + 1;
  END LOOP;

  FOR _idea IN SELECT * FROM jsonb_array_elements(_snap.snapshot_json->'ideas')
  LOOP
    INSERT INTO ideas (id, workspace_id, created_by, title, description, source, meaning_object_id, source_lang, created_at)
    VALUES ((_idea.value->>'id')::uuid, _snap.workspace_id, (_idea.value->>'created_by')::uuid,
      _idea.value->>'title', _idea.value->>'description', COALESCE(_idea.value->>'source', 'snapshot'),
      (_idea.value->>'meaning_object_id')::uuid, COALESCE(_idea.value->>'source_lang', 'en'),
      COALESCE((_idea.value->>'created_at')::timestamptz, now()))
    ON CONFLICT (id) DO NOTHING;
    _ideas_count := _ideas_count + 1;
  END LOOP;

  _restored_counts := jsonb_build_object('tasks', _tasks_count, 'goals', _goals_count, 'plans', _plans_count, 'ideas', _ideas_count);

  INSERT INTO audit_logs (workspace_id, actor_user_id, action, entity_type, entity_id, metadata)
  VALUES (_snap.workspace_id, _actor, 'workspace.snapshot_restored', 'workspace_snapshot', _snapshot_id::text,
    jsonb_build_object('restored_counts', _restored_counts, 'token_id', _token_row.id, 'reason', 'user_initiated'));

  RETURN jsonb_build_object('success', true, 'restored_counts', _restored_counts);
END;
$$;

-- ─── Fix create_workspace_snapshot ───
CREATE OR REPLACE FUNCTION public.create_workspace_snapshot(
  _workspace_id uuid,
  _actor uuid DEFAULT NULL,
  _snapshot_type text DEFAULT 'manual'
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _resolved_actor uuid;
  _snap_id uuid;
  _snap jsonb;
  _snap_bytes bigint;
BEGIN
  _resolved_actor := COALESCE(_actor, auth.uid());
  IF _resolved_actor IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF NOT is_workspace_admin(_resolved_actor, _workspace_id) THEN
    RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE = '42501';
  END IF;

  _snap := jsonb_build_object(
    'tasks', (SELECT COALESCE(jsonb_agg(row_to_json(t)), '[]'::jsonb) FROM tasks t WHERE t.workspace_id = _workspace_id),
    'goals', (SELECT COALESCE(jsonb_agg(row_to_json(g)), '[]'::jsonb) FROM goals g WHERE g.workspace_id = _workspace_id),
    'plans', (SELECT COALESCE(jsonb_agg(row_to_json(p)), '[]'::jsonb) FROM plans p WHERE p.workspace_id = _workspace_id),
    'ideas', (SELECT COALESCE(jsonb_agg(row_to_json(i)), '[]'::jsonb) FROM ideas i WHERE i.workspace_id = _workspace_id),
    'billing_subscription', (SELECT row_to_json(bs) FROM billing_subscriptions bs WHERE bs.workspace_id = _workspace_id LIMIT 1),
    'snapshot_at', now()
  );
  _snap_bytes := octet_length(_snap::text);

  INSERT INTO workspace_snapshots (workspace_id, snapshot_json, snapshot_type, created_by, created_reason, size_bytes, checksum)
  VALUES (_workspace_id, _snap, _snapshot_type, _resolved_actor, _snapshot_type, _snap_bytes, md5(_snap::text))
  RETURNING id INTO _snap_id;

  INSERT INTO audit_logs (workspace_id, actor_user_id, action, entity_type, entity_id, metadata)
  VALUES (_workspace_id, _resolved_actor, 'workspace.snapshot_created', 'workspace_snapshot', _snap_id::text,
    jsonb_build_object('snapshot_type', _snapshot_type, 'size_bytes', _snap_bytes));

  RETURN _snap_id;
END;
$$;

-- ─── Fix preview_restore_snapshot ───
CREATE OR REPLACE FUNCTION public.preview_restore_snapshot(
  _snapshot_id uuid,
  _actor uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _snap RECORD;
  _token text;
  _current_tasks int;
  _current_goals int;
  _current_plans int;
  _current_ideas int;
  _snap_tasks int;
  _snap_goals int;
  _snap_plans int;
  _snap_ideas int;
  _summary jsonb;
BEGIN
  IF _actor IS NULL THEN RAISE EXCEPTION 'Actor is required'; END IF;

  SELECT * INTO _snap FROM workspace_snapshots WHERE id = _snapshot_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Snapshot not found'; END IF;

  IF NOT is_workspace_admin(_actor, _snap.workspace_id) THEN
    RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE = '42501';
  END IF;

  SELECT count(*) INTO _current_tasks FROM tasks WHERE workspace_id = _snap.workspace_id;
  SELECT count(*) INTO _current_goals FROM goals WHERE workspace_id = _snap.workspace_id;
  SELECT count(*) INTO _current_plans FROM plans WHERE workspace_id = _snap.workspace_id;
  SELECT count(*) INTO _current_ideas FROM ideas WHERE workspace_id = _snap.workspace_id;

  _snap_tasks := COALESCE(jsonb_array_length(_snap.snapshot_json->'tasks'), 0);
  _snap_goals := COALESCE(jsonb_array_length(_snap.snapshot_json->'goals'), 0);
  _snap_plans := COALESCE(jsonb_array_length(_snap.snapshot_json->'plans'), 0);
  _snap_ideas := COALESCE(jsonb_array_length(_snap.snapshot_json->'ideas'), 0);

  _token := encode(gen_random_bytes(32), 'hex');

  _summary := jsonb_build_object(
    'will_replace', jsonb_build_object('tasks', _current_tasks, 'goals', _current_goals, 'plans', _current_plans, 'ideas', _current_ideas),
    'will_restore', jsonb_build_object('tasks', _snap_tasks, 'goals', _snap_goals, 'plans', _snap_plans, 'ideas', _snap_ideas),
    'snapshot_created_at', _snap.created_at,
    'snapshot_type', _snap.snapshot_type,
    'snapshot_reason', COALESCE(_snap.created_reason, _snap.snapshot_type)
  );

  INSERT INTO restore_confirmation_tokens (snapshot_id, workspace_id, created_by, token, preview_summary, expires_at)
  VALUES (_snapshot_id, _snap.workspace_id, _actor, _token, _summary, now() + interval '10 minutes');

  RETURN jsonb_build_object('confirmation_token', _token, 'summary', _summary, 'expires_in_seconds', 600);
END;
$$;

-- ─── Fix cleanup_restore_tokens ───
CREATE OR REPLACE FUNCTION public.cleanup_restore_tokens(
  _older_than_minutes integer DEFAULT 60,
  _batch integer DEFAULT 500
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE _deleted int;
BEGIN
  DELETE FROM public.restore_confirmation_tokens
  WHERE ctid IN (
    SELECT ctid FROM public.restore_confirmation_tokens
    WHERE expires_at < now() - (_older_than_minutes * interval '1 minute')
       OR (used_at IS NOT NULL AND used_at < now() - interval '24 hours')
    ORDER BY expires_at ASC
    LIMIT _batch
  );
  GET DIAGNOSTICS _deleted = ROW_COUNT;
  RETURN _deleted;
END;
$$;

-- ─── Register Recovery & Backup as Core App ───
INSERT INTO public.app_registry (id, name, description, icon, pricing, status, capabilities)
VALUES ('recovery', 'Recovery & Backup', 'Workspace snapshots, scheduled backups, and point-in-time restore', 'database-backup', 'free', 'available', ARRAY['snapshot', 'restore', 'scheduled_backup', 'export'])
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  capabilities = EXCLUDED.capabilities;
