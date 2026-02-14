
-- ============================================================
-- GLOBAL SAAS HARDENING MIGRATION
-- ============================================================

-- 1) ATOMIC ACCEPT QUOTE RPC (transactional, race-condition safe)
CREATE OR REPLACE FUNCTION public.accept_quote_atomic(
  _quote_id uuid,
  _user_id uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _quote RECORD;
  _qr RECORD;
  _booking_id uuid;
  _existing_booking_id uuid;
BEGIN
  -- Lock quote row
  SELECT * INTO _quote FROM booking_quotes WHERE id = _quote_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Quote not found'; END IF;
  IF _quote.status != 'pending' THEN RAISE EXCEPTION 'Quote is not pending (current: %)', _quote.status; END IF;
  IF _quote.expires_at IS NOT NULL AND _quote.expires_at < now() THEN RAISE EXCEPTION 'Quote has expired'; END IF;

  -- Lock quote request
  SELECT * INTO _qr FROM booking_quote_requests WHERE id = _quote.quote_request_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Quote request not found'; END IF;
  IF _qr.customer_user_id != _user_id THEN RAISE EXCEPTION 'Only the customer can accept a quote'; END IF;
  IF _qr.status NOT IN ('requested', 'quoted') THEN RAISE EXCEPTION 'Quote request status invalid for acceptance (current: %)', _qr.status; END IF;

  -- Idempotency: check if booking already exists for this quote
  SELECT id INTO _existing_booking_id FROM booking_bookings WHERE quote_id = _quote_id;
  IF _existing_booking_id IS NOT NULL THEN RETURN _existing_booking_id; END IF;

  -- Accept the quote
  UPDATE booking_quotes SET status = 'accepted', updated_at = now() WHERE id = _quote_id;

  -- Decline all other pending quotes for the same request
  UPDATE booking_quotes SET status = 'declined', updated_at = now()
  WHERE quote_request_id = _quote.quote_request_id AND id != _quote_id AND status = 'pending';

  -- Update quote request status
  UPDATE booking_quote_requests SET status = 'accepted', updated_at = now()
  WHERE id = _quote.quote_request_id;

  -- Create booking (offline payment default)
  INSERT INTO booking_bookings (
    workspace_id, quote_id, quote_request_id, vendor_id, customer_user_id,
    total_amount, currency, event_date, status, payment_status, payment_provider
  ) VALUES (
    _quote.workspace_id, _quote_id, _quote.quote_request_id, _quote.vendor_id, _qr.customer_user_id,
    _quote.amount, _quote.currency, _qr.event_date,
    'confirmed_pending_payment', 'unpaid', 'offline'
  )
  RETURNING id INTO _booking_id;

  -- Audit log
  INSERT INTO audit_logs (workspace_id, actor_user_id, action, entity_type, entity_id, metadata)
  VALUES (_quote.workspace_id, _user_id, 'booking.quote_accepted_atomic', 'booking_booking', _booking_id::text,
    jsonb_build_object('quote_id', _quote_id, 'quote_request_id', _quote.quote_request_id, 'amount', _quote.amount));

  RETURN _booking_id;
END;
$$;

-- 2) AUTH-HARDENED RPCs (replace existing, add auth.uid() checks)

CREATE OR REPLACE FUNCTION public.can_use_feature(_workspace_id uuid, _feature text)
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT is_workspace_member(auth.uid(), _workspace_id) THEN
    RAISE EXCEPTION 'Forbidden: not a workspace member';
  END IF;
  RETURN COALESCE(
    (SELECT (bp.features ->> _feature)::boolean
     FROM billing_subscriptions bs JOIN billing_plans bp ON bp.id = bs.plan_id
     WHERE bs.workspace_id = _workspace_id AND bs.status IN ('active','trial') LIMIT 1),
    (SELECT (bp.features ->> _feature)::boolean FROM billing_plans bp WHERE bp.id = 'free'),
    false
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.check_vendor_limit(_workspace_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE _limit int; _count int;
BEGIN
  IF NOT is_workspace_member(auth.uid(), _workspace_id) THEN
    RAISE EXCEPTION 'Forbidden: not a workspace member';
  END IF;
  SELECT bp.vendors_limit INTO _limit
  FROM billing_subscriptions bs JOIN billing_plans bp ON bp.id = bs.plan_id
  WHERE bs.workspace_id = _workspace_id AND bs.status IN ('active','trial') LIMIT 1;
  IF _limit IS NULL THEN
    SELECT bp.vendors_limit INTO _limit FROM billing_plans bp WHERE bp.id = 'free';
  END IF;
  IF _limit IS NULL THEN RETURN true; END IF;
  SELECT count(*) INTO _count FROM booking_vendors WHERE workspace_id = _workspace_id AND status != 'suspended';
  RETURN _count < _limit;
END;
$$;

CREATE OR REPLACE FUNCTION public.check_booking_limit(_workspace_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
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
  SELECT count(*) INTO _count FROM booking_bookings WHERE workspace_id = _workspace_id AND created_at >= date_trunc('month', now());
  RETURN _count < _limit;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_workspace_usage(_workspace_id uuid)
RETURNS json
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT is_workspace_member(auth.uid(), _workspace_id) THEN
    RAISE EXCEPTION 'Forbidden: not a workspace member';
  END IF;
  RETURN json_build_object(
    'vendors_count', (SELECT count(*) FROM booking_vendors WHERE workspace_id = _workspace_id AND status != 'suspended'),
    'bookings_this_month', (SELECT count(*) FROM booking_bookings WHERE workspace_id = _workspace_id AND created_at >= date_trunc('month', now())),
    'services_count', (SELECT count(*) FROM booking_services WHERE workspace_id = _workspace_id AND is_active = true),
    'quotes_this_month', (SELECT count(*) FROM booking_quotes WHERE workspace_id = _workspace_id AND created_at >= date_trunc('month', now()))
  );
END;
$$;

-- 3) NEW RPCs: check_services_limit, check_quotes_limit, check_seat_limit, can_manage_billing

CREATE OR REPLACE FUNCTION public.check_services_limit(_workspace_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE _limit int; _count int;
BEGIN
  IF NOT is_workspace_member(auth.uid(), _workspace_id) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;
  SELECT bp.services_limit INTO _limit
  FROM billing_subscriptions bs JOIN billing_plans bp ON bp.id = bs.plan_id
  WHERE bs.workspace_id = _workspace_id AND bs.status IN ('active','trial') LIMIT 1;
  IF _limit IS NULL THEN
    SELECT bp.services_limit INTO _limit FROM billing_plans bp WHERE bp.id = 'free';
  END IF;
  IF _limit IS NULL THEN RETURN true; END IF;
  SELECT count(*) INTO _count FROM booking_services WHERE workspace_id = _workspace_id AND is_active = true;
  RETURN _count < _limit;
END;
$$;

CREATE OR REPLACE FUNCTION public.check_quotes_limit(_workspace_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
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
  SELECT count(*) INTO _count FROM booking_quotes WHERE workspace_id = _workspace_id AND created_at >= date_trunc('month', now());
  RETURN _count < _limit;
END;
$$;

CREATE OR REPLACE FUNCTION public.check_seat_limit(_workspace_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE _limit int; _count int;
BEGIN
  IF NOT is_workspace_member(auth.uid(), _workspace_id) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;
  SELECT bp.seats_limit INTO _limit
  FROM billing_subscriptions bs JOIN billing_plans bp ON bp.id = bs.plan_id
  WHERE bs.workspace_id = _workspace_id AND bs.status IN ('active','trial') LIMIT 1;
  IF _limit IS NULL THEN
    SELECT bp.seats_limit INTO _limit FROM billing_plans bp WHERE bp.id = 'free';
  END IF;
  IF _limit IS NULL THEN RETURN true; END IF;
  SELECT count(*) INTO _count FROM workspace_members WHERE workspace_id = _workspace_id;
  RETURN _count < _limit;
END;
$$;

CREATE OR REPLACE FUNCTION public.can_manage_billing(_workspace_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT (
    has_company_role(auth.uid(), get_workspace_company(_workspace_id), 'owner'::app_role)
    OR has_company_role(auth.uid(), get_workspace_company(_workspace_id), 'admin'::app_role)
  );
$$;

-- 4) BEFORE INSERT TRIGGERS to enforce limits at DB level

CREATE OR REPLACE FUNCTION public.trg_enforce_vendor_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path TO 'public'
AS $$
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
      RAISE EXCEPTION 'Vendor limit reached for this plan';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_vendor_limit ON booking_vendors;
CREATE TRIGGER trg_enforce_vendor_limit BEFORE INSERT ON booking_vendors
FOR EACH ROW EXECUTE FUNCTION trg_enforce_vendor_limit();

CREATE OR REPLACE FUNCTION public.trg_enforce_booking_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE _limit int; _count int;
BEGIN
  SELECT bp.bookings_limit INTO _limit
  FROM billing_subscriptions bs JOIN billing_plans bp ON bp.id = bs.plan_id
  WHERE bs.workspace_id = NEW.workspace_id AND bs.status IN ('active','trial') LIMIT 1;
  IF _limit IS NULL THEN
    SELECT bp.bookings_limit INTO _limit FROM billing_plans bp WHERE bp.id = 'free';
  END IF;
  IF _limit IS NOT NULL THEN
    SELECT count(*) INTO _count FROM booking_bookings WHERE workspace_id = NEW.workspace_id AND created_at >= date_trunc('month', now());
    IF _count >= _limit THEN
      RAISE EXCEPTION 'Monthly booking limit reached for this plan';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_booking_limit ON booking_bookings;
CREATE TRIGGER trg_enforce_booking_limit BEFORE INSERT ON booking_bookings
FOR EACH ROW EXECUTE FUNCTION trg_enforce_booking_limit();

CREATE OR REPLACE FUNCTION public.trg_enforce_services_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path TO 'public'
AS $$
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
      RAISE EXCEPTION 'Services limit reached for this plan';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_services_limit ON booking_services;
CREATE TRIGGER trg_enforce_services_limit BEFORE INSERT ON booking_services
FOR EACH ROW EXECUTE FUNCTION trg_enforce_services_limit();

CREATE OR REPLACE FUNCTION public.trg_enforce_quotes_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE _limit int; _count int;
BEGIN
  SELECT bp.quotes_limit INTO _limit
  FROM billing_subscriptions bs JOIN billing_plans bp ON bp.id = bs.plan_id
  WHERE bs.workspace_id = NEW.workspace_id AND bs.status IN ('active','trial') LIMIT 1;
  IF _limit IS NULL THEN
    SELECT bp.quotes_limit INTO _limit FROM billing_plans bp WHERE bp.id = 'free';
  END IF;
  IF _limit IS NOT NULL THEN
    SELECT count(*) INTO _count FROM booking_quotes WHERE workspace_id = NEW.workspace_id AND created_at >= date_trunc('month', now());
    IF _count >= _limit THEN
      RAISE EXCEPTION 'Monthly quotes limit reached for this plan';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_quotes_limit ON booking_quotes;
CREATE TRIGGER trg_enforce_quotes_limit BEFORE INSERT ON booking_quotes
FOR EACH ROW EXECUTE FUNCTION trg_enforce_quotes_limit();

-- 5) BILLING UPGRADE REQUESTS TABLE

CREATE TABLE IF NOT EXISTS public.billing_upgrade_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id),
  requested_plan_id text NOT NULL REFERENCES billing_plans(id),
  requested_by uuid NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  decided_by uuid,
  decided_at timestamptz,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.billing_upgrade_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage upgrade requests"
ON public.billing_upgrade_requests FOR ALL
USING (
  has_company_role(auth.uid(), get_workspace_company(workspace_id), 'owner'::app_role)
  OR has_company_role(auth.uid(), get_workspace_company(workspace_id), 'admin'::app_role)
);

CREATE POLICY "Requester can view own requests"
ON public.billing_upgrade_requests FOR SELECT
USING (requested_by = auth.uid());

CREATE POLICY "Members can create upgrade requests"
ON public.billing_upgrade_requests FOR INSERT
WITH CHECK (
  is_workspace_member(auth.uid(), workspace_id)
  AND requested_by = auth.uid()
);

CREATE TRIGGER update_billing_upgrade_requests_updated_at
BEFORE UPDATE ON public.billing_upgrade_requests
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
