
-- Drop existing function with default params before recreating
DROP FUNCTION IF EXISTS public.capture_workspace_snapshot_v3(uuid, text, text, uuid);

-- ============================================================
-- Bookivo Provider: Registry + Capture + Restore (v2 Engine)
-- ============================================================

-- A) Register Bookivo in snapshot_providers_registry
INSERT INTO public.snapshot_providers_registry (provider_id, name, description, critical, default_policy, is_enabled)
VALUES (
  'bookivo',
  'Bookivo',
  'Booking services, vendors, availability, bookings, quotes, settings (file refs only)',
  true,
  'full',
  true
)
ON CONFLICT (provider_id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  critical = EXCLUDED.critical,
  default_policy = EXCLUDED.default_policy,
  is_enabled = EXCLUDED.is_enabled;

-- B) restore_bookivo_fragment — atomic restore helper
CREATE OR REPLACE FUNCTION public.restore_bookivo_fragment(
  _workspace_id uuid,
  _fragment jsonb
) RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _count int := 0;
  _row jsonb;
  _valid_vendor_ids uuid[];
  _valid_service_ids uuid[];
  _valid_qr_ids uuid[];
  _valid_quote_ids uuid[];
  _valid_booking_ids uuid[];
BEGIN
  -- DELETE in reverse dependency order
  DELETE FROM booking_commission_ledger WHERE workspace_id = _workspace_id;
  DELETE FROM booking_payments WHERE workspace_id = _workspace_id;
  DELETE FROM booking_bookings WHERE workspace_id = _workspace_id;
  DELETE FROM booking_quotes WHERE workspace_id = _workspace_id;
  DELETE FROM booking_quote_requests WHERE workspace_id = _workspace_id;
  DELETE FROM booking_service_addons WHERE workspace_id = _workspace_id;
  DELETE FROM booking_services WHERE workspace_id = _workspace_id;
  DELETE FROM booking_blackout_dates WHERE workspace_id = _workspace_id;
  DELETE FROM booking_availability_rules WHERE workspace_id = _workspace_id;
  DELETE FROM booking_vendor_profiles WHERE workspace_id = _workspace_id;
  DELETE FROM booking_vendors WHERE workspace_id = _workspace_id;
  DELETE FROM booking_subscriptions WHERE workspace_id = _workspace_id;
  DELETE FROM booking_settings WHERE workspace_id = _workspace_id;

  -- INSERT in dependency order, forcing workspace_id

  IF _fragment ? 'booking_settings' AND jsonb_typeof(_fragment->'booking_settings') = 'array' THEN
    FOR _row IN SELECT jsonb_array_elements(_fragment->'booking_settings') LOOP
      INSERT INTO booking_settings SELECT * FROM jsonb_populate_record(null::booking_settings, _row || jsonb_build_object('workspace_id', _workspace_id));
      _count := _count + 1;
    END LOOP;
  END IF;

  IF _fragment ? 'booking_subscriptions' AND jsonb_typeof(_fragment->'booking_subscriptions') = 'array' THEN
    FOR _row IN SELECT jsonb_array_elements(_fragment->'booking_subscriptions') LOOP
      INSERT INTO booking_subscriptions SELECT * FROM jsonb_populate_record(null::booking_subscriptions, _row || jsonb_build_object('workspace_id', _workspace_id));
      _count := _count + 1;
    END LOOP;
  END IF;

  IF _fragment ? 'booking_vendors' AND jsonb_typeof(_fragment->'booking_vendors') = 'array' THEN
    FOR _row IN SELECT jsonb_array_elements(_fragment->'booking_vendors') LOOP
      INSERT INTO booking_vendors SELECT * FROM jsonb_populate_record(null::booking_vendors, _row || jsonb_build_object('workspace_id', _workspace_id));
      _count := _count + 1;
    END LOOP;
  END IF;
  _valid_vendor_ids := ARRAY(SELECT id FROM booking_vendors WHERE workspace_id = _workspace_id);

  IF _fragment ? 'booking_vendor_profiles' AND jsonb_typeof(_fragment->'booking_vendor_profiles') = 'array' THEN
    FOR _row IN SELECT jsonb_array_elements(_fragment->'booking_vendor_profiles') LOOP
      IF (_row->>'vendor_id')::uuid = ANY(_valid_vendor_ids) THEN
        INSERT INTO booking_vendor_profiles SELECT * FROM jsonb_populate_record(null::booking_vendor_profiles, _row || jsonb_build_object('workspace_id', _workspace_id));
        _count := _count + 1;
      END IF;
    END LOOP;
  END IF;

  IF _fragment ? 'booking_availability_rules' AND jsonb_typeof(_fragment->'booking_availability_rules') = 'array' THEN
    FOR _row IN SELECT jsonb_array_elements(_fragment->'booking_availability_rules') LOOP
      IF (_row->>'vendor_id')::uuid = ANY(_valid_vendor_ids) THEN
        INSERT INTO booking_availability_rules SELECT * FROM jsonb_populate_record(null::booking_availability_rules, _row || jsonb_build_object('workspace_id', _workspace_id));
        _count := _count + 1;
      END IF;
    END LOOP;
  END IF;

  IF _fragment ? 'booking_blackout_dates' AND jsonb_typeof(_fragment->'booking_blackout_dates') = 'array' THEN
    FOR _row IN SELECT jsonb_array_elements(_fragment->'booking_blackout_dates') LOOP
      IF (_row->>'vendor_id')::uuid = ANY(_valid_vendor_ids) THEN
        INSERT INTO booking_blackout_dates SELECT * FROM jsonb_populate_record(null::booking_blackout_dates, _row || jsonb_build_object('workspace_id', _workspace_id));
        _count := _count + 1;
      END IF;
    END LOOP;
  END IF;

  IF _fragment ? 'booking_services' AND jsonb_typeof(_fragment->'booking_services') = 'array' THEN
    FOR _row IN SELECT jsonb_array_elements(_fragment->'booking_services') LOOP
      IF (_row->>'vendor_id')::uuid = ANY(_valid_vendor_ids) THEN
        INSERT INTO booking_services SELECT * FROM jsonb_populate_record(null::booking_services, _row || jsonb_build_object('workspace_id', _workspace_id));
        _count := _count + 1;
      END IF;
    END LOOP;
  END IF;
  _valid_service_ids := ARRAY(SELECT id FROM booking_services WHERE workspace_id = _workspace_id);

  IF _fragment ? 'booking_service_addons' AND jsonb_typeof(_fragment->'booking_service_addons') = 'array' THEN
    FOR _row IN SELECT jsonb_array_elements(_fragment->'booking_service_addons') LOOP
      IF (_row->>'service_id')::uuid = ANY(_valid_service_ids) THEN
        INSERT INTO booking_service_addons SELECT * FROM jsonb_populate_record(null::booking_service_addons, _row || jsonb_build_object('workspace_id', _workspace_id));
        _count := _count + 1;
      END IF;
    END LOOP;
  END IF;

  IF _fragment ? 'booking_quote_requests' AND jsonb_typeof(_fragment->'booking_quote_requests') = 'array' THEN
    FOR _row IN SELECT jsonb_array_elements(_fragment->'booking_quote_requests') LOOP
      IF (_row->>'vendor_id')::uuid = ANY(_valid_vendor_ids) AND (_row->>'service_id')::uuid = ANY(_valid_service_ids) THEN
        INSERT INTO booking_quote_requests SELECT * FROM jsonb_populate_record(null::booking_quote_requests, _row || jsonb_build_object('workspace_id', _workspace_id));
        _count := _count + 1;
      END IF;
    END LOOP;
  END IF;
  _valid_qr_ids := ARRAY(SELECT id FROM booking_quote_requests WHERE workspace_id = _workspace_id);

  IF _fragment ? 'booking_quotes' AND jsonb_typeof(_fragment->'booking_quotes') = 'array' THEN
    FOR _row IN SELECT jsonb_array_elements(_fragment->'booking_quotes') LOOP
      IF (_row->>'vendor_id')::uuid = ANY(_valid_vendor_ids) AND (_row->>'quote_request_id')::uuid = ANY(_valid_qr_ids) THEN
        INSERT INTO booking_quotes SELECT * FROM jsonb_populate_record(null::booking_quotes, _row || jsonb_build_object('workspace_id', _workspace_id));
        _count := _count + 1;
      END IF;
    END LOOP;
  END IF;
  _valid_quote_ids := ARRAY(SELECT id FROM booking_quotes WHERE workspace_id = _workspace_id);

  IF _fragment ? 'booking_bookings' AND jsonb_typeof(_fragment->'booking_bookings') = 'array' THEN
    FOR _row IN SELECT jsonb_array_elements(_fragment->'booking_bookings') LOOP
      IF (_row->>'vendor_id')::uuid = ANY(_valid_vendor_ids) AND (_row->>'quote_request_id')::uuid = ANY(_valid_qr_ids) AND (_row->>'quote_id')::uuid = ANY(_valid_quote_ids) THEN
        INSERT INTO booking_bookings SELECT * FROM jsonb_populate_record(null::booking_bookings, _row || jsonb_build_object('workspace_id', _workspace_id));
        _count := _count + 1;
      END IF;
    END LOOP;
  END IF;
  _valid_booking_ids := ARRAY(SELECT id FROM booking_bookings WHERE workspace_id = _workspace_id);

  IF _fragment ? 'booking_payments' AND jsonb_typeof(_fragment->'booking_payments') = 'array' THEN
    FOR _row IN SELECT jsonb_array_elements(_fragment->'booking_payments') LOOP
      IF (_row->>'booking_id')::uuid = ANY(_valid_booking_ids) THEN
        INSERT INTO booking_payments SELECT * FROM jsonb_populate_record(null::booking_payments, _row || jsonb_build_object('workspace_id', _workspace_id));
        _count := _count + 1;
      END IF;
    END LOOP;
  END IF;

  IF _fragment ? 'booking_commission_ledger' AND jsonb_typeof(_fragment->'booking_commission_ledger') = 'array' THEN
    FOR _row IN SELECT jsonb_array_elements(_fragment->'booking_commission_ledger') LOOP
      IF (_row->>'booking_id')::uuid = ANY(_valid_booking_ids) THEN
        INSERT INTO booking_commission_ledger SELECT * FROM jsonb_populate_record(null::booking_commission_ledger, _row || jsonb_build_object('workspace_id', _workspace_id));
        _count := _count + 1;
      END IF;
    END LOOP;
  END IF;

  RETURN _count;
END;
$$;

-- C) Recreate capture_workspace_snapshot_v3 with Bookivo support
CREATE OR REPLACE FUNCTION public.capture_workspace_snapshot_v3(
  _workspace_id uuid,
  _snapshot_type text,
  _reason text,
  _actor uuid DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
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
  _max_cap int;
  _provider_list text[] := '{}';
BEGIN
  _effective_actor := COALESCE(_actor, auth.uid());
  IF _effective_actor IS NULL THEN
    RAISE EXCEPTION 'Actor required';
  END IF;

  IF _snapshot_type != 'pre_restore' THEN
    IF NOT is_workspace_admin(_effective_actor, _workspace_id) THEN
      RAISE EXCEPTION 'Forbidden: not workspace admin';
    END IF;
  END IF;

  FOR _prov IN SELECT * FROM get_effective_snapshot_providers(_workspace_id) LOOP
    _provider_list := array_append(_provider_list, _prov.provider_id);

    IF _prov.effective_policy = 'none' THEN
      _fragments := _fragments || jsonb_build_array(jsonb_build_object(
        'provider_id', _prov.provider_id, 'version', 1, 'policy', 'none',
        'data', NULL, 'metadata', jsonb_build_object('entity_count', 0, 'skipped', true)
      ));
      CONTINUE;
    END IF;

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
            'members_count', (SELECT count(*) FROM chat_thread_members ctm JOIN chat_threads ct ON ct.id = ctm.thread_id WHERE ct.workspace_id = _workspace_id)
          ) INTO _frag_data;
        ELSE
          SELECT jsonb_build_object(
            'threads', COALESCE((SELECT jsonb_agg(row_to_json(ct)) FROM chat_threads ct WHERE ct.workspace_id = _workspace_id), '[]'::jsonb),
            'members', COALESCE((SELECT jsonb_agg(row_to_json(ctm)) FROM chat_thread_members ctm JOIN chat_threads ct ON ct.id = ctm.thread_id WHERE ct.workspace_id = _workspace_id), '[]'::jsonb),
            'messages', COALESCE((SELECT jsonb_agg(row_to_json(sub)) FROM (SELECT cm.id, cm.thread_id, cm.sender_user_id, cm.workspace_id, cm.meaning_object_id, cm.source_lang, cm.created_at FROM chat_messages cm WHERE cm.workspace_id = _workspace_id ORDER BY cm.created_at DESC LIMIT _max_messages) sub), '[]'::jsonb),
            'attachments', COALESCE((SELECT jsonb_agg(jsonb_build_object('id', ca.id, 'message_id', ca.message_id, 'workspace_id', ca.workspace_id, 'file_name', ca.file_name, 'file_type', ca.file_type, 'file_size', ca.file_size, 'storage_path', ca.storage_path, 'uploaded_by', ca.uploaded_by, 'created_at', ca.created_at)) FROM chat_attachments ca WHERE ca.workspace_id = _workspace_id), '[]'::jsonb)
          ) INTO _frag_data;
        END IF;

      WHEN 'bookivo' THEN
        _max_cap := COALESCE((_prov.limits->>'max_rows_per_table')::int, 5000);
        IF _prov.effective_policy = 'metadata_only' THEN
          SELECT jsonb_build_object(
            'settings_count', (SELECT count(*) FROM booking_settings WHERE workspace_id = _workspace_id AND deleted_at IS NULL),
            'vendors_count', (SELECT count(*) FROM booking_vendors WHERE workspace_id = _workspace_id),
            'services_count', (SELECT count(*) FROM booking_services WHERE workspace_id = _workspace_id),
            'bookings_count', (SELECT count(*) FROM booking_bookings WHERE workspace_id = _workspace_id),
            'quotes_count', (SELECT count(*) FROM booking_quotes WHERE workspace_id = _workspace_id),
            'quote_requests_count', (SELECT count(*) FROM booking_quote_requests WHERE workspace_id = _workspace_id)
          ) INTO _frag_data;
        ELSE
          SELECT jsonb_build_object(
            'booking_settings', COALESCE((SELECT jsonb_agg(row_to_json(x)) FROM (SELECT * FROM booking_settings WHERE workspace_id = _workspace_id AND deleted_at IS NULL ORDER BY created_at DESC LIMIT _max_cap) x), '[]'::jsonb),
            'booking_subscriptions', COALESCE((SELECT jsonb_agg(row_to_json(x)) FROM (SELECT * FROM booking_subscriptions WHERE workspace_id = _workspace_id ORDER BY created_at DESC LIMIT _max_cap) x), '[]'::jsonb),
            'booking_vendors', COALESCE((SELECT jsonb_agg(row_to_json(x)) FROM (SELECT * FROM booking_vendors WHERE workspace_id = _workspace_id ORDER BY created_at DESC LIMIT _max_cap) x), '[]'::jsonb),
            'booking_vendor_profiles', COALESCE((SELECT jsonb_agg(row_to_json(x)) FROM (SELECT * FROM booking_vendor_profiles WHERE workspace_id = _workspace_id ORDER BY created_at DESC LIMIT _max_cap) x), '[]'::jsonb),
            'booking_availability_rules', COALESCE((SELECT jsonb_agg(row_to_json(x)) FROM (SELECT * FROM booking_availability_rules WHERE workspace_id = _workspace_id ORDER BY created_at DESC LIMIT _max_cap) x), '[]'::jsonb),
            'booking_blackout_dates', COALESCE((SELECT jsonb_agg(row_to_json(x)) FROM (SELECT * FROM booking_blackout_dates WHERE workspace_id = _workspace_id ORDER BY created_at DESC LIMIT _max_cap) x), '[]'::jsonb),
            'booking_services', COALESCE((SELECT jsonb_agg(row_to_json(x)) FROM (SELECT * FROM booking_services WHERE workspace_id = _workspace_id ORDER BY created_at DESC LIMIT _max_cap) x), '[]'::jsonb),
            'booking_service_addons', COALESCE((SELECT jsonb_agg(row_to_json(x)) FROM (SELECT * FROM booking_service_addons WHERE workspace_id = _workspace_id ORDER BY created_at DESC LIMIT _max_cap) x), '[]'::jsonb),
            'booking_quote_requests', COALESCE((SELECT jsonb_agg(row_to_json(x)) FROM (SELECT * FROM booking_quote_requests WHERE workspace_id = _workspace_id ORDER BY created_at DESC LIMIT _max_cap) x), '[]'::jsonb),
            'booking_quotes', COALESCE((SELECT jsonb_agg(row_to_json(x)) FROM (SELECT * FROM booking_quotes WHERE workspace_id = _workspace_id ORDER BY created_at DESC LIMIT _max_cap) x), '[]'::jsonb),
            'booking_bookings', COALESCE((SELECT jsonb_agg(row_to_json(x)) FROM (SELECT * FROM booking_bookings WHERE workspace_id = _workspace_id ORDER BY created_at DESC LIMIT _max_cap) x), '[]'::jsonb),
            'booking_payments', COALESCE((SELECT jsonb_agg(row_to_json(x)) FROM (SELECT * FROM booking_payments WHERE workspace_id = _workspace_id ORDER BY created_at DESC LIMIT _max_cap) x), '[]'::jsonb),
            'booking_commission_ledger', COALESCE((SELECT jsonb_agg(row_to_json(x)) FROM (SELECT * FROM booking_commission_ledger WHERE workspace_id = _workspace_id ORDER BY created_at DESC LIMIT _max_cap) x), '[]'::jsonb)
          ) INTO _frag_data;
        END IF;

      ELSE
        _frag_data := NULL;
    END CASE;

    _fragments := _fragments || jsonb_build_array(jsonb_build_object(
      'provider_id', _prov.provider_id, 'version', 1, 'policy', _prov.effective_policy,
      'data', _frag_data,
      'metadata', jsonb_build_object(
        'entity_count', CASE
          WHEN _frag_data IS NULL THEN 0
          WHEN _prov.effective_policy = 'metadata_only' THEN 0
          ELSE COALESCE((SELECT sum(jsonb_array_length(v)) FROM jsonb_each(_frag_data) AS x(k, v) WHERE jsonb_typeof(v) = 'array'), 0)
        END
      )
    ));
  END LOOP;

  _payload := jsonb_build_object('engine_version', 2, 'created_at', now(), 'fragments', _fragments);

  INSERT INTO workspace_snapshots (id, workspace_id, snapshot_type, snapshot_json, created_by, reason)
  VALUES (_snap_id, _workspace_id, _snapshot_type, _payload, _effective_actor, _reason);

  INSERT INTO audit_logs (workspace_id, actor_user_id, action, entity_type, entity_id, metadata)
  VALUES (_workspace_id, _effective_actor, 'workspace.snapshot_created', 'workspace_snapshot', _snap_id::text,
    jsonb_build_object('snapshot_type', _snapshot_type, 'providers', _provider_list, 'reason', _reason));

  RETURN _snap_id;
END;
$$;

-- D) Replace restore_workspace_snapshot_atomic_v3 with Bookivo branch
CREATE OR REPLACE FUNCTION public.restore_workspace_snapshot_atomic_v3(
  _workspace_id uuid,
  _snapshot_id uuid,
  _actor uuid,
  _confirmation_token text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
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
  IF NOT is_workspace_admin(_actor, _workspace_id) THEN
    RAISE EXCEPTION 'Forbidden: not workspace admin';
  END IF;

  PERFORM validate_restore_token(_snapshot_id, _confirmation_token, _actor);
  PERFORM pg_advisory_xact_lock(hashtext(_workspace_id::text));

  SELECT * INTO _snap FROM workspace_snapshots
  WHERE id = _snapshot_id AND workspace_id = _workspace_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Snapshot not found or workspace mismatch';
  END IF;

  INSERT INTO audit_logs (workspace_id, actor_user_id, action, entity_type, entity_id, metadata)
  VALUES (_workspace_id, _actor, 'workspace.snapshot_restore_started', 'workspace_snapshot', _snapshot_id::text,
    jsonb_build_object('snapshot_type', _snap.snapshot_type));

  _pre_snap_id := capture_workspace_snapshot_v3(_workspace_id, 'pre_restore', 'Auto safety snapshot before restore', _actor);

  SELECT jsonb_object_agg(provider_id, critical) INTO _provider_map
  FROM snapshot_providers_registry WHERE is_enabled = true;

  FOR _frag IN SELECT jsonb_array_elements(_snap.snapshot_json->'fragments') LOOP
    _provider_id := _frag->>'provider_id';
    _policy := _frag->>'policy';

    IF _policy IN ('none', 'metadata_only') OR (_frag->'metadata'->>'skipped')::boolean = true THEN
      CONTINUE;
    END IF;

    _is_critical := COALESCE((_provider_map->>_provider_id)::boolean, false);

    BEGIN
      CASE _provider_id
        WHEN 'workboard' THEN
          _count := restore_workboard_fragment(_workspace_id, _frag->'data');
        WHEN 'billing' THEN
          _count := restore_billing_fragment(_workspace_id, _frag->'data');
        WHEN 'team_chat' THEN
          _count := restore_teamchat_fragment(_workspace_id, _frag->'data');
        WHEN 'bookivo' THEN
          _count := restore_bookivo_fragment(_workspace_id, _frag->'data');
        ELSE
          _count := 0;
      END CASE;

      _restored_counts := _restored_counts || jsonb_build_object(_provider_id, _count);

    EXCEPTION WHEN OTHERS THEN
      IF _is_critical THEN
        RAISE;
      ELSE
        INSERT INTO audit_logs (workspace_id, actor_user_id, action, entity_type, entity_id, metadata)
        VALUES (_workspace_id, _actor, 'workspace.provider_restore_failed', 'workspace_snapshot', _snapshot_id::text,
          jsonb_build_object('provider_id', _provider_id, 'error', SQLERRM));
        _restored_counts := _restored_counts || jsonb_build_object(_provider_id, -1);
      END IF;
    END;
  END LOOP;

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
