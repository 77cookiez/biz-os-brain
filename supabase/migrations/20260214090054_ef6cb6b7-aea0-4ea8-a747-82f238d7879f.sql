
CREATE OR REPLACE FUNCTION public.get_workspace_growth_insights(_workspace_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _month_start timestamptz;
  _next_month_start timestamptz;
  _days_in_month int;
  _day_of_month int;
  _days_remaining int;
  _vendors_count int;
  _services_count int;
  _bookings_count int;
  _quotes_count int;
  _seats_count int;
  _plan_vendors_limit int;
  _plan_services_limit int;
  _plan_bookings_limit int;
  _plan_quotes_limit int;
  _plan_seats_limit int;
  _usage jsonb;
  _limits jsonb;
  _util jsonb;
  _reasons jsonb := '[]'::jsonb;
  _hits int;
  _daily_avg_bookings numeric;
  _daily_avg_quotes numeric;
  _proj_bookings int;
  _proj_quotes int;
  _recommended text := 'none';
  _confidence int := 20;
  _total_activity int;
BEGIN
  IF NOT is_workspace_member(auth.uid(), _workspace_id) THEN
    RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE = '42501';
  END IF;

  _month_start := (date_trunc('month', now() AT TIME ZONE 'utc') AT TIME ZONE 'utc');
  _next_month_start := (_month_start + interval '1 month');
  _days_in_month := EXTRACT(day FROM (_next_month_start - interval '1 day'))::int;
  _day_of_month := EXTRACT(day FROM (now() AT TIME ZONE 'utc'))::int;
  _days_remaining := GREATEST(_days_in_month - _day_of_month, 0);

  SELECT count(*) INTO _vendors_count FROM booking_vendors WHERE workspace_id = _workspace_id AND status != 'suspended';
  SELECT count(*) INTO _services_count FROM booking_services WHERE workspace_id = _workspace_id AND is_active = true;
  SELECT count(*) INTO _bookings_count FROM booking_bookings WHERE workspace_id = _workspace_id AND created_at >= _month_start;
  SELECT count(*) INTO _quotes_count FROM booking_quotes WHERE workspace_id = _workspace_id AND created_at >= _month_start;
  SELECT count(*) INTO _seats_count FROM workspace_members WHERE workspace_id = _workspace_id;

  SELECT bp.vendors_limit, bp.services_limit, bp.bookings_limit, bp.quotes_limit, bp.seats_limit
  INTO _plan_vendors_limit, _plan_services_limit, _plan_bookings_limit, _plan_quotes_limit, _plan_seats_limit
  FROM billing_subscriptions bs
  JOIN billing_plans bp ON bp.id = bs.plan_id
  WHERE bs.workspace_id = _workspace_id AND bs.status IN ('active','trial')
  LIMIT 1;

  IF _plan_vendors_limit IS NULL AND _plan_services_limit IS NULL AND _plan_bookings_limit IS NULL THEN
    SELECT bp.vendors_limit, bp.services_limit, bp.bookings_limit, bp.quotes_limit, bp.seats_limit
    INTO _plan_vendors_limit, _plan_services_limit, _plan_bookings_limit, _plan_quotes_limit, _plan_seats_limit
    FROM billing_plans bp WHERE bp.id = 'free';
  END IF;

  _usage := jsonb_build_object(
    'vendors_count', _vendors_count,
    'services_count', _services_count,
    'bookings_this_month', _bookings_count,
    'quotes_this_month', _quotes_count,
    'seats_count', _seats_count
  );

  _limits := jsonb_build_object(
    'vendors_limit', _plan_vendors_limit,
    'services_limit', _plan_services_limit,
    'bookings_limit', _plan_bookings_limit,
    'quotes_limit', _plan_quotes_limit,
    'seats_limit', _plan_seats_limit
  );

  _util := jsonb_build_object(
    'vendors', CASE WHEN _plan_vendors_limit IS NOT NULL AND _plan_vendors_limit > 0
      THEN LEAST(ROUND((_vendors_count::numeric / _plan_vendors_limit) * 100), 100) ELSE 0 END,
    'services', CASE WHEN _plan_services_limit IS NOT NULL AND _plan_services_limit > 0
      THEN LEAST(ROUND((_services_count::numeric / _plan_services_limit) * 100), 100) ELSE 0 END,
    'bookings', CASE WHEN _plan_bookings_limit IS NOT NULL AND _plan_bookings_limit > 0
      THEN LEAST(ROUND((_bookings_count::numeric / _plan_bookings_limit) * 100), 100) ELSE 0 END,
    'quotes', CASE WHEN _plan_quotes_limit IS NOT NULL AND _plan_quotes_limit > 0
      THEN LEAST(ROUND((_quotes_count::numeric / _plan_quotes_limit) * 100), 100) ELSE 0 END,
    'seats', CASE WHEN _plan_seats_limit IS NOT NULL AND _plan_seats_limit > 0
      THEN LEAST(ROUND((_seats_count::numeric / _plan_seats_limit) * 100), 100) ELSE 0 END
  );

  SELECT count(*) INTO _hits
  FROM billing_usage_events
  WHERE workspace_id = _workspace_id
    AND event_type = 'LIMIT_HIT'
    AND created_at >= now() - interval '30 days';

  IF _day_of_month > 0 THEN
    _daily_avg_bookings := _bookings_count::numeric / _day_of_month;
    _daily_avg_quotes := _quotes_count::numeric / _day_of_month;
  ELSE
    _daily_avg_bookings := 0;
    _daily_avg_quotes := 0;
  END IF;
  _proj_bookings := _bookings_count + CEIL(_daily_avg_bookings * _days_remaining);
  _proj_quotes := _quotes_count + CEIL(_daily_avg_quotes * _days_remaining);

  IF _hits > 2 THEN
    _recommended := 'upgrade';
    _confidence := LEAST(70 + (_hits * 5), 95);
    _reasons := _reasons || jsonb_build_array(
      jsonb_build_object('code','FREQUENT_LIMIT_HITS','count',_hits)
    );
  END IF;

  IF _recommended != 'upgrade' THEN
    IF (_plan_bookings_limit IS NOT NULL AND _proj_bookings >= _plan_bookings_limit)
       OR (_plan_quotes_limit IS NOT NULL AND _proj_quotes >= _plan_quotes_limit) THEN
      _recommended := 'upgrade';
      _confidence := 80;
      _reasons := _reasons || jsonb_build_array(
        jsonb_build_object('code','PROJECTED_BREACH')
      );
    END IF;
  END IF;

  IF _recommended = 'none' THEN
    IF (_plan_vendors_limit IS NOT NULL AND (_util->>'vendors')::int >= 80)
       OR (_plan_services_limit IS NOT NULL AND (_util->>'services')::int >= 80)
       OR (_plan_bookings_limit IS NOT NULL AND (_util->>'bookings')::int >= 80)
       OR (_plan_quotes_limit IS NOT NULL AND (_util->>'quotes')::int >= 80)
       OR (_plan_seats_limit IS NOT NULL AND (_util->>'seats')::int >= 80)
    THEN
      _recommended := 'optimize';
      _confidence := 55;
      _reasons := _reasons || jsonb_build_array(
        jsonb_build_object('code','HIGH_UTILIZATION')
      );
    END IF;
  END IF;

  _total_activity := _bookings_count + _quotes_count + _hits;
  IF _recommended = 'none' THEN
    _confidence := CASE WHEN _total_activity < 3 THEN 60 ELSE 90 END;
  END IF;

  RETURN jsonb_build_object(
    'usage', _usage,
    'limits', _limits,
    'utilization_percent', _util,
    'limit_hits_last_30_days', _hits,
    'projected_end_of_month_usage', jsonb_build_object('bookings', _proj_bookings, 'quotes', _proj_quotes),
    'recommended_action', _recommended,
    'confidence_score', _confidence,
    'reasons', _reasons
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_workspace_growth_insights(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_workspace_growth_insights(uuid) TO authenticated;
