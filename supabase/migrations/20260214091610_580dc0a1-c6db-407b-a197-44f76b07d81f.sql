
-- #2: Add allowlist validation to log_growth_event
CREATE OR REPLACE FUNCTION public.log_growth_event(_workspace_id uuid, _event_type text, _meta jsonb DEFAULT '{}'::jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT is_workspace_member(auth.uid(), _workspace_id) THEN
    RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE = '42501';
  END IF;

  IF _event_type NOT IN (
    'UPGRADE_FUNNEL_VIEW',
    'UPGRADE_CTA_CLICK',
    'UPGRADE_REQUEST_SUBMIT',
    'PLAN_RECOMMENDED',
    'PRICE_SUGGESTION_VIEW'
  ) THEN
    RAISE EXCEPTION 'Invalid event_type: %', _event_type USING ERRCODE = '22023';
  END IF;

  INSERT INTO billing_usage_events (workspace_id, event_type, meta)
  VALUES (_workspace_id, _event_type, _meta);
END;
$function$;

REVOKE ALL ON FUNCTION public.log_growth_event(uuid, text, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.log_growth_event(uuid, text, jsonb) FROM anon;
GRANT EXECUTE ON FUNCTION public.log_growth_event(uuid, text, jsonb) TO authenticated;
