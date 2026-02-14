
-- Feature guard: check if workspace can use a specific feature
CREATE OR REPLACE FUNCTION public.can_use_feature(_workspace_id uuid, _feature text)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT COALESCE(
    (
      SELECT (bp.features ->> _feature)::boolean
      FROM billing_subscriptions bs
      JOIN billing_plans bp ON bp.id = bs.plan_id
      WHERE bs.workspace_id = _workspace_id
        AND bs.status IN ('active', 'trial')
      LIMIT 1
    ),
    -- If no subscription, check free plan
    (
      SELECT (bp.features ->> _feature)::boolean
      FROM billing_plans bp
      WHERE bp.id = 'free'
    ),
    false
  );
$$;

-- Check vendor limit for workspace
CREATE OR REPLACE FUNCTION public.check_vendor_limit(_workspace_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT COALESCE(
    (
      SELECT bp.vendors_limit IS NULL OR (
        SELECT count(*) FROM booking_vendors bv
        WHERE bv.workspace_id = _workspace_id AND bv.status != 'suspended'
      ) < bp.vendors_limit
      FROM billing_subscriptions bs
      JOIN billing_plans bp ON bp.id = bs.plan_id
      WHERE bs.workspace_id = _workspace_id
        AND bs.status IN ('active', 'trial')
      LIMIT 1
    ),
    -- No subscription = free plan limits
    (
      SELECT bp.vendors_limit IS NULL OR (
        SELECT count(*) FROM booking_vendors bv
        WHERE bv.workspace_id = _workspace_id AND bv.status != 'suspended'
      ) < bp.vendors_limit
      FROM billing_plans bp WHERE bp.id = 'free'
    ),
    false
  );
$$;

-- Check monthly booking limit for workspace
CREATE OR REPLACE FUNCTION public.check_booking_limit(_workspace_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT COALESCE(
    (
      SELECT bp.bookings_limit IS NULL OR (
        SELECT count(*) FROM booking_bookings bb
        WHERE bb.workspace_id = _workspace_id
          AND bb.created_at >= date_trunc('month', now())
      ) < bp.bookings_limit
      FROM billing_subscriptions bs
      JOIN billing_plans bp ON bp.id = bs.plan_id
      WHERE bs.workspace_id = _workspace_id
        AND bs.status IN ('active', 'trial')
      LIMIT 1
    ),
    (
      SELECT bp.bookings_limit IS NULL OR (
        SELECT count(*) FROM booking_bookings bb
        WHERE bb.workspace_id = _workspace_id
          AND bb.created_at >= date_trunc('month', now())
      ) < bp.bookings_limit
      FROM billing_plans bp WHERE bp.id = 'free'
    ),
    false
  );
$$;

-- Get workspace usage stats
CREATE OR REPLACE FUNCTION public.get_workspace_usage(_workspace_id uuid)
RETURNS json
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT json_build_object(
    'vendors_count', (SELECT count(*) FROM booking_vendors WHERE workspace_id = _workspace_id AND status != 'suspended'),
    'bookings_this_month', (SELECT count(*) FROM booking_bookings WHERE workspace_id = _workspace_id AND created_at >= date_trunc('month', now())),
    'services_count', (SELECT count(*) FROM booking_services WHERE workspace_id = _workspace_id AND is_active = true),
    'quotes_this_month', (SELECT count(*) FROM booking_quotes WHERE workspace_id = _workspace_id AND created_at >= date_trunc('month', now()))
  );
$$;
