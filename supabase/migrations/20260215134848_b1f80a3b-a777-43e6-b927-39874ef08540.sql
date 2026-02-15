
-- ═══════════════════════════════════════════════════════════════
-- Snapshot Provider Engine v2 — OS-wide registry + v3 RPCs
-- ═══════════════════════════════════════════════════════════════

-- 1) Provider Registry (global catalog)
CREATE TABLE IF NOT EXISTS public.snapshot_providers_registry (
  provider_id text PRIMARY KEY,
  name text NOT NULL,
  description text NOT NULL,
  critical boolean NOT NULL DEFAULT false,
  default_policy text NOT NULL DEFAULT 'full'
    CHECK (default_policy IN ('none','metadata_only','full','full_plus_files')),
  is_enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.snapshot_providers_registry ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can read provider registry"
  ON public.snapshot_providers_registry FOR SELECT
  USING (true);

-- Seed initial providers
INSERT INTO public.snapshot_providers_registry (provider_id, name, description, critical, default_policy)
VALUES
  ('workboard', 'Workboard', 'Tasks, goals, plans, ideas', true, 'full'),
  ('billing', 'Billing', 'Billing subscriptions & plan linkage', true, 'full'),
  ('team_chat', 'Team Chat', 'Channels, messages, threads, attachment references', false, 'metadata_only')
ON CONFLICT (provider_id) DO NOTHING;

-- 2) Per-workspace policy overrides
CREATE TABLE IF NOT EXISTS public.snapshot_provider_policies (
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  provider_id text NOT NULL REFERENCES public.snapshot_providers_registry(provider_id) ON DELETE CASCADE,
  policy text NOT NULL DEFAULT 'full'
    CHECK (policy IN ('none','metadata_only','full','full_plus_files')),
  include_files boolean NOT NULL DEFAULT false,
  limits jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (workspace_id, provider_id)
);

ALTER TABLE public.snapshot_provider_policies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Workspace members can read provider policies"
  ON public.snapshot_provider_policies FOR SELECT
  USING (is_workspace_member(auth.uid(), workspace_id));

CREATE POLICY "Workspace admins can manage provider policies"
  ON public.snapshot_provider_policies FOR ALL
  USING (is_workspace_admin(auth.uid(), workspace_id));

-- 3) Helper: get effective providers for a workspace
CREATE OR REPLACE FUNCTION public.get_effective_snapshot_providers(_workspace_id uuid)
RETURNS TABLE (
  provider_id text,
  name text,
  description text,
  critical boolean,
  effective_policy text,
  include_files boolean,
  limits jsonb
)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    r.provider_id,
    r.name,
    r.description,
    r.critical,
    COALESCE(p.policy, r.default_policy) AS effective_policy,
    COALESCE(p.include_files, false) AS include_files,
    COALESCE(p.limits, '{}'::jsonb) AS limits
  FROM snapshot_providers_registry r
  LEFT JOIN snapshot_provider_policies p
    ON p.provider_id = r.provider_id AND p.workspace_id = _workspace_id
  WHERE r.is_enabled = true
  ORDER BY r.critical DESC, r.provider_id;
$$;

-- 4) capture_workspace_snapshot_v3
CREATE OR REPLACE FUNCTION public.capture_workspace_snapshot_v3(
  _workspace_id uuid,
  _snapshot_type text DEFAULT 'manual',
  _reason text DEFAULT NULL,
  _actor uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _snap_id uuid := gen_random_uuid();
  _effective_actor uuid;
  _payload jsonb;
  _fragments jsonb := '[]'::jsonb;
  _prov record;
  _frag_data jsonb;
  _max_messages int;
  _provider_list text[] := '{}';
BEGIN
  _effective_actor := COALESCE(_actor, auth.uid());
  IF _effective_actor IS NULL THEN
    RAISE EXCEPTION 'Actor required';
  END IF;

  -- Permission check (skip for system pre_restore calls)
  IF _snapshot_type != 'pre_restore' THEN
    IF NOT is_workspace_admin(_effective_actor, _workspace_id) THEN
      RAISE EXCEPTION 'Forbidden: not workspace admin';
    END IF;
  END IF;

  -- Iterate effective providers
  FOR _prov IN SELECT * FROM get_effective_snapshot_providers(_workspace_id) LOOP
    _provider_list := array_append(_provider_list, _prov.provider_id);

    IF _prov.effective_policy = 'none' THEN
      _fragments := _fragments || jsonb_build_array(jsonb_build_object(
        'provider_id', _prov.provider_id,
        'version', 1,
        'policy', 'none',
        'data', NULL,
        'metadata', jsonb_build_object('entity_count', 0, 'skipped', true)
      ));
      CONTINUE;
    END IF;

    -- Capture based on provider_id
    CASE _prov.provider_id
      WHEN 'workboard' THEN
        IF _prov.effective_policy = 'metadata_only' THEN
          SELECT jsonb_build_object(
            'tasks_count', (SELECT count(*) FROM tasks WHERE workspace_id = _workspace_id AND deleted_at IS NULL),
            'goals_count', (SELECT count(*) FROM goals WHERE workspace_id = _workspace_id AND deleted_at IS NULL),
            'ideas_count', (SELECT count(*) FROM ideas WHERE workspace_id = _workspace_id AND deleted_at IS NULL)
          ) INTO _frag_data;
        ELSE
          SELECT jsonb_build_object(
            'tasks', COALESCE((SELECT jsonb_agg(row_to_json(t)) FROM tasks t WHERE t.workspace_id = _workspace_id AND t.deleted_at IS NULL), '[]'::jsonb),
            'goals', COALESCE((SELECT jsonb_agg(row_to_json(g)) FROM goals g WHERE g.workspace_id = _workspace_id AND g.deleted_at IS NULL), '[]'::jsonb),
            'ideas', COALESCE((SELECT jsonb_agg(row_to_json(i)) FROM ideas i WHERE i.workspace_id = _workspace_id AND i.deleted_at IS NULL), '[]'::jsonb)
          ) INTO _frag_data;
        END IF;

      WHEN 'billing' THEN
        IF _prov.effective_policy = 'metadata_only' THEN
          SELECT jsonb_build_object(
            'subscriptions_count', (SELECT count(*) FROM billing_subscriptions WHERE workspace_id = _workspace_id)
          ) INTO _frag_data;
        ELSE
          SELECT jsonb_build_object(
            'billing_subscriptions', COALESCE((SELECT jsonb_agg(row_to_json(bs)) FROM billing_subscriptions bs WHERE bs.workspace_id = _workspace_id), '[]'::jsonb)
          ) INTO _frag_data;
        END IF;

      WHEN 'team_chat' THEN
        _max_messages := COALESCE((_prov.limits->>'max_messages')::int, 2000);

        IF _prov.effective_policy = 'metadata_only' THEN
          SELECT jsonb_build_object(
            'threads_count', (SELECT count(*) FROM chat_threads WHERE workspace_id = _workspace_id),
            'messages_count', (SELECT count(*) FROM chat_messages WHERE workspace_id = _workspace_id),
            'members_count', (SELECT count(*) FROM chat_thread_members ctm
              JOIN chat_threads ct ON ct.id = ctm.thread_id WHERE ct.workspace_id = _workspace_id)
          ) INTO _frag_data;
        ELSE
          SELECT jsonb_build_object(
            'threads', COALESCE((SELECT jsonb_agg(row_to_json(ct)) FROM chat_threads ct WHERE ct.workspace_id = _workspace_id), '[]'::jsonb),
            'members', COALESCE((
              SELECT jsonb_agg(row_to_json(ctm))
              FROM chat_thread_members ctm
              JOIN chat_threads ct ON ct.id = ctm.thread_id
              WHERE ct.workspace_id = _workspace_id
            ), '[]'::jsonb),
            'messages', COALESCE((
              SELECT jsonb_agg(row_to_json(sub))
              FROM (
                SELECT cm.id, cm.thread_id, cm.sender_user_id, cm.workspace_id,
                       cm.meaning_object_id, cm.source_lang, cm.created_at
                FROM chat_messages cm
                WHERE cm.workspace_id = _workspace_id
                ORDER BY cm.created_at DESC
                LIMIT _max_messages
              ) sub
            ), '[]'::jsonb),
            'attachments', COALESCE((
              SELECT jsonb_agg(jsonb_build_object(
                'id', ca.id, 'message_id', ca.message_id, 'workspace_id', ca.workspace_id,
                'file_name', ca.file_name, 'file_type', ca.file_type, 'file_size', ca.file_size,
                'storage_path', ca.storage_path, 'uploaded_by', ca.uploaded_by, 'created_at', ca.created_at
              ))
              FROM chat_attachments ca WHERE ca.workspace_id = _workspace_id
            ), '[]'::jsonb)
          ) INTO _frag_data;
        END IF;

      ELSE
        -- Unknown provider: skip with metadata
        _frag_data := NULL;
    END CASE;

    _fragments := _fragments || jsonb_build_array(jsonb_build_object(
      'provider_id', _prov.provider_id,
      'version', 1,
      'policy', _prov.effective_policy,
      'data', _frag_data,
      'metadata', jsonb_build_object(
        'entity_count', CASE
          WHEN _frag_data IS NULL THEN 0
          WHEN _prov.effective_policy = 'metadata_only' THEN 0
          ELSE COALESCE(
            (SELECT sum(jsonb_array_length(v)) FROM jsonb_each(_frag_data) AS x(k, v) WHERE jsonb_typeof(v) = 'array'),
            0
          )
        END
      )
    ));
  END LOOP;

  _payload := jsonb_build_object(
    'engine_version', 2,
    'created_at', now(),
    'fragments', _fragments
  );

  INSERT INTO workspace_snapshots (id, workspace_id, snapshot_type, snapshot_json, created_by, reason)
  VALUES (_snap_id, _workspace_id, _snapshot_type, _payload, _effective_actor, _reason);

  -- Audit log
  INSERT INTO audit_logs (workspace_id, actor_user_id, action, entity_type, entity_id, metadata)
  VALUES (_workspace_id, _effective_actor, 'workspace.snapshot_created', 'workspace_snapshot', _snap_id::text,
    jsonb_build_object('snapshot_type', _snapshot_type, 'providers', _provider_list, 'reason', _reason));

  RETURN _snap_id;
END;
$$;

-- 5) preview_restore_v3
CREATE OR REPLACE FUNCTION public.preview_restore_v3(_snapshot_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _snap record;
  _token text;
  _providers jsonb := '[]'::jsonb;
  _frag jsonb;
BEGIN
  SELECT * INTO _snap FROM workspace_snapshots WHERE id = _snapshot_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Snapshot not found'; END IF;

  IF NOT is_workspace_admin(auth.uid(), _snap.workspace_id) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  -- Build providers summary from fragments
  FOR _frag IN SELECT jsonb_array_elements(_snap.snapshot_json->'fragments') LOOP
    _providers := _providers || jsonb_build_array(jsonb_build_object(
      'provider_id', _frag->>'provider_id',
      'name', COALESCE((SELECT name FROM snapshot_providers_registry WHERE provider_id = _frag->>'provider_id'), _frag->>'provider_id'),
      'critical', COALESCE((SELECT critical FROM snapshot_providers_registry WHERE provider_id = _frag->>'provider_id'), false),
      'policy', _frag->>'policy',
      'entity_count', COALESCE((_frag->'metadata'->>'entity_count')::int, 0),
      'skipped', COALESCE((_frag->'metadata'->>'skipped')::boolean, false)
    ));
  END LOOP;

  -- Generate confirmation token
  _token := encode(gen_random_bytes(32), 'hex');

  INSERT INTO restore_confirmation_tokens (snapshot_id, workspace_id, token, created_by, expires_at)
  VALUES (_snapshot_id, _snap.workspace_id, _token, auth.uid(), now() + interval '10 minutes');

  -- Audit
  INSERT INTO audit_logs (workspace_id, actor_user_id, action, entity_type, entity_id, metadata)
  VALUES (_snap.workspace_id, auth.uid(), 'workspace.snapshot_previewed', 'workspace_snapshot', _snapshot_id::text,
    jsonb_build_object('providers', _providers));

  RETURN jsonb_build_object(
    'confirmation_token', _token,
    'summary', jsonb_build_object(
      'providers', _providers,
      'snapshot_created_at', _snap.created_at,
      'snapshot_type', _snap.snapshot_type,
      'engine_version', COALESCE((_snap.snapshot_json->>'engine_version')::int, 1)
    ),
    'expires_in_seconds', 600
  );
END;
$$;

-- 6) Restore helpers

-- 6a) restore_workboard_fragment
CREATE OR REPLACE FUNCTION public.restore_workboard_fragment(_workspace_id uuid, _fragment jsonb)
RETURNS int
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _count int := 0;
  _row jsonb;
BEGIN
  -- Delete existing
  DELETE FROM tasks WHERE workspace_id = _workspace_id;
  DELETE FROM goals WHERE workspace_id = _workspace_id;
  DELETE FROM ideas WHERE workspace_id = _workspace_id;

  -- Restore tasks
  FOR _row IN SELECT jsonb_array_elements(_fragment->'tasks') LOOP
    INSERT INTO tasks SELECT * FROM jsonb_populate_record(null::tasks, _row || jsonb_build_object('workspace_id', _workspace_id));
    _count := _count + 1;
  END LOOP;

  -- Restore goals
  FOR _row IN SELECT jsonb_array_elements(_fragment->'goals') LOOP
    INSERT INTO goals SELECT * FROM jsonb_populate_record(null::goals, _row || jsonb_build_object('workspace_id', _workspace_id));
    _count := _count + 1;
  END LOOP;

  -- Restore ideas
  FOR _row IN SELECT jsonb_array_elements(_fragment->'ideas') LOOP
    INSERT INTO ideas SELECT * FROM jsonb_populate_record(null::ideas, _row || jsonb_build_object('workspace_id', _workspace_id));
    _count := _count + 1;
  END LOOP;

  RETURN _count;
END;
$$;

-- 6b) restore_billing_fragment
CREATE OR REPLACE FUNCTION public.restore_billing_fragment(_workspace_id uuid, _fragment jsonb)
RETURNS int
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _count int := 0;
  _row jsonb;
BEGIN
  FOR _row IN SELECT jsonb_array_elements(_fragment->'billing_subscriptions') LOOP
    INSERT INTO billing_subscriptions
    SELECT * FROM jsonb_populate_record(null::billing_subscriptions,
      _row || jsonb_build_object('workspace_id', _workspace_id))
    ON CONFLICT (workspace_id) DO UPDATE SET
      plan_id = EXCLUDED.plan_id,
      status = EXCLUDED.status,
      billing_cycle = EXCLUDED.billing_cycle,
      billing_provider = EXCLUDED.billing_provider,
      current_period_start = EXCLUDED.current_period_start,
      current_period_end = EXCLUDED.current_period_end,
      cancelled_at = EXCLUDED.cancelled_at,
      updated_at = now();
    _count := _count + 1;
  END LOOP;

  RETURN _count;
END;
$$;

-- 6c) restore_teamchat_fragment
CREATE OR REPLACE FUNCTION public.restore_teamchat_fragment(_workspace_id uuid, _fragment jsonb)
RETURNS int
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _count int := 0;
  _row jsonb;
  _valid_thread_ids uuid[];
  _valid_message_ids uuid[];
BEGIN
  -- Delete existing chat data for this workspace
  DELETE FROM chat_attachments WHERE workspace_id = _workspace_id;
  DELETE FROM chat_messages WHERE workspace_id = _workspace_id;
  DELETE FROM chat_thread_members WHERE thread_id IN (
    SELECT id FROM chat_threads WHERE workspace_id = _workspace_id
  );
  DELETE FROM chat_threads WHERE workspace_id = _workspace_id;

  -- Restore threads (force workspace_id)
  _valid_thread_ids := ARRAY[]::uuid[];
  FOR _row IN SELECT jsonb_array_elements(_fragment->'threads') LOOP
    INSERT INTO chat_threads
    SELECT * FROM jsonb_populate_record(null::chat_threads,
      _row || jsonb_build_object('workspace_id', _workspace_id));
    _valid_thread_ids := array_append(_valid_thread_ids, (_row->>'id')::uuid);
    _count := _count + 1;
  END LOOP;

  -- Restore members (only if thread_id in whitelist)
  FOR _row IN SELECT jsonb_array_elements(_fragment->'members') LOOP
    IF (_row->>'thread_id')::uuid = ANY(_valid_thread_ids) THEN
      INSERT INTO chat_thread_members
      SELECT * FROM jsonb_populate_record(null::chat_thread_members, _row);
      _count := _count + 1;
    END IF;
  END LOOP;

  -- Restore messages (force workspace_id, validate thread_id)
  _valid_message_ids := ARRAY[]::uuid[];
  FOR _row IN SELECT jsonb_array_elements(_fragment->'messages') LOOP
    IF (_row->>'thread_id')::uuid = ANY(_valid_thread_ids) THEN
      INSERT INTO chat_messages
      SELECT * FROM jsonb_populate_record(null::chat_messages,
        _row || jsonb_build_object('workspace_id', _workspace_id));
      _valid_message_ids := array_append(_valid_message_ids, (_row->>'id')::uuid);
      _count := _count + 1;
    END IF;
  END LOOP;

  -- Restore attachments (force workspace_id, validate message_id)
  FOR _row IN SELECT jsonb_array_elements(_fragment->'attachments') LOOP
    IF (_row->>'message_id')::uuid = ANY(_valid_message_ids) THEN
      INSERT INTO chat_attachments
      SELECT * FROM jsonb_populate_record(null::chat_attachments,
        _row || jsonb_build_object('workspace_id', _workspace_id));
      _count := _count + 1;
    END IF;
  END LOOP;

  RETURN _count;
END;
$$;

-- 7) restore_workspace_snapshot_atomic_v3
CREATE OR REPLACE FUNCTION public.restore_workspace_snapshot_atomic_v3(
  _workspace_id uuid,
  _snapshot_id uuid,
  _actor uuid,
  _confirmation_token text
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _snap record;
  _pre_snap_id uuid;
  _frag jsonb;
  _provider_id text;
  _policy text;
  _is_critical boolean;
  _restored_counts jsonb := '{}'::jsonb;
  _count int;
  _provider_map jsonb;
BEGIN
  -- Permission check
  IF NOT is_workspace_admin(_actor, _workspace_id) THEN
    RAISE EXCEPTION 'Forbidden: not workspace admin';
  END IF;

  -- Validate token
  PERFORM validate_restore_token(_snapshot_id, _confirmation_token, _actor);

  -- Advisory lock
  PERFORM pg_advisory_xact_lock(hashtext(_workspace_id::text));

  -- Load snapshot
  SELECT * INTO _snap FROM workspace_snapshots
  WHERE id = _snapshot_id AND workspace_id = _workspace_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Snapshot not found or workspace mismatch';
  END IF;

  -- Audit: started
  INSERT INTO audit_logs (workspace_id, actor_user_id, action, entity_type, entity_id, metadata)
  VALUES (_workspace_id, _actor, 'workspace.snapshot_restore_started', 'workspace_snapshot', _snapshot_id::text,
    jsonb_build_object('snapshot_type', _snap.snapshot_type));

  -- Pre-restore safety snapshot (uses v3 with _actor, type=pre_restore)
  _pre_snap_id := capture_workspace_snapshot_v3(_workspace_id, 'pre_restore', 'Auto safety snapshot before restore', _actor);

  -- Build criticality map from registry
  SELECT jsonb_object_agg(provider_id, critical) INTO _provider_map
  FROM snapshot_providers_registry WHERE is_enabled = true;

  -- Restore each fragment
  FOR _frag IN SELECT jsonb_array_elements(_snap.snapshot_json->'fragments') LOOP
    _provider_id := _frag->>'provider_id';
    _policy := _frag->>'policy';

    -- Skip none/metadata_only/skipped
    IF _policy IN ('none', 'metadata_only') OR (_frag->'metadata'->>'skipped')::boolean = true THEN
      CONTINUE;
    END IF;

    -- Check if critical
    _is_critical := COALESCE((_provider_map->>_provider_id)::boolean, false);

    BEGIN
      CASE _provider_id
        WHEN 'workboard' THEN
          _count := restore_workboard_fragment(_workspace_id, _frag->'data');
        WHEN 'billing' THEN
          _count := restore_billing_fragment(_workspace_id, _frag->'data');
        WHEN 'team_chat' THEN
          _count := restore_teamchat_fragment(_workspace_id, _frag->'data');
        ELSE
          -- Unknown provider: skip
          _count := 0;
      END CASE;

      _restored_counts := _restored_counts || jsonb_build_object(_provider_id, _count);

    EXCEPTION WHEN OTHERS THEN
      IF _is_critical THEN
        -- Critical failure: rollback entire transaction
        RAISE;
      ELSE
        -- Non-critical: log and continue
        INSERT INTO audit_logs (workspace_id, actor_user_id, action, entity_type, entity_id, metadata)
        VALUES (_workspace_id, _actor, 'workspace.provider_restore_failed', 'workspace_snapshot', _snapshot_id::text,
          jsonb_build_object('provider_id', _provider_id, 'error', SQLERRM));
        _restored_counts := _restored_counts || jsonb_build_object(_provider_id, -1);
      END IF;
    END;
  END LOOP;

  -- Audit: completed
  INSERT INTO audit_logs (workspace_id, actor_user_id, action, entity_type, entity_id, metadata)
  VALUES (_workspace_id, _actor, 'workspace.snapshot_restore_completed', 'workspace_snapshot', _snapshot_id::text,
    jsonb_build_object('restored_counts', _restored_counts, 'pre_restore_snapshot_id', _pre_snap_id));

  RETURN jsonb_build_object(
    'success', true,
    'restored_counts', _restored_counts,
    'pre_restore_snapshot_id', _pre_snap_id
  );
END;
$$;
