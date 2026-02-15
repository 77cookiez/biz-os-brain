
-- ============================================================
-- Bookivo Provider Hardening: Idempotent + Forward-Compatible
-- ============================================================

DROP FUNCTION IF EXISTS public.capture_workspace_snapshot_v3(uuid, text, text, uuid);
DROP FUNCTION IF EXISTS public.restore_bookivo_fragment(uuid, jsonb);

-- ─── HARDENED restore_bookivo_fragment ───
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
  _table_counts jsonb := '{}'::jsonb;
  _tbl_count int;
BEGIN
  -- ══════════════════════════════════════════════════════════
  -- DELETE phase: reverse FK dependency order
  -- booking_settings uses soft delete (has deleted_at column)
  -- All other tables use hard delete
  -- ══════════════════════════════════════════════════════════
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
  -- booking_settings: soft-delete aware — hard delete for restore then re-insert
  DELETE FROM booking_settings WHERE workspace_id = _workspace_id;

  -- ══════════════════════════════════════════════════════════
  -- INSERT phase: dependency order, idempotent ON CONFLICT
  -- jsonb_strip_nulls ensures forward compatibility
  -- workspace_id forced on every row
  -- ══════════════════════════════════════════════════════════

  -- 1. booking_settings (soft-delete aware table)
  _tbl_count := 0;
  IF _fragment ? 'booking_settings' AND jsonb_typeof(_fragment->'booking_settings') = 'array' THEN
    FOR _row IN SELECT jsonb_array_elements(_fragment->'booking_settings') LOOP
      INSERT INTO booking_settings
        SELECT * FROM jsonb_populate_record(null::booking_settings,
          jsonb_strip_nulls(_row) || jsonb_build_object('workspace_id', _workspace_id))
      ON CONFLICT (id) DO UPDATE SET
        workspace_id = EXCLUDED.workspace_id,
        tenant_slug = EXCLUDED.tenant_slug,
        currency = EXCLUDED.currency,
        is_live = EXCLUDED.is_live,
        payment_mode = EXCLUDED.payment_mode,
        deposit_enabled = EXCLUDED.deposit_enabled,
        deposit_type = EXCLUDED.deposit_type,
        deposit_value = EXCLUDED.deposit_value,
        commission_mode = EXCLUDED.commission_mode,
        commission_rate = EXCLUDED.commission_rate,
        cancellation_policy = EXCLUDED.cancellation_policy,
        theme_template = EXCLUDED.theme_template,
        primary_color = EXCLUDED.primary_color,
        accent_color = EXCLUDED.accent_color,
        logo_url = EXCLUDED.logo_url,
        contact_email = EXCLUDED.contact_email,
        whatsapp_number = EXCLUDED.whatsapp_number,
        tone = EXCLUDED.tone,
        ai_booking_assistant_enabled = EXCLUDED.ai_booking_assistant_enabled,
        distribution_mode = EXCLUDED.distribution_mode,
        offline_methods = EXCLUDED.offline_methods,
        stripe_account_id = EXCLUDED.stripe_account_id,
        stripe_onboarding_completed = EXCLUDED.stripe_onboarding_completed,
        payment_config = EXCLUDED.payment_config,
        refund_policy = EXCLUDED.refund_policy,
        payment_provider = EXCLUDED.payment_provider,
        app_name = EXCLUDED.app_name,
        app_description = EXCLUDED.app_description,
        app_icon_url = EXCLUDED.app_icon_url,
        app_splash_url = EXCLUDED.app_splash_url,
        app_bundle_id = EXCLUDED.app_bundle_id,
        app_version = EXCLUDED.app_version,
        app_build_number = EXCLUDED.app_build_number,
        app_keywords = EXCLUDED.app_keywords,
        app_support_email = EXCLUDED.app_support_email,
        app_privacy_url = EXCLUDED.app_privacy_url,
        publishing_progress = EXCLUDED.publishing_progress,
        deleted_at = EXCLUDED.deleted_at,
        deleted_by = EXCLUDED.deleted_by,
        updated_at = now();
      _tbl_count := _tbl_count + 1;
    END LOOP;
  END IF;
  _count := _count + _tbl_count;
  _table_counts := _table_counts || jsonb_build_object('booking_settings', _tbl_count);

  -- 2. booking_subscriptions
  _tbl_count := 0;
  IF _fragment ? 'booking_subscriptions' AND jsonb_typeof(_fragment->'booking_subscriptions') = 'array' THEN
    FOR _row IN SELECT jsonb_array_elements(_fragment->'booking_subscriptions') LOOP
      INSERT INTO booking_subscriptions
        SELECT * FROM jsonb_populate_record(null::booking_subscriptions,
          jsonb_strip_nulls(_row) || jsonb_build_object('workspace_id', _workspace_id))
      ON CONFLICT (id) DO UPDATE SET
        workspace_id = EXCLUDED.workspace_id,
        plan = EXCLUDED.plan,
        status = EXCLUDED.status,
        started_at = EXCLUDED.started_at,
        expires_at = EXCLUDED.expires_at,
        grace_period_days = EXCLUDED.grace_period_days,
        updated_at = now();
      _tbl_count := _tbl_count + 1;
    END LOOP;
  END IF;
  _count := _count + _tbl_count;
  _table_counts := _table_counts || jsonb_build_object('booking_subscriptions', _tbl_count);

  -- 3. booking_vendors
  _tbl_count := 0;
  IF _fragment ? 'booking_vendors' AND jsonb_typeof(_fragment->'booking_vendors') = 'array' THEN
    FOR _row IN SELECT jsonb_array_elements(_fragment->'booking_vendors') LOOP
      INSERT INTO booking_vendors
        SELECT * FROM jsonb_populate_record(null::booking_vendors,
          jsonb_strip_nulls(_row) || jsonb_build_object('workspace_id', _workspace_id))
      ON CONFLICT (id) DO UPDATE SET
        workspace_id = EXCLUDED.workspace_id,
        owner_user_id = EXCLUDED.owner_user_id,
        status = EXCLUDED.status,
        approved_at = EXCLUDED.approved_at,
        approved_by = EXCLUDED.approved_by,
        suspended_at = EXCLUDED.suspended_at,
        updated_at = now();
      _tbl_count := _tbl_count + 1;
    END LOOP;
  END IF;
  _count := _count + _tbl_count;
  _table_counts := _table_counts || jsonb_build_object('booking_vendors', _tbl_count);
  _valid_vendor_ids := ARRAY(SELECT id FROM booking_vendors WHERE workspace_id = _workspace_id);

  -- 4. booking_vendor_profiles (FK: vendor_id)
  _tbl_count := 0;
  IF _fragment ? 'booking_vendor_profiles' AND jsonb_typeof(_fragment->'booking_vendor_profiles') = 'array' THEN
    FOR _row IN SELECT jsonb_array_elements(_fragment->'booking_vendor_profiles') LOOP
      IF (_row->>'vendor_id')::uuid = ANY(_valid_vendor_ids) THEN
        INSERT INTO booking_vendor_profiles
          SELECT * FROM jsonb_populate_record(null::booking_vendor_profiles,
            jsonb_strip_nulls(_row) || jsonb_build_object('workspace_id', _workspace_id))
        ON CONFLICT (id) DO UPDATE SET
          workspace_id = EXCLUDED.workspace_id,
          vendor_id = EXCLUDED.vendor_id,
          display_name = EXCLUDED.display_name,
          display_name_meaning_object_id = EXCLUDED.display_name_meaning_object_id,
          bio = EXCLUDED.bio,
          bio_meaning_object_id = EXCLUDED.bio_meaning_object_id,
          email = EXCLUDED.email,
          whatsapp = EXCLUDED.whatsapp,
          logo_url = EXCLUDED.logo_url,
          cover_url = EXCLUDED.cover_url,
          source_lang = EXCLUDED.source_lang,
          updated_at = now();
        _tbl_count := _tbl_count + 1;
      END IF;
    END LOOP;
  END IF;
  _count := _count + _tbl_count;
  _table_counts := _table_counts || jsonb_build_object('booking_vendor_profiles', _tbl_count);

  -- 5. booking_availability_rules (FK: vendor_id)
  _tbl_count := 0;
  IF _fragment ? 'booking_availability_rules' AND jsonb_typeof(_fragment->'booking_availability_rules') = 'array' THEN
    FOR _row IN SELECT jsonb_array_elements(_fragment->'booking_availability_rules') LOOP
      IF (_row->>'vendor_id')::uuid = ANY(_valid_vendor_ids) THEN
        INSERT INTO booking_availability_rules
          SELECT * FROM jsonb_populate_record(null::booking_availability_rules,
            jsonb_strip_nulls(_row) || jsonb_build_object('workspace_id', _workspace_id))
        ON CONFLICT (id) DO UPDATE SET
          workspace_id = EXCLUDED.workspace_id,
          vendor_id = EXCLUDED.vendor_id,
          rules = EXCLUDED.rules,
          updated_at = now();
        _tbl_count := _tbl_count + 1;
      END IF;
    END LOOP;
  END IF;
  _count := _count + _tbl_count;
  _table_counts := _table_counts || jsonb_build_object('booking_availability_rules', _tbl_count);

  -- 6. booking_blackout_dates (FK: vendor_id)
  _tbl_count := 0;
  IF _fragment ? 'booking_blackout_dates' AND jsonb_typeof(_fragment->'booking_blackout_dates') = 'array' THEN
    FOR _row IN SELECT jsonb_array_elements(_fragment->'booking_blackout_dates') LOOP
      IF (_row->>'vendor_id')::uuid = ANY(_valid_vendor_ids) THEN
        INSERT INTO booking_blackout_dates
          SELECT * FROM jsonb_populate_record(null::booking_blackout_dates,
            jsonb_strip_nulls(_row) || jsonb_build_object('workspace_id', _workspace_id))
        ON CONFLICT (id) DO UPDATE SET
          workspace_id = EXCLUDED.workspace_id,
          vendor_id = EXCLUDED.vendor_id,
          blackout_date = EXCLUDED.blackout_date,
          reason = EXCLUDED.reason;
        _tbl_count := _tbl_count + 1;
      END IF;
    END LOOP;
  END IF;
  _count := _count + _tbl_count;
  _table_counts := _table_counts || jsonb_build_object('booking_blackout_dates', _tbl_count);

  -- 7. booking_services (FK: vendor_id)
  _tbl_count := 0;
  IF _fragment ? 'booking_services' AND jsonb_typeof(_fragment->'booking_services') = 'array' THEN
    FOR _row IN SELECT jsonb_array_elements(_fragment->'booking_services') LOOP
      IF (_row->>'vendor_id')::uuid = ANY(_valid_vendor_ids) THEN
        INSERT INTO booking_services
          SELECT * FROM jsonb_populate_record(null::booking_services,
            jsonb_strip_nulls(_row) || jsonb_build_object('workspace_id', _workspace_id))
        ON CONFLICT (id) DO UPDATE SET
          workspace_id = EXCLUDED.workspace_id,
          vendor_id = EXCLUDED.vendor_id,
          title = EXCLUDED.title,
          title_meaning_object_id = EXCLUDED.title_meaning_object_id,
          description = EXCLUDED.description,
          description_meaning_object_id = EXCLUDED.description_meaning_object_id,
          price_type = EXCLUDED.price_type,
          price_amount = EXCLUDED.price_amount,
          currency = EXCLUDED.currency,
          duration_minutes = EXCLUDED.duration_minutes,
          min_guests = EXCLUDED.min_guests,
          max_guests = EXCLUDED.max_guests,
          is_active = EXCLUDED.is_active,
          cover_url = EXCLUDED.cover_url,
          sort_order = EXCLUDED.sort_order,
          source_lang = EXCLUDED.source_lang,
          updated_at = now();
        _tbl_count := _tbl_count + 1;
      END IF;
    END LOOP;
  END IF;
  _count := _count + _tbl_count;
  _table_counts := _table_counts || jsonb_build_object('booking_services', _tbl_count);
  _valid_service_ids := ARRAY(SELECT id FROM booking_services WHERE workspace_id = _workspace_id);

  -- 8. booking_service_addons (FK: service_id)
  _tbl_count := 0;
  IF _fragment ? 'booking_service_addons' AND jsonb_typeof(_fragment->'booking_service_addons') = 'array' THEN
    FOR _row IN SELECT jsonb_array_elements(_fragment->'booking_service_addons') LOOP
      IF (_row->>'service_id')::uuid = ANY(_valid_service_ids) THEN
        INSERT INTO booking_service_addons
          SELECT * FROM jsonb_populate_record(null::booking_service_addons,
            jsonb_strip_nulls(_row) || jsonb_build_object('workspace_id', _workspace_id))
        ON CONFLICT (id) DO UPDATE SET
          workspace_id = EXCLUDED.workspace_id,
          service_id = EXCLUDED.service_id,
          name = EXCLUDED.name,
          meaning_object_id = EXCLUDED.meaning_object_id,
          price = EXCLUDED.price,
          currency = EXCLUDED.currency,
          source_lang = EXCLUDED.source_lang,
          updated_at = now();
        _tbl_count := _tbl_count + 1;
      END IF;
    END LOOP;
  END IF;
  _count := _count + _tbl_count;
  _table_counts := _table_counts || jsonb_build_object('booking_service_addons', _tbl_count);

  -- 9. booking_quote_requests (FK: service_id, vendor_id)
  _tbl_count := 0;
  IF _fragment ? 'booking_quote_requests' AND jsonb_typeof(_fragment->'booking_quote_requests') = 'array' THEN
    FOR _row IN SELECT jsonb_array_elements(_fragment->'booking_quote_requests') LOOP
      IF (_row->>'vendor_id')::uuid = ANY(_valid_vendor_ids) AND (_row->>'service_id')::uuid = ANY(_valid_service_ids) THEN
        INSERT INTO booking_quote_requests
          SELECT * FROM jsonb_populate_record(null::booking_quote_requests,
            jsonb_strip_nulls(_row) || jsonb_build_object('workspace_id', _workspace_id))
        ON CONFLICT (id) DO UPDATE SET
          workspace_id = EXCLUDED.workspace_id,
          customer_user_id = EXCLUDED.customer_user_id,
          vendor_id = EXCLUDED.vendor_id,
          service_id = EXCLUDED.service_id,
          meaning_object_id = EXCLUDED.meaning_object_id,
          event_date = EXCLUDED.event_date,
          event_time = EXCLUDED.event_time,
          guest_count = EXCLUDED.guest_count,
          notes = EXCLUDED.notes,
          status = EXCLUDED.status,
          source_lang = EXCLUDED.source_lang,
          chat_thread_id = EXCLUDED.chat_thread_id,
          updated_at = now();
        _tbl_count := _tbl_count + 1;
      END IF;
    END LOOP;
  END IF;
  _count := _count + _tbl_count;
  _table_counts := _table_counts || jsonb_build_object('booking_quote_requests', _tbl_count);
  _valid_qr_ids := ARRAY(SELECT id FROM booking_quote_requests WHERE workspace_id = _workspace_id);

  -- 10. booking_quotes (FK: quote_request_id, vendor_id)
  _tbl_count := 0;
  IF _fragment ? 'booking_quotes' AND jsonb_typeof(_fragment->'booking_quotes') = 'array' THEN
    FOR _row IN SELECT jsonb_array_elements(_fragment->'booking_quotes') LOOP
      IF (_row->>'vendor_id')::uuid = ANY(_valid_vendor_ids) AND (_row->>'quote_request_id')::uuid = ANY(_valid_qr_ids) THEN
        INSERT INTO booking_quotes
          SELECT * FROM jsonb_populate_record(null::booking_quotes,
            jsonb_strip_nulls(_row) || jsonb_build_object('workspace_id', _workspace_id))
        ON CONFLICT (id) DO UPDATE SET
          workspace_id = EXCLUDED.workspace_id,
          quote_request_id = EXCLUDED.quote_request_id,
          vendor_id = EXCLUDED.vendor_id,
          meaning_object_id = EXCLUDED.meaning_object_id,
          amount = EXCLUDED.amount,
          currency = EXCLUDED.currency,
          deposit_amount = EXCLUDED.deposit_amount,
          payment_required_type = EXCLUDED.payment_required_type,
          expiry_hours = EXCLUDED.expiry_hours,
          expires_at = EXCLUDED.expires_at,
          notes = EXCLUDED.notes,
          status = EXCLUDED.status,
          payment_status = EXCLUDED.payment_status,
          source_lang = EXCLUDED.source_lang,
          updated_at = now();
        _tbl_count := _tbl_count + 1;
      END IF;
    END LOOP;
  END IF;
  _count := _count + _tbl_count;
  _table_counts := _table_counts || jsonb_build_object('booking_quotes', _tbl_count);
  _valid_quote_ids := ARRAY(SELECT id FROM booking_quotes WHERE workspace_id = _workspace_id);

  -- 11. booking_bookings (FK: quote_id, quote_request_id, vendor_id)
  _tbl_count := 0;
  IF _fragment ? 'booking_bookings' AND jsonb_typeof(_fragment->'booking_bookings') = 'array' THEN
    FOR _row IN SELECT jsonb_array_elements(_fragment->'booking_bookings') LOOP
      IF (_row->>'vendor_id')::uuid = ANY(_valid_vendor_ids)
         AND (_row->>'quote_request_id')::uuid = ANY(_valid_qr_ids)
         AND (_row->>'quote_id')::uuid = ANY(_valid_quote_ids) THEN
        INSERT INTO booking_bookings
          SELECT * FROM jsonb_populate_record(null::booking_bookings,
            jsonb_strip_nulls(_row) || jsonb_build_object('workspace_id', _workspace_id))
        ON CONFLICT (id) DO UPDATE SET
          workspace_id = EXCLUDED.workspace_id,
          customer_user_id = EXCLUDED.customer_user_id,
          vendor_id = EXCLUDED.vendor_id,
          quote_request_id = EXCLUDED.quote_request_id,
          quote_id = EXCLUDED.quote_id,
          total_amount = EXCLUDED.total_amount,
          currency = EXCLUDED.currency,
          event_date = EXCLUDED.event_date,
          -- Status restored as-is from snapshot. Never auto-finalized.
          status = EXCLUDED.status,
          payment_status = EXCLUDED.payment_status,
          payment_provider = EXCLUDED.payment_provider,
          payment_intent_id = EXCLUDED.payment_intent_id,
          offline_payment_method = EXCLUDED.offline_payment_method,
          paid_amount = EXCLUDED.paid_amount,
          deposit_paid = EXCLUDED.deposit_paid,
          completed_at = EXCLUDED.completed_at,
          cancelled_at = EXCLUDED.cancelled_at,
          cancelled_by = EXCLUDED.cancelled_by,
          cancellation_reason = EXCLUDED.cancellation_reason,
          updated_at = now();
        _tbl_count := _tbl_count + 1;
      END IF;
    END LOOP;
  END IF;
  _count := _count + _tbl_count;
  _table_counts := _table_counts || jsonb_build_object('booking_bookings', _tbl_count);
  _valid_booking_ids := ARRAY(SELECT id FROM booking_bookings WHERE workspace_id = _workspace_id);

  -- ══════════════════════════════════════════════════════════
  -- 12. booking_payments (FK: booking_id) — FINANCIAL LEDGER
  -- Ledger restored as snapshot state only.
  -- No derived recalculation performed here.
  -- Payment status is preserved exactly as captured.
  -- Never auto-modify payment status.
  -- Never auto-finalize any booking status.
  -- ══════════════════════════════════════════════════════════
  _tbl_count := 0;
  IF _fragment ? 'booking_payments' AND jsonb_typeof(_fragment->'booking_payments') = 'array' THEN
    FOR _row IN SELECT jsonb_array_elements(_fragment->'booking_payments') LOOP
      IF (_row->>'booking_id')::uuid = ANY(_valid_booking_ids) THEN
        INSERT INTO booking_payments
          SELECT * FROM jsonb_populate_record(null::booking_payments,
            jsonb_strip_nulls(_row) || jsonb_build_object('workspace_id', _workspace_id))
        ON CONFLICT (id) DO UPDATE SET
          workspace_id = EXCLUDED.workspace_id,
          booking_id = EXCLUDED.booking_id,
          amount = EXCLUDED.amount,
          currency = EXCLUDED.currency,
          payment_type = EXCLUDED.payment_type,
          provider = EXCLUDED.provider,
          payment_reference = EXCLUDED.payment_reference,
          -- Status preserved as-is from snapshot
          status = EXCLUDED.status,
          paid_at = EXCLUDED.paid_at,
          refunded_at = EXCLUDED.refunded_at,
          metadata = EXCLUDED.metadata,
          updated_at = now();
        _tbl_count := _tbl_count + 1;
      END IF;
    END LOOP;
  END IF;
  _count := _count + _tbl_count;
  _table_counts := _table_counts || jsonb_build_object('booking_payments', _tbl_count);

  -- ══════════════════════════════════════════════════════════
  -- 13. booking_commission_ledger (FK: booking_id) — FINANCIAL LEDGER
  -- Ledger restored as snapshot state only.
  -- No derived recalculation performed here.
  -- ══════════════════════════════════════════════════════════
  _tbl_count := 0;
  IF _fragment ? 'booking_commission_ledger' AND jsonb_typeof(_fragment->'booking_commission_ledger') = 'array' THEN
    FOR _row IN SELECT jsonb_array_elements(_fragment->'booking_commission_ledger') LOOP
      IF (_row->>'booking_id')::uuid = ANY(_valid_booking_ids) THEN
        INSERT INTO booking_commission_ledger
          SELECT * FROM jsonb_populate_record(null::booking_commission_ledger,
            jsonb_strip_nulls(_row) || jsonb_build_object('workspace_id', _workspace_id))
        ON CONFLICT (id) DO UPDATE SET
          workspace_id = EXCLUDED.workspace_id,
          booking_id = EXCLUDED.booking_id,
          booking_amount = EXCLUDED.booking_amount,
          commission_rate = EXCLUDED.commission_rate,
          commission_amount = EXCLUDED.commission_amount,
          currency = EXCLUDED.currency,
          -- Status preserved as-is from snapshot
          status = EXCLUDED.status,
          invoice_id = EXCLUDED.invoice_id;
        _tbl_count := _tbl_count + 1;
      END IF;
    END LOOP;
  END IF;
  _count := _count + _tbl_count;
  _table_counts := _table_counts || jsonb_build_object('booking_commission_ledger', _tbl_count);

  -- ══════════════════════════════════════════════════════════
  -- Audit: per-table counts for observability
  -- ══════════════════════════════════════════════════════════
  INSERT INTO audit_logs (workspace_id, actor_user_id, action, entity_type, entity_id, metadata)
  VALUES (
    _workspace_id,
    COALESCE(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid),
    'workspace.bookivo_fragment_restored',
    'workspace_snapshot',
    _workspace_id::text,
    jsonb_build_object('table_counts', _table_counts, 'total', _count)
  );

  RETURN _count;
END;
$$;

-- ─── HARDENED capture_workspace_snapshot_v3 with table-specific caps ───
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
  _cap_bookings int;
  _cap_quotes int;
  _cap_services int;
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
        -- Table-specific caps with fallback to max_rows_per_table
        _max_cap := COALESCE((_prov.limits->>'max_rows_per_table')::int, 5000);
        _cap_bookings := COALESCE((_prov.limits->>'max_bookings')::int, _max_cap);
        _cap_quotes := COALESCE((_prov.limits->>'max_quotes')::int, _max_cap);
        _cap_services := COALESCE((_prov.limits->>'max_services')::int, _max_cap);

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
            'booking_services', COALESCE((SELECT jsonb_agg(row_to_json(x)) FROM (SELECT * FROM booking_services WHERE workspace_id = _workspace_id ORDER BY created_at DESC LIMIT _cap_services) x), '[]'::jsonb),
            'booking_service_addons', COALESCE((SELECT jsonb_agg(row_to_json(x)) FROM (SELECT * FROM booking_service_addons WHERE workspace_id = _workspace_id ORDER BY created_at DESC LIMIT _max_cap) x), '[]'::jsonb),
            'booking_quote_requests', COALESCE((SELECT jsonb_agg(row_to_json(x)) FROM (SELECT * FROM booking_quote_requests WHERE workspace_id = _workspace_id ORDER BY created_at DESC LIMIT _cap_quotes) x), '[]'::jsonb),
            'booking_quotes', COALESCE((SELECT jsonb_agg(row_to_json(x)) FROM (SELECT * FROM booking_quotes WHERE workspace_id = _workspace_id ORDER BY created_at DESC LIMIT _cap_quotes) x), '[]'::jsonb),
            'booking_bookings', COALESCE((SELECT jsonb_agg(row_to_json(x)) FROM (SELECT * FROM booking_bookings WHERE workspace_id = _workspace_id ORDER BY created_at DESC LIMIT _cap_bookings) x), '[]'::jsonb),
            'booking_payments', COALESCE((SELECT jsonb_agg(row_to_json(x)) FROM (SELECT * FROM booking_payments WHERE workspace_id = _workspace_id ORDER BY created_at DESC LIMIT _cap_bookings) x), '[]'::jsonb),
            'booking_commission_ledger', COALESCE((SELECT jsonb_agg(row_to_json(x)) FROM (SELECT * FROM booking_commission_ledger WHERE workspace_id = _workspace_id ORDER BY created_at DESC LIMIT _cap_bookings) x), '[]'::jsonb)
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
