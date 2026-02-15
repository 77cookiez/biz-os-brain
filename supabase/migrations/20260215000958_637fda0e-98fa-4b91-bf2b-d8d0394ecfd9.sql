
-- ============================================================
-- Milestone 5: execute_draft_atomic RPC
-- Atomic execution: idempotency + agent writes + audit + org_events
-- in a single transaction. Supports: draft_task_set, draft_plan, idea
-- ============================================================

-- Add updated_at column to executed_drafts for stale takeover detection
ALTER TABLE public.executed_drafts
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

-- ============================================================
-- RPC: execute_draft_atomic
-- ============================================================
CREATE OR REPLACE FUNCTION public.execute_draft_atomic(
  _workspace_id uuid,
  _draft_id text,
  _draft_type text,
  _agent_type text,
  _user_id uuid,
  _request_id text,
  _meaning_object_id uuid,
  _payload jsonb,
  _source_lang text DEFAULT 'en',
  _draft_title text DEFAULT '',
  _draft_intent text DEFAULT ''
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  _existing RECORD;
  _entities jsonb := '[]'::jsonb;
  _entity_id uuid;
  _audit_log_id uuid;
  _task RECORD;
  _tasks jsonb;
  _stale_threshold interval := interval '60 seconds';
BEGIN
  -- ── 0. Membership check ──
  IF NOT is_workspace_member(_user_id, _workspace_id) THEN
    RETURN jsonb_build_object(
      'success', false,
      'code', 'EXECUTION_DENIED',
      'reason', 'Not a workspace member'
    );
  END IF;

  -- ── 1. Idempotency reservation (SELECT FOR UPDATE to handle races) ──
  SELECT * INTO _existing
  FROM executed_drafts
  WHERE draft_id = _draft_id
  FOR UPDATE;

  IF FOUND THEN
    -- Already executed successfully → replay
    IF _existing.status = 'success' THEN
      RETURN jsonb_build_object(
        'success', true,
        'entities', COALESCE(_existing.entity_refs, '[]'::jsonb),
        'audit_log_id', _existing.audit_log_id,
        'replayed', true
      );
    END IF;

    -- Previously failed → conflict
    IF _existing.status = 'failed' THEN
      RETURN jsonb_build_object(
        'success', false,
        'code', 'ALREADY_EXECUTED',
        'reason', 'Draft previously failed',
        'previous_error', _existing.error,
        'status', 'failed'
      );
    END IF;

    -- Reserved: check staleness
    IF _existing.status = 'reserved' THEN
      IF _existing.created_at > (now() - _stale_threshold) THEN
        -- Recent reservation → in-progress
        RETURN jsonb_build_object(
          'success', false,
          'code', 'ALREADY_EXECUTED',
          'reason', 'Draft execution in progress',
          'status', 'reserved'
        );
      ELSE
        -- Stale reservation → takeover: update to our request
        UPDATE executed_drafts
        SET executed_by = _user_id,
            request_id = _request_id,
            updated_at = now()
        WHERE draft_id = _draft_id;
        -- Fall through to execute
      END IF;
    END IF;

    -- Confirmed status → proceed (shouldn't happen with Plan B but handle gracefully)
    IF _existing.status = 'confirmed' THEN
      UPDATE executed_drafts
      SET status = 'reserved',
          executed_by = _user_id,
          request_id = _request_id,
          updated_at = now()
      WHERE draft_id = _draft_id;
    END IF;
  ELSE
    -- No existing row → insert reservation
    INSERT INTO executed_drafts (draft_id, workspace_id, agent_type, draft_type, executed_by, status, request_id)
    VALUES (_draft_id, _workspace_id, _agent_type, _draft_type, _user_id, 'reserved', _request_id);
  END IF;

  -- ── 2. Agent writes ──
  BEGIN
    IF _draft_type = 'draft_task_set' THEN
      _tasks := COALESCE(_payload->'tasks', '[]'::jsonb);
      
      FOR _task IN SELECT * FROM jsonb_array_elements(_tasks)
      LOOP
        INSERT INTO tasks (
          workspace_id, created_by, title, description, status, 
          due_date, assigned_to, meaning_object_id, source_lang
        ) VALUES (
          _workspace_id,
          _user_id,
          COALESCE(_task.value->>'title', _draft_title),
          _task.value->>'description',
          'backlog',
          CASE WHEN _task.value->>'due_at' IS NOT NULL 
               THEN (_task.value->>'due_at')::date ELSE NULL END,
          CASE WHEN _task.value->>'assignee_user_id' IS NOT NULL 
               THEN (_task.value->>'assignee_user_id')::uuid ELSE NULL END,
          _meaning_object_id,
          _source_lang
        )
        RETURNING id INTO _entity_id;
        
        _entities := _entities || jsonb_build_array(
          jsonb_build_object('type', 'task', 'id', _entity_id, 'action', 'create')
        );
      END LOOP;

    ELSIF _draft_type = 'draft_plan' THEN
      INSERT INTO plans (
        workspace_id, created_by, title, description, plan_type,
        goal_id, ai_generated, meaning_object_id, source_lang
      ) VALUES (
        _workspace_id,
        _user_id,
        _draft_title,
        _payload->>'description',
        COALESCE(_payload->>'plan_type', 'custom'),
        CASE WHEN _payload->>'goal_id' IS NOT NULL 
             THEN (_payload->>'goal_id')::uuid ELSE NULL END,
        true,
        _meaning_object_id,
        _source_lang
      )
      RETURNING id INTO _entity_id;
      
      _entities := _entities || jsonb_build_array(
        jsonb_build_object('type', 'plan', 'id', _entity_id, 'action', 'create')
      );

    ELSIF _draft_type = 'idea' THEN
      INSERT INTO ideas (
        workspace_id, created_by, title, description, source,
        meaning_object_id, source_lang
      ) VALUES (
        _workspace_id,
        _user_id,
        _draft_title,
        _payload->>'description',
        'brain',
        _meaning_object_id,
        _source_lang
      )
      RETURNING id INTO _entity_id;
      
      _entities := _entities || jsonb_build_array(
        jsonb_build_object('type', 'idea', 'id', _entity_id, 'action', 'create')
      );

    ELSE
      -- Unsupported draft type → fail atomically
      UPDATE executed_drafts
      SET status = 'failed',
          error = 'Unsupported draft_type: ' || _draft_type,
          updated_at = now()
      WHERE draft_id = _draft_id;
      
      RETURN jsonb_build_object(
        'success', false,
        'code', 'EXECUTION_FAILED',
        'reason', 'Unsupported draft_type: ' || _draft_type
      );
    END IF;

  EXCEPTION WHEN OTHERS THEN
    -- Agent write failed → mark as failed and re-raise to rollback
    UPDATE executed_drafts
    SET status = 'failed',
        error = SQLERRM,
        updated_at = now()
    WHERE draft_id = _draft_id;
    
    RETURN jsonb_build_object(
      'success', false,
      'code', 'EXECUTION_FAILED',
      'reason', SQLERRM
    );
  END;

  -- ── 3. Audit log ──
  INSERT INTO audit_logs (
    workspace_id, actor_user_id, action, entity_type, entity_id, metadata
  ) VALUES (
    _workspace_id,
    _user_id,
    'agent.execute.success',
    _draft_type,
    COALESCE((_entities->0->>'id'), _draft_id),
    jsonb_build_object(
      'agent_type', _agent_type,
      'draft_id', _draft_id,
      'draft_type', _draft_type,
      'entities', _entities,
      'request_id', _request_id
    )
  )
  RETURNING id INTO _audit_log_id;

  -- ── 4. Org event (best-effort inside same txn) ──
  BEGIN
    INSERT INTO org_events (
      workspace_id, event_type, object_type, severity_hint, metadata
    ) VALUES (
      _workspace_id,
      'agent.executed',
      'agent',
      'info',
      jsonb_build_object(
        'agent_type', _agent_type,
        'draft_type', _draft_type,
        'draft_id', _draft_id,
        'entity_count', jsonb_array_length(_entities),
        'request_id', _request_id
      )
    );
  EXCEPTION WHEN OTHERS THEN
    -- Non-blocking: org_event failure should not rollback execution
    RAISE WARNING 'org_event write failed: %', SQLERRM;
  END;

  -- ── 5. Finalize reservation ──
  UPDATE executed_drafts
  SET status = 'success',
      entity_refs = _entities,
      audit_log_id = _audit_log_id,
      updated_at = now()
  WHERE draft_id = _draft_id;

  RETURN jsonb_build_object(
    'success', true,
    'entities', _entities,
    'audit_log_id', _audit_log_id,
    'replayed', false
  );
END;
$$;

-- Revoke from public/anon, only authenticated + service role
REVOKE EXECUTE ON FUNCTION public.execute_draft_atomic FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.execute_draft_atomic FROM anon;
GRANT EXECUTE ON FUNCTION public.execute_draft_atomic TO authenticated;
GRANT EXECUTE ON FUNCTION public.execute_draft_atomic TO service_role;

-- Add source_lang NOT NULL default to tasks if still nullable
ALTER TABLE public.tasks 
  ALTER COLUMN source_lang SET DEFAULT 'en',
  ALTER COLUMN source_lang SET NOT NULL;

-- Add source_lang NOT NULL default to plans if still nullable  
ALTER TABLE public.plans
  ALTER COLUMN source_lang SET DEFAULT 'en',
  ALTER COLUMN source_lang SET NOT NULL;

-- Add source_lang NOT NULL default to ideas if still nullable
ALTER TABLE public.ideas
  ALTER COLUMN source_lang SET DEFAULT 'en',
  ALTER COLUMN source_lang SET NOT NULL;

-- Add source_lang NOT NULL default to goals if still nullable
ALTER TABLE public.goals
  ALTER COLUMN source_lang SET DEFAULT 'en',
  ALTER COLUMN source_lang SET NOT NULL;
