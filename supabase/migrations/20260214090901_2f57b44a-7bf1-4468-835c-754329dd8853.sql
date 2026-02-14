
-- Phase 8A: log_growth_event RPC for funnel analytics
CREATE OR REPLACE FUNCTION public.log_growth_event(
  _workspace_id uuid,
  _event_type text,
  _meta jsonb DEFAULT '{}'::jsonb
)
RETURNS void
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

REVOKE ALL ON FUNCTION public.log_growth_event(uuid, text, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.log_growth_event(uuid, text, jsonb) TO authenticated;
