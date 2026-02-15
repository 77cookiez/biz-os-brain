
-- Fix search_path on prevent_audit_mutation
CREATE OR REPLACE FUNCTION public.prevent_audit_mutation()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  RAISE EXCEPTION 'platform_audit_log is append-only; updates and deletes are forbidden'
    USING ERRCODE = '42501';
  RETURN NULL;
END;
$$;
