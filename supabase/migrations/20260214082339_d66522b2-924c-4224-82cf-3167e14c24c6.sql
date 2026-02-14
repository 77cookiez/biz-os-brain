
-- ============================================================
-- 1) UTC month boundary: proper timestamptz cast
-- ============================================================

-- check_booking_limit
CREATE OR REPLACE FUNCTION public.check_booking_limit(_workspace_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE _limit int; _count int;
BEGIN
  IF NOT is_workspace_member(auth.uid(), _workspace_id) THEN
    RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE = '42501';
  END IF;
  SELECT bp.bookings_limit INTO _limit
  FROM billing_subscriptions bs JOIN billing_plans bp ON bp.id = bs.plan_id
  WHERE bs.workspace_id = _workspace_id AND bs.status IN ('active','trial') LIMIT 1;
  IF _limit IS NULL THEN
    SELECT bp.bookings_limit INTO _limit FROM billing_plans bp WHERE bp.id = 'free';
  END IF;
  IF _limit IS NULL THEN RETURN true; END IF;
  SELECT count(*) INTO _count FROM booking_bookings
  WHERE workspace_id = _workspace_id
    AND created_at >= (date_trunc('month', now() AT TIME ZONE 'utc') AT TIME ZONE 'utc');
  RETURN _count < _limit;
END;
$function$;

-- check_quotes_limit
CREATE OR REPLACE FUNCTION public.check_quotes_limit(_workspace_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE _limit int; _count int;
BEGIN
  IF NOT is_workspace_member(auth.uid(), _workspace_id) THEN
    RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE = '42501';
  END IF;
  SELECT bp.quotes_limit INTO _limit
  FROM billing_subscriptions bs JOIN billing_plans bp ON bp.id = bs.plan_id
  WHERE bs.workspace_id = _workspace_id AND bs.status IN ('active','trial') LIMIT 1;
  IF _limit IS NULL THEN
    SELECT bp.quotes_limit INTO _limit FROM billing_plans bp WHERE bp.id = 'free';
  END IF;
  IF _limit IS NULL THEN RETURN true; END IF;
  SELECT count(*) INTO _count FROM booking_quotes
  WHERE workspace_id = _workspace_id
    AND created_at >= (date_trunc('month', now() AT TIME ZONE 'utc') AT TIME ZONE 'utc');
  RETURN _count < _limit;
END;
$function$;

-- get_workspace_usage
CREATE OR REPLACE FUNCTION public.get_workspace_usage(_workspace_id uuid)
 RETURNS json
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT is_workspace_member(auth.uid(), _workspace_id) THEN
    RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE = '42501';
  END IF;
  RETURN json_build_object(
    'vendors_count', (SELECT count(*) FROM booking_vendors WHERE workspace_id = _workspace_id AND status != 'suspended'),
    'bookings_this_month', (SELECT count(*) FROM booking_bookings WHERE workspace_id = _workspace_id AND created_at >= (date_trunc('month', now() AT TIME ZONE 'utc') AT TIME ZONE 'utc')),
    'services_count', (SELECT count(*) FROM booking_services WHERE workspace_id = _workspace_id AND is_active = true),
    'quotes_this_month', (SELECT count(*) FROM booking_quotes WHERE workspace_id = _workspace_id AND created_at >= (date_trunc('month', now() AT TIME ZONE 'utc') AT TIME ZONE 'utc'))
  );
END;
$function$;

-- can_use_feature
CREATE OR REPLACE FUNCTION public.can_use_feature(_workspace_id uuid, _feature text)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT is_workspace_member(auth.uid(), _workspace_id) THEN
    RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE = '42501';
  END IF;
  RETURN COALESCE(
    (SELECT (bp.features ->> _feature)::boolean
     FROM billing_subscriptions bs JOIN billing_plans bp ON bp.id = bs.plan_id
     WHERE bs.workspace_id = _workspace_id AND bs.status IN ('active','trial') LIMIT 1),
    (SELECT (bp.features ->> _feature)::boolean FROM billing_plans bp WHERE bp.id = 'free'),
    false
  );
END;
$function$;

-- check_vendor_limit
CREATE OR REPLACE FUNCTION public.check_vendor_limit(_workspace_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE _limit int; _count int;
BEGIN
  IF NOT is_workspace_member(auth.uid(), _workspace_id) THEN
    RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE = '42501';
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
$function$;

-- check_services_limit
CREATE OR REPLACE FUNCTION public.check_services_limit(_workspace_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE _limit int; _count int;
BEGIN
  IF NOT is_workspace_member(auth.uid(), _workspace_id) THEN
    RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE = '42501';
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
$function$;

-- check_seat_limit
CREATE OR REPLACE FUNCTION public.check_seat_limit(_workspace_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE _limit int; _count int;
BEGIN
  IF NOT is_workspace_member(auth.uid(), _workspace_id) THEN
    RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE = '42501';
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
$function$;

-- ============================================================
-- 2) Triggers: skip inactive/suspended inserts + UTC fix
-- ============================================================

CREATE OR REPLACE FUNCTION public.trg_enforce_vendor_limit()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
    SELECT count(*) INTO _count FROM booking_bookings
    WHERE workspace_id = NEW.workspace_id
      AND created_at >= (date_trunc('month', now() AT TIME ZONE 'utc') AT TIME ZONE 'utc');
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
    SELECT count(*) INTO _count FROM booking_quotes
    WHERE workspace_id = NEW.workspace_id
      AND created_at >= (date_trunc('month', now() AT TIME ZONE 'utc') AT TIME ZONE 'utc');
    IF _count >= _limit THEN
      RAISE EXCEPTION 'QUOTES_LIMIT_REACHED' USING ERRCODE = 'P0001';
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

-- ============================================================
-- 3) REVOKE PUBLIC + GRANT authenticated on all SECURITY DEFINER RPCs
-- ============================================================

REVOKE ALL ON FUNCTION public.check_booking_limit(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.check_quotes_limit(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.check_vendor_limit(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.check_services_limit(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.check_seat_limit(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.can_use_feature(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_workspace_usage(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.can_manage_billing(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.request_upgrade(uuid, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.decide_upgrade(uuid, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.accept_quote_atomic(uuid) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.check_booking_limit(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_quotes_limit(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_vendor_limit(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_services_limit(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_seat_limit(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_use_feature(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_workspace_usage(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_manage_billing(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.request_upgrade(uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.decide_upgrade(uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.accept_quote_atomic(uuid) TO authenticated;
