
-- ============================================================
-- Corrective Migration: 3 fixes for Recovery/Backup system
-- 1. cleanup_restore_tokens: use ctid pattern
-- 2. advisory lock: use hashtext instead of fragile uuid conversion
-- 3. restore requires mandatory confirmation token
-- ============================================================

-- ── 1. Create restore_confirmation_tokens table ──
CREATE TABLE IF NOT EXISTS public.restore_confirmation_tokens (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  snapshot_id uuid NOT NULL REFERENCES public.workspace_snapshots(id) ON DELETE CASCADE,
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  created_by uuid NOT NULL,
  token text NOT NULL UNIQUE,
  preview_summary jsonb NOT NULL DEFAULT '{}'::jsonb,
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_restore_tokens_expires ON public.restore_confirmation_tokens(expires_at);
CREATE INDEX IF NOT EXISTS idx_restore_tokens_token ON public.restore_confirmation_tokens(token);

ALTER TABLE public.restore_confirmation_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage restore tokens"
  ON public.restore_confirmation_tokens FOR ALL
  USING (
    has_company_role(auth.uid(), get_workspace_company(workspace_id), 'owner'::app_role)
    OR has_company_role(auth.uid(), get_workspace_company(workspace_id), 'admin'::app_role)
  );

-- ── 2. Fix cleanup_restore_tokens: use ctid pattern ──
CREATE OR REPLACE FUNCTION public.cleanup_restore_tokens(
  _older_than_minutes int DEFAULT 60,
  _batch int DEFAULT 500
)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE _deleted int;
BEGIN
  DELETE FROM public.restore_confirmation_tokens
  WHERE ctid IN (
    SELECT ctid FROM public.restore_confirmation_tokens
    WHERE expires_at < now() - (_older_than_minutes * interval '1 minute')
    LIMIT _batch
  );
  GET DIAGNOSTICS _deleted = ROW_COUNT;
  RETURN _deleted;
END;
$$;

-- ── 3. preview_restore_snapshot: generates token + diff summary ──
CREATE OR REPLACE FUNCTION public.preview_restore_snapshot(
  _snapshot_id uuid,
  _actor uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _snap RECORD;
  _token text;
  _current_tasks int;
  _current_goals int;
  _snap_tasks int;
  _snap_goals int;
  _summary jsonb;
BEGIN
  IF _actor IS NULL THEN RAISE EXCEPTION 'Actor required'; END IF;

  SELECT * INTO _snap FROM workspace_snapshots WHERE id = _snapshot_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Snapshot not found'; END IF;

  IF NOT is_workspace_admin(_actor, _snap.workspace_id) THEN
    RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE = '42501';
  END IF;

  -- Count current data
  SELECT count(*) INTO _current_tasks FROM tasks WHERE workspace_id = _snap.workspace_id AND deleted_at IS NULL;
  SELECT count(*) INTO _current_goals FROM goals WHERE workspace_id = _snap.workspace_id AND deleted_at IS NULL;

  -- Count snapshot data
  _snap_tasks := COALESCE(jsonb_array_length(_snap.snapshot_json->'tasks'), 0);
  _snap_goals := COALESCE(jsonb_array_length(_snap.snapshot_json->'goals'), 0);

  _summary := jsonb_build_object(
    'snapshot_id', _snapshot_id,
    'snapshot_created_at', _snap.created_at,
    'current_counts', jsonb_build_object('tasks', _current_tasks, 'goals', _current_goals),
    'snapshot_counts', jsonb_build_object('tasks', _snap_tasks, 'goals', _snap_goals),
    'will_delete', jsonb_build_object('tasks', _current_tasks, 'goals', _current_goals),
    'will_restore', jsonb_build_object('tasks', _snap_tasks, 'goals', _snap_goals)
  );

  -- Generate confirmation token (10 min TTL)
  _token := encode(gen_random_bytes(32), 'hex');

  INSERT INTO restore_confirmation_tokens (snapshot_id, workspace_id, created_by, token, preview_summary, expires_at)
  VALUES (_snapshot_id, _snap.workspace_id, _actor, _token, _summary, now() + interval '10 minutes');

  RETURN jsonb_build_object(
    'confirmation_token', _token,
    'expires_in_seconds', 600,
    'summary', _summary
  );
END;
$$;

-- ── 4. Fix restore_workspace_snapshot: mandatory token + hashtext lock ──
CREATE OR REPLACE FUNCTION public.restore_workspace_snapshot(
  _snapshot_id uuid,
  _actor uuid,
  _confirmation_token text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _snap RECORD;
  _token_record RECORD;
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
  IF _actor IS NULL THEN RAISE EXCEPTION 'Actor required'; END IF;

  -- ── Mandatory token validation ──
  IF _confirmation_token IS NULL OR _confirmation_token = '' THEN
    RAISE EXCEPTION 'CONFIRMATION_REQUIRED: Call preview_restore_snapshot first to get a confirmation token';
  END IF;

  SELECT * INTO _token_record
  FROM restore_confirmation_tokens
  WHERE token = _confirmation_token
    AND snapshot_id = _snapshot_id
    AND used_at IS NULL
    AND expires_at > now();

  IF NOT FOUND THEN
    RAISE EXCEPTION 'INVALID_OR_EXPIRED_TOKEN: Token is invalid, expired, or already used';
  END IF;

  -- Mark token as used immediately
  UPDATE restore_confirmation_tokens SET used_at = now() WHERE id = _token_record.id;

  SELECT * INTO _snap FROM workspace_snapshots WHERE id = _snapshot_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Snapshot not found'; END IF;

  IF NOT is_workspace_admin(_actor, _snap.workspace_id) THEN
    RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE = '42501';
  END IF;

  -- ── Advisory lock using hashtext (safe across all PG versions) ──
  PERFORM pg_advisory_xact_lock(hashtext(_snap.workspace_id::text));

  -- Delete existing data (atomic)
  DELETE FROM tasks WHERE workspace_id = _snap.workspace_id;
  DELETE FROM goals WHERE workspace_id = _snap.workspace_id;
  DELETE FROM plans WHERE workspace_id = _snap.workspace_id;
  DELETE FROM ideas WHERE workspace_id = _snap.workspace_id;

  -- Restore tasks
  FOR _task IN SELECT * FROM jsonb_array_elements(_snap.snapshot_json->'tasks')
  LOOP
    INSERT INTO tasks (id, workspace_id, created_by, title, description, status, due_date, assigned_to, meaning_object_id, source_lang, is_priority, created_at)
    VALUES (
      (_task.value->>'id')::uuid,
      _snap.workspace_id,
      (_task.value->>'created_by')::uuid,
      _task.value->>'title',
      _task.value->>'description',
      _task.value->>'status',
      CASE WHEN _task.value->>'due_date' IS NOT NULL THEN (_task.value->>'due_date')::date ELSE NULL END,
      CASE WHEN _task.value->>'assigned_to' IS NOT NULL THEN (_task.value->>'assigned_to')::uuid ELSE NULL END,
      (_task.value->>'meaning_object_id')::uuid,
      COALESCE(_task.value->>'source_lang', 'en'),
      COALESCE((_task.value->>'is_priority')::boolean, false),
      COALESCE((_task.value->>'created_at')::timestamptz, now())
    )
    ON CONFLICT (id) DO NOTHING;
    _tasks_count := _tasks_count + 1;
  END LOOP;

  -- Restore goals
  FOR _goal IN SELECT * FROM jsonb_array_elements(_snap.snapshot_json->'goals')
  LOOP
    INSERT INTO goals (id, workspace_id, created_by, title, description, status, due_date, meaning_object_id, source_lang, created_at)
    VALUES (
      (_goal.value->>'id')::uuid,
      _snap.workspace_id,
      (_goal.value->>'created_by')::uuid,
      _goal.value->>'title',
      _goal.value->>'description',
      _goal.value->>'status',
      CASE WHEN _goal.value->>'due_date' IS NOT NULL THEN (_goal.value->>'due_date')::date ELSE NULL END,
      (_goal.value->>'meaning_object_id')::uuid,
      COALESCE(_goal.value->>'source_lang', 'en'),
      COALESCE((_goal.value->>'created_at')::timestamptz, now())
    )
    ON CONFLICT (id) DO NOTHING;
    _goals_count := _goals_count + 1;
  END LOOP;

  -- Restore plans
  FOR _plan IN SELECT * FROM jsonb_array_elements(_snap.snapshot_json->'plans')
  LOOP
    INSERT INTO plans (id, workspace_id, created_by, title, description, plan_type, ai_generated, meaning_object_id, source_lang, created_at)
    VALUES (
      (_plan.value->>'id')::uuid,
      _snap.workspace_id,
      (_plan.value->>'created_by')::uuid,
      _plan.value->>'title',
      _plan.value->>'description',
      COALESCE(_plan.value->>'plan_type', 'custom'),
      COALESCE((_plan.value->>'ai_generated')::boolean, false),
      (_plan.value->>'meaning_object_id')::uuid,
      COALESCE(_plan.value->>'source_lang', 'en'),
      COALESCE((_plan.value->>'created_at')::timestamptz, now())
    )
    ON CONFLICT (id) DO NOTHING;
    _plans_count := _plans_count + 1;
  END LOOP;

  -- Restore ideas
  FOR _idea IN SELECT * FROM jsonb_array_elements(_snap.snapshot_json->'ideas')
  LOOP
    INSERT INTO ideas (id, workspace_id, created_by, title, description, source, meaning_object_id, source_lang, created_at)
    VALUES (
      (_idea.value->>'id')::uuid,
      _snap.workspace_id,
      (_idea.value->>'created_by')::uuid,
      _idea.value->>'title',
      _idea.value->>'description',
      COALESCE(_idea.value->>'source', 'snapshot'),
      (_idea.value->>'meaning_object_id')::uuid,
      COALESCE(_idea.value->>'source_lang', 'en'),
      COALESCE((_idea.value->>'created_at')::timestamptz, now())
    )
    ON CONFLICT (id) DO NOTHING;
    _ideas_count := _ideas_count + 1;
  END LOOP;

  _restored_counts := jsonb_build_object(
    'tasks', _tasks_count,
    'goals', _goals_count,
    'plans', _plans_count,
    'ideas', _ideas_count
  );

  INSERT INTO audit_logs (workspace_id, actor_user_id, action, entity_type, entity_id, metadata)
  VALUES (_snap.workspace_id, _actor, 'workspace.snapshot_restored', 'workspace_snapshot', _snapshot_id::text,
    jsonb_build_object('restored_counts', _restored_counts, 'confirmation_token_id', _token_record.id));

  RETURN jsonb_build_object('success', true, 'restored_counts', _restored_counts);
END;
$$;
