
-- =============================================
-- Phase 6: Observability — billing_usage_events
-- =============================================

-- 1) Create billing_usage_events table
CREATE TABLE public.billing_usage_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 2) Enable RLS — members can read, no direct client inserts
ALTER TABLE public.billing_usage_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can read usage events"
  ON public.billing_usage_events
  FOR SELECT
  TO authenticated
  USING (is_workspace_member(auth.uid(), workspace_id));

-- No INSERT/UPDATE/DELETE policies → only SECURITY DEFINER functions can write

-- 3) Create log_usage_event RPC
CREATE OR REPLACE FUNCTION public.log_usage_event(
  _workspace_id uuid,
  _event_type text,
  _meta jsonb DEFAULT '{}'::jsonb
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT is_workspace_member(auth.uid(), _workspace_id) THEN
    RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE = '42501';
  END IF;
  INSERT INTO billing_usage_events (workspace_id, event_type, meta)
  VALUES (_workspace_id, _event_type, _meta);
END;
$$;

-- Harden RPC permissions
REVOKE ALL ON FUNCTION public.log_usage_event(uuid, text, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.log_usage_event(uuid, text, jsonb) FROM anon;
GRANT EXECUTE ON FUNCTION public.log_usage_event(uuid, text, jsonb) TO authenticated;

-- 4) Update limit triggers to log events BEFORE raising exceptions

-- Vendor limit trigger
CREATE OR REPLACE FUNCTION public.trg_enforce_vendor_limit()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE _limit int; _count int;
BEGIN
  IF NEW.status = 'suspended' THEN RETURN NEW; END IF;
  SELECT bp.vendors_limit INTO _limit
  FROM billing_subscriptions bs JOIN billing_plans bp ON bp.id = bs.plan_id
  WHERE bs.workspace_id = NEW.workspace_id AND bs.status IN ('active','trial') LIMIT 1;
  IF _limit IS NULL THEN
    SELECT bp.vendors_limit INTO _limit FROM billing_plans bp WHERE bp.id = 'free';
  END IF;
  IF _limit IS NOT NULL THEN
    SELECT count(*) INTO _count FROM booking_vendors WHERE workspace_id = NEW.workspace_id AND status != 'suspended';
    IF _count >= _limit THEN
      INSERT INTO billing_usage_events (workspace_id, event_type, meta)
      VALUES (NEW.workspace_id, 'LIMIT_HIT', jsonb_build_object('resource', 'vendors', 'current', _count, 'limit', _limit));
      RAISE EXCEPTION 'VENDOR_LIMIT_REACHED' USING ERRCODE = 'P0001';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- Services limit trigger
CREATE OR REPLACE FUNCTION public.trg_enforce_services_limit()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE _limit int; _count int;
BEGIN
  IF NEW.is_active IS DISTINCT FROM true THEN RETURN NEW; END IF;
  SELECT bp.services_limit INTO _limit
  FROM billing_subscriptions bs JOIN billing_plans bp ON bp.id = bs.plan_id
  WHERE bs.workspace_id = NEW.workspace_id AND bs.status IN ('active','trial') LIMIT 1;
  IF _limit IS NULL THEN
    SELECT bp.services_limit INTO _limit FROM billing_plans bp WHERE bp.id = 'free';
  END IF;
  IF _limit IS NOT NULL THEN
    SELECT count(*) INTO _count FROM booking_services WHERE workspace_id = NEW.workspace_id AND is_active = true;
    IF _count >= _limit THEN
      INSERT INTO billing_usage_events (workspace_id, event_type, meta)
      VALUES (NEW.workspace_id, 'LIMIT_HIT', jsonb_build_object('resource', 'services', 'current', _count, 'limit', _limit));
      RAISE EXCEPTION 'SERVICES_LIMIT_REACHED' USING ERRCODE = 'P0001';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- Booking limit trigger
CREATE OR REPLACE FUNCTION public.trg_enforce_booking_limit()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
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
    SELECT count(*) INTO _count FROM booking_bookings
    WHERE workspace_id = NEW.workspace_id
      AND created_at >= (date_trunc('month', now() AT TIME ZONE 'utc') AT TIME ZONE 'utc');
    IF _count >= _limit THEN
      INSERT INTO billing_usage_events (workspace_id, event_type, meta)
      VALUES (NEW.workspace_id, 'LIMIT_HIT', jsonb_build_object('resource', 'bookings', 'current', _count, 'limit', _limit));
      RAISE EXCEPTION 'BOOKING_LIMIT_REACHED' USING ERRCODE = 'P0001';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- Quotes limit trigger
CREATE OR REPLACE FUNCTION public.trg_enforce_quotes_limit()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
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
    SELECT count(*) INTO _count FROM booking_quotes
    WHERE workspace_id = NEW.workspace_id
      AND created_at >= (date_trunc('month', now() AT TIME ZONE 'utc') AT TIME ZONE 'utc');
    IF _count >= _limit THEN
      INSERT INTO billing_usage_events (workspace_id, event_type, meta)
      VALUES (NEW.workspace_id, 'LIMIT_HIT', jsonb_build_object('resource', 'quotes', 'current', _count, 'limit', _limit));
      RAISE EXCEPTION 'QUOTES_LIMIT_REACHED' USING ERRCODE = 'P0001';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- 5) Index for fast workspace lookups
CREATE INDEX idx_billing_usage_events_workspace ON public.billing_usage_events (workspace_id, created_at DESC);
