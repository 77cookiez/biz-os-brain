
-- PATCH: Harden restore_bookivo_fragment with exact-restore, actor, snapshot-linked audit
-- Drop and recreate with new signature

DROP FUNCTION IF EXISTS public.restore_bookivo_fragment(uuid, jsonb);
DROP FUNCTION IF EXISTS public.restore_bookivo_fragment(uuid, jsonb, uuid);
DROP FUNCTION IF EXISTS public.restore_bookivo_fragment(uuid, jsonb, uuid, uuid);

CREATE OR REPLACE FUNCTION public.restore_bookivo_fragment(
  _workspace_id uuid,
  _fragment jsonb,
  _actor uuid,
  _snapshot_id uuid
) RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _row jsonb;
  _total int := 0;
  _count int;
  _valid_vendor_ids uuid[];
  _valid_service_ids uuid[];
  _valid_qr_ids uuid[];
  _valid_quote_ids uuid[];
  _valid_booking_ids uuid[];
  _incoming_setting_ids uuid[];
  _table_counts jsonb := '{}'::jsonb;
BEGIN
  -- ── Compute incoming setting IDs for soft-delete logic ──
  _incoming_setting_ids := ARRAY(
    SELECT (x->>'id')::uuid FROM jsonb_array_elements(COALESCE(_fragment->'booking_settings', '[]'::jsonb)) x
  );

  -- ══════════════════════════════════════════════════════════
  -- PHASE 1: DELETE existing workspace data (reverse FK order)
  -- Hard-delete for 12 tables, soft-delete for booking_settings
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

  -- Soft-delete booking_settings rows NOT in snapshot
  UPDATE booking_settings
  SET deleted_at = now(), deleted_by = _actor, updated_at = now()
  WHERE workspace_id = _workspace_id
    AND id <> ALL(_incoming_setting_ids);

  -- ══════════════════════════════════════════════════════════
  -- PHASE 2: INSERT snapshot rows (dependency order)
  -- ON CONFLICT kept for idempotency safety
  -- ══════════════════════════════════════════════════════════

  -- 1. booking_settings (soft-delete aware, upsert preserving deleted_at)
  _count := 0;
  FOR _row IN SELECT * FROM jsonb_array_elements(COALESCE(_fragment->'booking_settings', '[]'::jsonb))
  LOOP
    INSERT INTO booking_settings
      SELECT * FROM jsonb_populate_record(null::booking_settings,
        jsonb_strip_nulls(_row) || jsonb_build_object('workspace_id', _workspace_id))
    ON CONFLICT (id) DO UPDATE SET
      workspace_id = EXCLUDED.workspace_id,
      tenant_slug = EXCLUDED.tenant_slug,
      is_live = EXCLUDED.is_live,
      currency = EXCLUDED.currency,
      payment_mode = EXCLUDED.payment_mode,
      commission_mode = EXCLUDED.commission_mode,
      commission_rate = EXCLUDED.commission_rate,
      deposit_enabled = EXCLUDED.deposit_enabled,
      deposit_type = EXCLUDED.deposit_type,
      deposit_value = EXCLUDED.deposit_value,
      cancellation_policy = EXCLUDED.cancellation_policy,
      refund_policy = EXCLUDED.refund_policy,
      stripe_account_id = EXCLUDED.stripe_account_id,
      stripe_onboarding_completed = EXCLUDED.stripe_onboarding_completed,
      payment_provider = EXCLUDED.payment_provider,
      payment_config = EXCLUDED.payment_config,
      offline_methods = EXCLUDED.offline_methods,
      logo_url = EXCLUDED.logo_url,
      primary_color = EXCLUDED.primary_color,
      accent_color = EXCLUDED.accent_color,
      theme_template = EXCLUDED.theme_template,
      contact_email = EXCLUDED.contact_email,
      whatsapp_number = EXCLUDED.whatsapp_number,
      tone = EXCLUDED.tone,
      distribution_mode = EXCLUDED.distribution_mode,
      ai_booking_assistant_enabled = EXCLUDED.ai_booking_assistant_enabled,
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
    _count := _count + 1;
  END LOOP;
  _table_counts := _table_counts || jsonb_build_object('booking_settings', _count);
  _total := _total + _count;

  -- 2. booking_subscriptions
  _count := 0;
  FOR _row IN SELECT * FROM jsonb_array_elements(COALESCE(_fragment->'booking_subscriptions', '[]'::jsonb))
  LOOP
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
    _count := _count + 1;
  END LOOP;
  _table_counts := _table_counts || jsonb_build_object('booking_subscriptions', _count);
  _total := _total + _count;

  -- 3. booking_vendors
  _count := 0;
  FOR _row IN SELECT * FROM jsonb_array_elements(COALESCE(_fragment->'booking_vendors', '[]'::jsonb))
  LOOP
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
    _count := _count + 1;
  END LOOP;
  _table_counts := _table_counts || jsonb_build_object('booking_vendors', _count);
  _total := _total + _count;

  -- Build vendor whitelist
  _valid_vendor_ids := ARRAY(SELECT id FROM booking_vendors WHERE workspace_id = _workspace_id);

  -- 4. booking_vendor_profiles (only for valid vendors)
  _count := 0;
  FOR _row IN SELECT * FROM jsonb_array_elements(COALESCE(_fragment->'booking_vendor_profiles', '[]'::jsonb))
  LOOP
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
      _count := _count + 1;
    END IF;
  END LOOP;
  _table_counts := _table_counts || jsonb_build_object('booking_vendor_profiles', _count);
  _total := _total + _count;

  -- 5. booking_availability_rules (only for valid vendors)
  _count := 0;
  FOR _row IN SELECT * FROM jsonb_array_elements(COALESCE(_fragment->'booking_availability_rules', '[]'::jsonb))
  LOOP
    IF (_row->>'vendor_id')::uuid = ANY(_valid_vendor_ids) THEN
      INSERT INTO booking_availability_rules
        SELECT * FROM jsonb_populate_record(null::booking_availability_rules,
          jsonb_strip_nulls(_row) || jsonb_build_object('workspace_id', _workspace_id))
      ON CONFLICT (id) DO UPDATE SET
        workspace_id = EXCLUDED.workspace_id,
        vendor_id = EXCLUDED.vendor_id,
        rules = EXCLUDED.rules,
        updated_at = now();
      _count := _count + 1;
    END IF;
  END LOOP;
  _table_counts := _table_counts || jsonb_build_object('booking_availability_rules', _count);
  _total := _total + _count;

  -- 6. booking_blackout_dates (only for valid vendors)
  _count := 0;
  FOR _row IN SELECT * FROM jsonb_array_elements(COALESCE(_fragment->'booking_blackout_dates', '[]'::jsonb))
  LOOP
    IF (_row->>'vendor_id')::uuid = ANY(_valid_vendor_ids) THEN
      INSERT INTO booking_blackout_dates
        SELECT * FROM jsonb_populate_record(null::booking_blackout_dates,
          jsonb_strip_nulls(_row) || jsonb_build_object('workspace_id', _workspace_id))
      ON CONFLICT (id) DO UPDATE SET
        workspace_id = EXCLUDED.workspace_id,
        vendor_id = EXCLUDED.vendor_id,
        blackout_date = EXCLUDED.blackout_date,
        reason = EXCLUDED.reason;
      _count := _count + 1;
    END IF;
  END LOOP;
  _table_counts := _table_counts || jsonb_build_object('booking_blackout_dates', _count);
  _total := _total + _count;

  -- 7. booking_services (only for valid vendors)
  _count := 0;
  FOR _row IN SELECT * FROM jsonb_array_elements(COALESCE(_fragment->'booking_services', '[]'::jsonb))
  LOOP
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
        sort_order = EXCLUDED.sort_order,
        cover_url = EXCLUDED.cover_url,
        source_lang = EXCLUDED.source_lang,
        updated_at = now();
      _count := _count + 1;
    END IF;
  END LOOP;
  _table_counts := _table_counts || jsonb_build_object('booking_services', _count);
  _total := _total + _count;

  -- Build service whitelist
  _valid_service_ids := ARRAY(SELECT id FROM booking_services WHERE workspace_id = _workspace_id);

  -- 8. booking_service_addons (only for valid services)
  _count := 0;
  FOR _row IN SELECT * FROM jsonb_array_elements(COALESCE(_fragment->'booking_service_addons', '[]'::jsonb))
  LOOP
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
      _count := _count + 1;
    END IF;
  END LOOP;
  _table_counts := _table_counts || jsonb_build_object('booking_service_addons', _count);
  _total := _total + _count;

  -- 9. booking_quote_requests (only for valid vendors & services)
  _count := 0;
  FOR _row IN SELECT * FROM jsonb_array_elements(COALESCE(_fragment->'booking_quote_requests', '[]'::jsonb))
  LOOP
    IF (_row->>'vendor_id')::uuid = ANY(_valid_vendor_ids)
       AND (_row->>'service_id')::uuid = ANY(_valid_service_ids) THEN
      INSERT INTO booking_quote_requests
        SELECT * FROM jsonb_populate_record(null::booking_quote_requests,
          jsonb_strip_nulls(_row) || jsonb_build_object('workspace_id', _workspace_id))
      ON CONFLICT (id) DO UPDATE SET
        workspace_id = EXCLUDED.workspace_id,
        vendor_id = EXCLUDED.vendor_id,
        service_id = EXCLUDED.service_id,
        customer_user_id = EXCLUDED.customer_user_id,
        meaning_object_id = EXCLUDED.meaning_object_id,
        event_date = EXCLUDED.event_date,
        event_time = EXCLUDED.event_time,
        guest_count = EXCLUDED.guest_count,
        notes = EXCLUDED.notes,
        status = EXCLUDED.status,
        source_lang = EXCLUDED.source_lang,
        chat_thread_id = EXCLUDED.chat_thread_id,
        updated_at = now();
      _count := _count + 1;
    END IF;
  END LOOP;
  _table_counts := _table_counts || jsonb_build_object('booking_quote_requests', _count);
  _total := _total + _count;

  -- Build quote_request whitelist
  _valid_qr_ids := ARRAY(SELECT id FROM booking_quote_requests WHERE workspace_id = _workspace_id);

  -- 10. booking_quotes (only for valid vendors & quote_requests)
  _count := 0;
  FOR _row IN SELECT * FROM jsonb_array_elements(COALESCE(_fragment->'booking_quotes', '[]'::jsonb))
  LOOP
    IF (_row->>'vendor_id')::uuid = ANY(_valid_vendor_ids)
       AND (_row->>'quote_request_id')::uuid = ANY(_valid_qr_ids) THEN
      INSERT INTO booking_quotes
        SELECT * FROM jsonb_populate_record(null::booking_quotes,
          jsonb_strip_nulls(_row) || jsonb_build_object('workspace_id', _workspace_id))
      ON CONFLICT (id) DO UPDATE SET
        workspace_id = EXCLUDED.workspace_id,
        vendor_id = EXCLUDED.vendor_id,
        quote_request_id = EXCLUDED.quote_request_id,
        meaning_object_id = EXCLUDED.meaning_object_id,
        amount = EXCLUDED.amount,
        currency = EXCLUDED.currency,
        deposit_amount = EXCLUDED.deposit_amount,
        payment_required_type = EXCLUDED.payment_required_type,
        payment_status = EXCLUDED.payment_status,
        status = EXCLUDED.status,
        notes = EXCLUDED.notes,
        expiry_hours = EXCLUDED.expiry_hours,
        expires_at = EXCLUDED.expires_at,
        source_lang = EXCLUDED.source_lang,
        updated_at = now();
      _count := _count + 1;
    END IF;
  END LOOP;
  _table_counts := _table_counts || jsonb_build_object('booking_quotes', _count);
  _total := _total + _count;

  -- Build quote whitelist
  _valid_quote_ids := ARRAY(SELECT id FROM booking_quotes WHERE workspace_id = _workspace_id);

  -- 11. booking_bookings (only for valid vendors, quote_requests, quotes)
  -- NOTE: status and payment_status restored as-is — no auto-finalization
  _count := 0;
  FOR _row IN SELECT * FROM jsonb_array_elements(COALESCE(_fragment->'booking_bookings', '[]'::jsonb))
  LOOP
    IF (_row->>'vendor_id')::uuid = ANY(_valid_vendor_ids)
       AND (_row->>'quote_request_id')::uuid = ANY(_valid_qr_ids)
       AND (_row->>'quote_id')::uuid = ANY(_valid_quote_ids) THEN
      INSERT INTO booking_bookings
        SELECT * FROM jsonb_populate_record(null::booking_bookings,
          jsonb_strip_nulls(_row) || jsonb_build_object('workspace_id', _workspace_id))
      ON CONFLICT (id) DO UPDATE SET
        workspace_id = EXCLUDED.workspace_id,
        vendor_id = EXCLUDED.vendor_id,
        customer_user_id = EXCLUDED.customer_user_id,
        quote_request_id = EXCLUDED.quote_request_id,
        quote_id = EXCLUDED.quote_id,
        total_amount = EXCLUDED.total_amount,
        currency = EXCLUDED.currency,
        status = EXCLUDED.status,
        payment_status = EXCLUDED.payment_status,
        payment_provider = EXCLUDED.payment_provider,
        payment_intent_id = EXCLUDED.payment_intent_id,
        offline_payment_method = EXCLUDED.offline_payment_method,
        paid_amount = EXCLUDED.paid_amount,
        deposit_paid = EXCLUDED.deposit_paid,
        event_date = EXCLUDED.event_date,
        completed_at = EXCLUDED.completed_at,
        cancelled_at = EXCLUDED.cancelled_at,
        cancelled_by = EXCLUDED.cancelled_by,
        cancellation_reason = EXCLUDED.cancellation_reason,
        updated_at = now();
      _count := _count + 1;
    END IF;
  END LOOP;
  _table_counts := _table_counts || jsonb_build_object('booking_bookings', _count);
  _total := _total + _count;

  -- Build booking whitelist for financial tables
  _valid_booking_ids := ARRAY(SELECT id FROM booking_bookings WHERE workspace_id = _workspace_id);

  -- 12. booking_payments (only for valid bookings)
  -- Ledger restored as snapshot state only.
  -- No derived recalculation performed here.
  -- Never auto-modify payment status.
  _count := 0;
  FOR _row IN SELECT * FROM jsonb_array_elements(COALESCE(_fragment->'booking_payments', '[]'::jsonb))
  LOOP
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
        status = EXCLUDED.status,
        payment_reference = EXCLUDED.payment_reference,
        metadata = EXCLUDED.metadata,
        paid_at = EXCLUDED.paid_at,
        refunded_at = EXCLUDED.refunded_at,
        updated_at = now();
      _count := _count + 1;
    END IF;
  END LOOP;
  _table_counts := _table_counts || jsonb_build_object('booking_payments', _count);
  _total := _total + _count;

  -- 13. booking_commission_ledger (only for valid bookings)
  -- Ledger restored as snapshot state only.
  -- No derived recalculation performed here.
  -- Never auto-finalize any booking or commission status.
  _count := 0;
  FOR _row IN SELECT * FROM jsonb_array_elements(COALESCE(_fragment->'booking_commission_ledger', '[]'::jsonb))
  LOOP
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
        status = EXCLUDED.status,
        invoice_id = EXCLUDED.invoice_id;
      _count := _count + 1;
    END IF;
  END LOOP;
  _table_counts := _table_counts || jsonb_build_object('booking_commission_ledger', _count);
  _total := _total + _count;

  -- ══════════════════════════════════════════════════════════
  -- AUDIT: Log restoration with actor and snapshot linkage
  -- ══════════════════════════════════════════════════════════
  INSERT INTO audit_logs (
    workspace_id, actor_user_id, action, entity_type, entity_id, metadata
  ) VALUES (
    _workspace_id,
    _actor,
    'workspace.bookivo_fragment_restored',
    'workspace_snapshot',
    _snapshot_id::text,
    jsonb_build_object(
      'workspace_id', _workspace_id,
      'snapshot_id', _snapshot_id,
      'table_counts', _table_counts,
      'total', _total
    )
  );

  RETURN _total;
END;
$$;

-- ══════════════════════════════════════════════════════════
-- Update restore_workspace_snapshot_atomic_v3 to pass _actor and _snapshot_id to bookivo
-- We need to update the CASE branch for bookivo
-- ══════════════════════════════════════════════════════════

-- First, let's recreate the full function with the bookivo branch updated
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
  _token_row record;
  _payload jsonb;
  _fragments jsonb;
  _frag jsonb;
  _provider_id text;
  _is_critical boolean;
  _count int;
  _restored_counts jsonb := '{}'::jsonb;
  _pre_restore_id uuid;
  _failed_providers text[] := '{}';
BEGIN
  -- 1. Validate snapshot exists and belongs to workspace
  SELECT * INTO _snap FROM workspace_snapshots
  WHERE id = _snapshot_id AND workspace_id = _workspace_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Snapshot not found or workspace mismatch'
      USING ERRCODE = 'P0002';
  END IF;

  -- 2. Validate confirmation token
  SELECT * INTO _token_row FROM restore_confirmation_tokens
  WHERE snapshot_id = _snapshot_id
    AND token = _confirmation_token
    AND used_at IS NULL
    AND expires_at > now();

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invalid or expired confirmation token'
      USING ERRCODE = 'P0002';
  END IF;

  -- 3. Mark token as used
  UPDATE restore_confirmation_tokens
  SET used_at = now()
  WHERE id = _token_row.id;

  -- 4. Advisory lock to prevent concurrent restores
  PERFORM pg_advisory_xact_lock(hashtext(_workspace_id::text));

  -- 5. Create pre-restore safety snapshot
  _pre_restore_id := gen_random_uuid();
  INSERT INTO workspace_snapshots (id, workspace_id, snapshot_type, reason, created_by, snapshot_json)
  VALUES (
    _pre_restore_id,
    _workspace_id,
    'pre_restore',
    'Auto pre-restore before restoring snapshot ' || _snapshot_id::text,
    _actor,
    _snap.snapshot_json
  );

  -- 6. Audit: restore started
  INSERT INTO audit_logs (workspace_id, actor_user_id, action, entity_type, entity_id, metadata)
  VALUES (
    _workspace_id, _actor,
    'workspace.snapshot_restore_started',
    'workspace_snapshot', _snapshot_id::text,
    jsonb_build_object('pre_restore_snapshot_id', _pre_restore_id, 'source_snapshot_id', _snapshot_id)
  );

  -- 7. Parse payload
  _payload := _snap.snapshot_json;
  _fragments := COALESCE(_payload->'fragments', '[]'::jsonb);

  -- 8. Process each fragment in deterministic order (sorted by provider_id)
  FOR _frag IN SELECT * FROM jsonb_array_elements(_fragments) ORDER BY (value->>'provider_id')
  LOOP
    _provider_id := _frag->>'provider_id';

    -- Skip none/metadata_only policies
    IF _frag->>'policy' IN ('none', 'metadata_only') THEN
      CONTINUE;
    END IF;

    -- Look up criticality from registry
    SELECT critical INTO _is_critical
    FROM snapshot_providers_registry
    WHERE provider_id = _provider_id;

    IF NOT FOUND THEN
      _is_critical := false;
    END IF;

    BEGIN
      CASE _provider_id
        WHEN 'workboard' THEN
          _count := restore_workboard_fragment(_workspace_id, _frag->'data');
        WHEN 'billing' THEN
          _count := restore_billing_fragment(_workspace_id, _frag->'data');
        WHEN 'team_chat' THEN
          _count := restore_teamchat_fragment(_workspace_id, _frag->'data');
        WHEN 'bookivo' THEN
          _count := restore_bookivo_fragment(_workspace_id, _frag->'data', _actor, _snapshot_id);
        ELSE
          _count := 0;
      END CASE;

      _restored_counts := _restored_counts || jsonb_build_object(_provider_id, _count);

    EXCEPTION WHEN OTHERS THEN
      IF _is_critical THEN
        -- Critical provider failure => full rollback
        RAISE;
      ELSE
        -- Non-critical => log and continue
        _failed_providers := array_append(_failed_providers, _provider_id);
        INSERT INTO audit_logs (workspace_id, actor_user_id, action, entity_type, entity_id, metadata)
        VALUES (
          _workspace_id, _actor,
          'workspace.provider_restore_failed',
          'workspace_snapshot', _snapshot_id::text,
          jsonb_build_object('provider_id', _provider_id, 'error', SQLERRM)
        );
      END IF;
    END;
  END LOOP;

  -- 9. Audit: restore completed
  INSERT INTO audit_logs (workspace_id, actor_user_id, action, entity_type, entity_id, metadata)
  VALUES (
    _workspace_id, _actor,
    'workspace.snapshot_restore_completed',
    'workspace_snapshot', _snapshot_id::text,
    jsonb_build_object(
      'restored_counts', _restored_counts,
      'pre_restore_snapshot_id', _pre_restore_id,
      'failed_providers', _failed_providers
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'restored_counts', _restored_counts,
    'pre_restore_snapshot_id', _pre_restore_id,
    'failed_providers', _failed_providers
  );
END;
$$;
