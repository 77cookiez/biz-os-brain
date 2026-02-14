
-- ============================================================
-- A) Fix accept_quote_atomic: remove _user_id, use auth.uid()
-- ============================================================
CREATE OR REPLACE FUNCTION public.accept_quote_atomic(_quote_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _actor uuid := auth.uid();
  _quote RECORD;
  _qr RECORD;
  _booking_id uuid;
  _existing_booking_id uuid;
BEGIN
  IF _actor IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  -- Lock quote row
  SELECT * INTO _quote FROM booking_quotes WHERE id = _quote_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Quote not found'; END IF;
  IF _quote.status != 'pending' THEN RAISE EXCEPTION 'Quote is not pending (current: %)', _quote.status; END IF;
  IF _quote.expires_at IS NOT NULL AND _quote.expires_at < now() THEN RAISE EXCEPTION 'Quote has expired'; END IF;

  -- Lock quote request
  SELECT * INTO _qr FROM booking_quote_requests WHERE id = _quote.quote_request_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Quote request not found'; END IF;

  -- Permission check: customer who owns the request
  IF _qr.customer_user_id != _actor THEN
    RAISE EXCEPTION 'Forbidden: only the customer can accept a quote';
  END IF;

  IF _qr.status NOT IN ('requested', 'quoted') THEN
    RAISE EXCEPTION 'Quote request status invalid for acceptance (current: %)', _qr.status;
  END IF;

  -- Idempotency
  SELECT id INTO _existing_booking_id FROM booking_bookings WHERE quote_id = _quote_id;
  IF _existing_booking_id IS NOT NULL THEN RETURN _existing_booking_id; END IF;

  -- Accept the quote
  UPDATE booking_quotes SET status = 'accepted', updated_at = now() WHERE id = _quote_id;

  -- Decline competing quotes
  UPDATE booking_quotes SET status = 'declined', updated_at = now()
  WHERE quote_request_id = _quote.quote_request_id AND id != _quote_id AND status = 'pending';

  -- Update quote request
  UPDATE booking_quote_requests SET status = 'accepted', updated_at = now()
  WHERE id = _quote.quote_request_id;

  -- Create booking
  INSERT INTO booking_bookings (
    workspace_id, quote_id, quote_request_id, vendor_id, customer_user_id,
    total_amount, currency, event_date, status, payment_status, payment_provider
  ) VALUES (
    _quote.workspace_id, _quote_id, _quote.quote_request_id, _quote.vendor_id, _qr.customer_user_id,
    _quote.amount, _quote.currency, _qr.event_date,
    'confirmed_pending_payment', 'unpaid', 'offline'
  )
  RETURNING id INTO _booking_id;

  -- Audit
  INSERT INTO audit_logs (workspace_id, actor_user_id, action, entity_type, entity_id, metadata)
  VALUES (_quote.workspace_id, _actor, 'booking.quote_accepted_atomic', 'booking_booking', _booking_id::text,
    jsonb_build_object('quote_id', _quote_id, 'quote_request_id', _quote.quote_request_id, 'amount', _quote.amount));

  RETURN _booking_id;
END;
$function$;

-- ============================================================
-- B) request_upgrade RPC
-- ============================================================
CREATE OR REPLACE FUNCTION public.request_upgrade(_workspace_id uuid, _plan_id text, _notes text DEFAULT NULL)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _actor uuid := auth.uid();
  _req_id uuid;
BEGIN
  IF _actor IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF NOT is_workspace_member(_actor, _workspace_id) THEN
    RAISE EXCEPTION 'Forbidden: not a workspace member';
  END IF;

  INSERT INTO billing_upgrade_requests (workspace_id, requested_plan_id, requested_by, notes)
  VALUES (_workspace_id, _plan_id, _actor, _notes)
  RETURNING id INTO _req_id;

  INSERT INTO audit_logs (workspace_id, actor_user_id, action, entity_type, entity_id, metadata)
  VALUES (_workspace_id, _actor, 'billing.upgrade_requested', 'billing_upgrade_request', _req_id::text,
    jsonb_build_object('plan_id', _plan_id));

  RETURN _req_id;
END;
$function$;

-- ============================================================
-- B) decide_upgrade RPC (atomic approve/reject)
-- ============================================================
CREATE OR REPLACE FUNCTION public.decide_upgrade(_request_id uuid, _decision text, _notes text DEFAULT NULL)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _actor uuid := auth.uid();
  _req RECORD;
  _sub_id uuid;
BEGIN
  IF _actor IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF _decision NOT IN ('approved', 'rejected') THEN
    RAISE EXCEPTION 'Invalid decision: must be approved or rejected';
  END IF;

  -- Lock request
  SELECT * INTO _req FROM billing_upgrade_requests WHERE id = _request_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Upgrade request not found'; END IF;
  IF _req.status != 'pending' THEN RAISE EXCEPTION 'Request already decided (status: %)', _req.status; END IF;

  -- Permission
  IF NOT can_manage_billing(_req.workspace_id) THEN
    RAISE EXCEPTION 'Forbidden: only billing admins can decide upgrades';
  END IF;

  -- Update request
  UPDATE billing_upgrade_requests SET
    status = _decision,
    decided_by = _actor,
    decided_at = (now() AT TIME ZONE 'utc'),
    notes = COALESCE(_notes, billing_upgrade_requests.notes),
    updated_at = now()
  WHERE id = _request_id;

  IF _decision = 'approved' THEN
    -- Upsert subscription
    INSERT INTO billing_subscriptions (workspace_id, plan_id, status, billing_provider, current_period_start)
    VALUES (_req.workspace_id, _req.requested_plan_id, 'active', 'offline_invoice', (now() AT TIME ZONE 'utc'))
    ON CONFLICT (workspace_id) DO UPDATE SET
      plan_id = EXCLUDED.plan_id,
      status = 'active',
      current_period_start = EXCLUDED.current_period_start,
      updated_at = now()
    RETURNING id INTO _sub_id;
  END IF;

  -- Audit
  INSERT INTO audit_logs (workspace_id, actor_user_id, action, entity_type, entity_id, metadata)
  VALUES (_req.workspace_id, _actor,
    CASE WHEN _decision = 'approved' THEN 'billing.upgrade_approved' ELSE 'billing.upgrade_rejected' END,
    'billing_upgrade_request', _request_id::text,
    jsonb_build_object('plan_id', _req.requested_plan_id, 'decision', _decision));

  RETURN jsonb_build_object('request_id', _request_id, 'decision', _decision, 'subscription_id', _sub_id);
END;
$function$;

-- ============================================================
-- C) UTC month boundaries for usage RPCs
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_workspace_usage(_workspace_id uuid)
 RETURNS json
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT is_workspace_member(auth.uid(), _workspace_id) THEN
    RAISE EXCEPTION 'Forbidden: not a workspace member';
  END IF;
  RETURN json_build_object(
    'vendors_count', (SELECT count(*) FROM booking_vendors WHERE workspace_id = _workspace_id AND status != 'suspended'),
    'bookings_this_month', (SELECT count(*) FROM booking_bookings WHERE workspace_id = _workspace_id AND created_at >= date_trunc('month', (now() AT TIME ZONE 'utc'))),
    'services_count', (SELECT count(*) FROM booking_services WHERE workspace_id = _workspace_id AND is_active = true),
    'quotes_this_month', (SELECT count(*) FROM booking_quotes WHERE workspace_id = _workspace_id AND created_at >= date_trunc('month', (now() AT TIME ZONE 'utc')))
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.check_booking_limit(_workspace_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE _limit int; _count int;
BEGIN
  IF NOT is_workspace_member(auth.uid(), _workspace_id) THEN
    RAISE EXCEPTION 'Forbidden: not a workspace member';
  END IF;
  SELECT bp.bookings_limit INTO _limit
  FROM billing_subscriptions bs JOIN billing_plans bp ON bp.id = bs.plan_id
  WHERE bs.workspace_id = _workspace_id AND bs.status IN ('active','trial') LIMIT 1;
  IF _limit IS NULL THEN
    SELECT bp.bookings_limit INTO _limit FROM billing_plans bp WHERE bp.id = 'free';
  END IF;
  IF _limit IS NULL THEN RETURN true; END IF;
  SELECT count(*) INTO _count FROM booking_bookings WHERE workspace_id = _workspace_id AND created_at >= date_trunc('month', (now() AT TIME ZONE 'utc'));
  RETURN _count < _limit;
END;
$function$;

CREATE OR REPLACE FUNCTION public.check_quotes_limit(_workspace_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE _limit int; _count int;
BEGIN
  IF NOT is_workspace_member(auth.uid(), _workspace_id) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;
  SELECT bp.quotes_limit INTO _limit
  FROM billing_subscriptions bs JOIN billing_plans bp ON bp.id = bs.plan_id
  WHERE bs.workspace_id = _workspace_id AND bs.status IN ('active','trial') LIMIT 1;
  IF _limit IS NULL THEN
    SELECT bp.quotes_limit INTO _limit FROM billing_plans bp WHERE bp.id = 'free';
  END IF;
  IF _limit IS NULL THEN RETURN true; END IF;
  SELECT count(*) INTO _count FROM booking_quotes WHERE workspace_id = _workspace_id AND created_at >= date_trunc('month', (now() AT TIME ZONE 'utc'));
  RETURN _count < _limit;
END;
$function$;

-- ============================================================
-- D) Structured error codes in limit triggers
-- ============================================================
CREATE OR REPLACE FUNCTION public.trg_enforce_vendor_limit()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE _limit int; _count int;
BEGIN
  SELECT bp.vendors_limit INTO _limit
  FROM billing_subscriptions bs JOIN billing_plans bp ON bp.id = bs.plan_id
  WHERE bs.workspace_id = NEW.workspace_id AND bs.status IN ('active','trial') LIMIT 1;
  IF _limit IS NULL THEN
    SELECT bp.vendors_limit INTO _limit FROM billing_plans bp WHERE bp.id = 'free';
  END IF;
  IF _limit IS NOT NULL THEN
    SELECT count(*) INTO _count FROM booking_vendors WHERE workspace_id = NEW.workspace_id AND status != 'suspended';
    IF _count >= _limit THEN
      RAISE EXCEPTION 'VENDOR_LIMIT_REACHED' USING ERRCODE = 'P0001';
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.trg_enforce_booking_limit()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE _limit int; _count int;
BEGIN
  SELECT bp.bookings_limit INTO _limit
  FROM billing_subscriptions bs JOIN billing_plans bp ON bp.id = bs.plan_id
  WHERE bs.workspace_id = NEW.workspace_id AND bs.status IN ('active','trial') LIMIT 1;
  IF _limit IS NULL THEN
    SELECT bp.bookings_limit INTO _limit FROM billing_plans bp WHERE bp.id = 'free';
  END IF;
  IF _limit IS NOT NULL THEN
    SELECT count(*) INTO _count FROM booking_bookings WHERE workspace_id = NEW.workspace_id AND created_at >= date_trunc('month', (now() AT TIME ZONE 'utc'));
    IF _count >= _limit THEN
      RAISE EXCEPTION 'BOOKING_LIMIT_REACHED' USING ERRCODE = 'P0001';
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.trg_enforce_services_limit()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE _limit int; _count int;
BEGIN
  SELECT bp.services_limit INTO _limit
  FROM billing_subscriptions bs JOIN billing_plans bp ON bp.id = bs.plan_id
  WHERE bs.workspace_id = NEW.workspace_id AND bs.status IN ('active','trial') LIMIT 1;
  IF _limit IS NULL THEN
    SELECT bp.services_limit INTO _limit FROM billing_plans bp WHERE bp.id = 'free';
  END IF;
  IF _limit IS NOT NULL THEN
    SELECT count(*) INTO _count FROM booking_services WHERE workspace_id = NEW.workspace_id AND is_active = true;
    IF _count >= _limit THEN
      RAISE EXCEPTION 'SERVICES_LIMIT_REACHED' USING ERRCODE = 'P0001';
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.trg_enforce_quotes_limit()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE _limit int; _count int;
BEGIN
  SELECT bp.quotes_limit INTO _limit
  FROM billing_subscriptions bs JOIN billing_plans bp ON bp.id = bs.plan_id
  WHERE bs.workspace_id = NEW.workspace_id AND bs.status IN ('active','trial') LIMIT 1;
  IF _limit IS NULL THEN
    SELECT bp.quotes_limit INTO _limit FROM billing_plans bp WHERE bp.id = 'free';
  END IF;
  IF _limit IS NOT NULL THEN
    SELECT count(*) INTO _count FROM booking_quotes WHERE workspace_id = NEW.workspace_id AND created_at >= date_trunc('month', (now() AT TIME ZONE 'utc'));
    IF _count >= _limit THEN
      RAISE EXCEPTION 'QUOTES_LIMIT_REACHED' USING ERRCODE = 'P0001';
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;
