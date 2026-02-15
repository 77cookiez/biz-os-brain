
-- ============================================================
-- Final hardening: TeamChat restore attachment message_id validation
-- ============================================================

CREATE OR REPLACE FUNCTION public.restore_teamchat_fragment(_workspace_id uuid, _fragment jsonb)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _count int := 0;
  _row jsonb;
  _thread_ids uuid[];  -- IDs from existing workspace threads (for delete)
  _valid_thread_ids uuid[];  -- IDs from fragment threads (whitelist)
  _valid_message_ids uuid[];  -- IDs from fragment messages (whitelist for attachments)
BEGIN
  -- Collect existing thread IDs belonging to this workspace for cleanup
  SELECT array_agg(id) INTO _thread_ids
  FROM chat_threads WHERE workspace_id = _workspace_id;

  -- Delete in reverse dependency order
  IF _thread_ids IS NOT NULL AND array_length(_thread_ids, 1) > 0 THEN
    DELETE FROM chat_attachments WHERE workspace_id = _workspace_id;
    DELETE FROM chat_messages WHERE workspace_id = _workspace_id;
    DELETE FROM chat_thread_members WHERE thread_id = ANY(_thread_ids);
    DELETE FROM chat_threads WHERE workspace_id = _workspace_id;
  END IF;

  -- 1. Restore threads first, building whitelist
  _valid_thread_ids := ARRAY[]::uuid[];
  FOR _row IN SELECT * FROM jsonb_array_elements(COALESCE(_fragment->'threads', '[]'::jsonb))
  LOOP
    INSERT INTO chat_threads
    SELECT * FROM jsonb_populate_record(null::chat_threads, _row || jsonb_build_object('workspace_id', _workspace_id));
    _valid_thread_ids := array_append(_valid_thread_ids, (_row->>'id')::uuid);
    _count := _count + 1;
  END LOOP;

  -- 2. Restore members: ONLY for threads in whitelist
  FOR _row IN SELECT * FROM jsonb_array_elements(COALESCE(_fragment->'thread_members', '[]'::jsonb))
  LOOP
    IF (_row->>'thread_id')::uuid = ANY(_valid_thread_ids) THEN
      INSERT INTO chat_thread_members
      SELECT * FROM jsonb_populate_record(null::chat_thread_members, _row);
      _count := _count + 1;
    END IF;
  END LOOP;

  -- 3. Restore messages: force workspace_id AND validate thread_id, build message whitelist
  _valid_message_ids := ARRAY[]::uuid[];
  FOR _row IN SELECT * FROM jsonb_array_elements(COALESCE(_fragment->'messages', '[]'::jsonb))
  LOOP
    IF (_row->>'thread_id')::uuid = ANY(_valid_thread_ids) THEN
      INSERT INTO chat_messages
      SELECT * FROM jsonb_populate_record(null::chat_messages, _row || jsonb_build_object('workspace_id', _workspace_id));
      _valid_message_ids := array_append(_valid_message_ids, (_row->>'id')::uuid);
      _count := _count + 1;
    END IF;
  END LOOP;

  -- 4. Restore attachment refs: force workspace_id AND validate message_id belongs to restored messages
  FOR _row IN SELECT * FROM jsonb_array_elements(COALESCE(_fragment->'attachments_refs', '[]'::jsonb))
  LOOP
    IF (_row->>'message_id')::uuid = ANY(_valid_message_ids) THEN
      INSERT INTO chat_attachments
      SELECT * FROM jsonb_populate_record(null::chat_attachments, _row || jsonb_build_object('workspace_id', _workspace_id));
      _count := _count + 1;
    ELSE
      -- Skip orphan attachments silently (non-critical)
      RAISE WARNING 'Skipped orphan attachment ref for message_id %', _row->>'message_id';
    END IF;
  END LOOP;

  RETURN _count;
END;
$function$;
