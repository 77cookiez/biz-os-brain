
-- ══════════════════════════════════════════════
-- Milestone 9+10: Snapshots, Policies, Usage Counters
-- ══════════════════════════════════════════════

-- ─── 1. Usage Counters (general-purpose, not just rate limiting) ───
CREATE TABLE IF NOT EXISTS public.usage_counters (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  counter_key text NOT NULL,
  counter_value bigint NOT NULL DEFAULT 0,
  window_start timestamptz NOT NULL DEFAULT date_trunc('minute', now()),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_usage_counters_ws_key_window
  ON public.usage_counters (workspace_id, counter_key, window_start);

CREATE INDEX IF NOT EXISTS idx_usage_counters_cleanup
  ON public.usage_counters (window_start);

ALTER TABLE public.usage_counters ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view own workspace counters"
  ON public.usage_counters FOR SELECT
  USING (is_workspace_member(auth.uid(), workspace_id));

-- ─── 2. Workspace Snapshots ───
CREATE TABLE IF NOT EXISTS public.workspace_snapshots (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  snapshot_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  snapshot_type text NOT NULL DEFAULT 'manual',
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_workspace_snapshots_ws
  ON public.workspace_snapshots (workspace_id, created_at DESC);

ALTER TABLE public.workspace_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view snapshots"
  ON public.workspace_snapshots FOR SELECT
  USING (is_workspace_admin(auth.uid(), workspace_id));

CREATE POLICY "Admins can create snapshots"
  ON public.workspace_snapshots FOR INSERT
  WITH CHECK (is_workspace_admin(auth.uid(), workspace_id));

-- ─── 3. Execution Policies ───
CREATE TABLE IF NOT EXISTS public.execution_policies (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  require_owner_approval boolean NOT NULL DEFAULT false,
  restrict_ai_updates boolean NOT NULL DEFAULT false,
  max_daily_executions int DEFAULT NULL,
  enabled_modules text[] NOT NULL DEFAULT ARRAY['teamwork','brain','chat','bookivo'],
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_execution_policies_ws UNIQUE (workspace_id)
);

ALTER TABLE public.execution_policies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view execution policies"
  ON public.execution_policies FOR SELECT
  USING (is_workspace_member(auth.uid(), workspace_id));

CREATE POLICY "Admins can manage execution policies"
  ON public.execution_policies FOR ALL
  USING (is_workspace_admin(auth.uid(), workspace_id))
  WITH CHECK (is_workspace_admin(auth.uid(), workspace_id));

-- ─── 4. Pending Executions (policy approval queue) ───
CREATE TABLE IF NOT EXISTS public.pending_executions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  draft_id text NOT NULL,
  draft_json jsonb NOT NULL,
  confirmation_hash text NOT NULL,
  requested_by uuid NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  decided_by uuid,
  decided_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pending_executions_ws_status
  ON public.pending_executions (workspace_id, status);

ALTER TABLE public.pending_executions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view pending executions"
  ON public.pending_executions FOR SELECT
  USING (is_workspace_member(auth.uid(), workspace_id));

CREATE POLICY "Members can create pending executions"
  ON public.pending_executions FOR INSERT
  WITH CHECK (is_workspace_member(auth.uid(), workspace_id));

CREATE POLICY "Admins can manage pending executions"
  ON public.pending_executions FOR UPDATE
  USING (is_workspace_admin(auth.uid(), workspace_id));

-- ─── 5. RPC: increment_usage (atomic counter increment with limit check) ───
CREATE OR REPLACE FUNCTION public.increment_usage(
  _workspace_id uuid,
  _counter_key text,
  _limit int DEFAULT NULL,
  _window_seconds int DEFAULT 86400
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _window_start timestamptz;
  _current bigint;
  _reset_at timestamptz;
BEGIN
  _window_start := date_trunc('second', now()) - (EXTRACT(EPOCH FROM now())::bigint % _window_seconds) * interval '1 second';
  _reset_at := _window_start + (_window_seconds * interval '1 second');

  INSERT INTO usage_counters (workspace_id, counter_key, window_start, counter_value)
  VALUES (_workspace_id, _counter_key, _window_start, 1)
  ON CONFLICT (workspace_id, counter_key, window_start)
  DO UPDATE SET counter_value = usage_counters.counter_value + 1, updated_at = now()
  RETURNING counter_value INTO _current;

  RETURN jsonb_build_object(
    'allowed', CASE WHEN _limit IS NULL THEN true ELSE _current <= _limit END,
    'current', _current,
    'limit', _limit,
    'remaining', CASE WHEN _limit IS NULL THEN -1 ELSE GREATEST(_limit - _current, 0) END,
    'reset_at', _reset_at
  );
END;
$$;

-- ─── 6. RPC: has_feature (convenience wrapper) ───
CREATE OR REPLACE FUNCTION public.has_feature(_workspace_id uuid, _feature_key text)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT COALESCE(
    (SELECT (bp.features ->> _feature_key)::boolean
     FROM billing_subscriptions bs JOIN billing_plans bp ON bp.id = bs.plan_id
     WHERE bs.workspace_id = _workspace_id AND bs.status IN ('active','trial') LIMIT 1),
    (SELECT (bp.features ->> _feature_key)::boolean FROM billing_plans bp WHERE bp.id = 'free'),
    false
  );
$$;

-- ─── 7. RPC: check_limit (convenience wrapper) ───
CREATE OR REPLACE FUNCTION public.check_limit(_workspace_id uuid, _limit_key text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _limit_val int;
  _plan_id text;
BEGIN
  SELECT bs.plan_id INTO _plan_id
  FROM billing_subscriptions bs
  WHERE bs.workspace_id = _workspace_id AND bs.status IN ('active','trial')
  LIMIT 1;

  IF _plan_id IS NULL THEN _plan_id := 'free'; END IF;

  SELECT CASE _limit_key
    WHEN 'vendors' THEN bp.vendors_limit
    WHEN 'services' THEN bp.services_limit
    WHEN 'bookings' THEN bp.bookings_limit
    WHEN 'quotes' THEN bp.quotes_limit
    WHEN 'seats' THEN bp.seats_limit
    ELSE NULL
  END INTO _limit_val
  FROM billing_plans bp WHERE bp.id = _plan_id;

  RETURN jsonb_build_object(
    'limit', _limit_val,
    'plan_id', _plan_id
  );
END;
$$;

-- ─── 8. RPC: create_workspace_snapshot ───
CREATE OR REPLACE FUNCTION public.create_workspace_snapshot(_workspace_id uuid, _snapshot_type text DEFAULT 'manual')
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _actor uuid := auth.uid();
  _snap_id uuid;
  _snap jsonb;
BEGIN
  IF _actor IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF NOT is_workspace_admin(_actor, _workspace_id) THEN
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

  INSERT INTO workspace_snapshots (workspace_id, snapshot_json, snapshot_type, created_by)
  VALUES (_workspace_id, _snap, _snapshot_type, _actor)
  RETURNING id INTO _snap_id;

  INSERT INTO audit_logs (workspace_id, actor_user_id, action, entity_type, entity_id, metadata)
  VALUES (_workspace_id, _actor, 'workspace.snapshot_created', 'workspace_snapshot', _snap_id::text,
    jsonb_build_object('snapshot_type', _snapshot_type));

  RETURN _snap_id;
END;
$$;

-- ─── 9. RPC: restore_workspace_snapshot ───
CREATE OR REPLACE FUNCTION public.restore_workspace_snapshot(_snapshot_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _actor uuid := auth.uid();
  _snap RECORD;
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
  IF _actor IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  SELECT * INTO _snap FROM workspace_snapshots WHERE id = _snapshot_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Snapshot not found'; END IF;
  IF NOT is_workspace_admin(_actor, _snap.workspace_id) THEN
    RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE = '42501';
  END IF;

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
    jsonb_build_object('restored_counts', _restored_counts));

  RETURN jsonb_build_object('success', true, 'restored_counts', _restored_counts);
END;
$$;

-- ─── 10. RPC: get_execution_policy ───
CREATE OR REPLACE FUNCTION public.get_execution_policy(_workspace_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _policy RECORD;
BEGIN
  SELECT * INTO _policy FROM execution_policies WHERE workspace_id = _workspace_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'require_owner_approval', false,
      'restrict_ai_updates', false,
      'max_daily_executions', null,
      'enabled_modules', ARRAY['teamwork','brain','chat','bookivo']
    );
  END IF;
  RETURN jsonb_build_object(
    'require_owner_approval', _policy.require_owner_approval,
    'restrict_ai_updates', _policy.restrict_ai_updates,
    'max_daily_executions', _policy.max_daily_executions,
    'enabled_modules', _policy.enabled_modules
  );
END;
$$;

-- ─── 11. Cleanup RPC for usage_counters ───
CREATE OR REPLACE FUNCTION public.cleanup_usage_counters(_older_than_hours int DEFAULT 48, _batch int DEFAULT 1000)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE _deleted int;
BEGIN
  DELETE FROM usage_counters
  WHERE ctid IN (
    SELECT ctid FROM usage_counters
    WHERE window_start < now() - (_older_than_hours * interval '1 hour')
    ORDER BY window_start ASC
    LIMIT _batch
  );
  GET DIAGNOSTICS _deleted = ROW_COUNT;
  RETURN _deleted;
END;
$$;

-- ─── 12. Cleanup RPC for pending_executions (decided older than 7 days) ───
CREATE OR REPLACE FUNCTION public.cleanup_decided_executions(_older_than_days int DEFAULT 7, _batch int DEFAULT 500)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE _deleted int;
BEGIN
  DELETE FROM pending_executions
  WHERE ctid IN (
    SELECT ctid FROM pending_executions
    WHERE status IN ('approved', 'rejected')
      AND decided_at < now() - (_older_than_days * interval '1 day')
    ORDER BY decided_at ASC
    LIMIT _batch
  );
  GET DIAGNOSTICS _deleted = ROW_COUNT;
  RETURN _deleted;
END;
$$;
