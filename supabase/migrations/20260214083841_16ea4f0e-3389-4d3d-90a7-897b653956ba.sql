
-- Phase 6 hardening: table-level permissions on billing_usage_events
-- Double-lock: even if RLS blocks, revoke DML from roles entirely
REVOKE INSERT, UPDATE, DELETE ON public.billing_usage_events FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.billing_usage_events FROM anon;
REVOKE ALL ON public.billing_usage_events FROM anon;
-- Keep SELECT for authenticated (RLS handles workspace scoping)
GRANT SELECT ON public.billing_usage_events TO authenticated;
