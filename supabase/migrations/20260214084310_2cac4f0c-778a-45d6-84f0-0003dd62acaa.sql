
-- ============================================================
-- Security Audit Fix: Revoke EXECUTE from anon on SECURITY DEFINER functions
-- that should NOT be callable by anonymous users.
--
-- EXCEPTIONS (intentionally kept anon-accessible):
--   - get_live_booking_tenant_by_slug: public booking page resolution
--   - is_workspace_member, is_workspace_admin, is_company_member,
--     has_company_role, is_booking_vendor_owner, is_chat_thread_member,
--     is_booking_subscription_active, get_workspace_company, get_thread_workspace:
--     RLS helper functions used in policy evaluation (read-only, require valid user_id)
--
-- REVOKED (anon should never call these directly):
-- ============================================================

-- 🔴 CRITICAL: cleanup functions — anon could delete/archive data
REVOKE ALL ON FUNCTION public.cleanup_old_org_events() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cleanup_old_org_events() TO authenticated;

REVOKE ALL ON FUNCTION public.cleanup_stale_memory() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cleanup_stale_memory() TO authenticated;

-- 🔴 CRITICAL: booking_notify — anon could create fake notifications
REVOKE ALL ON FUNCTION public.booking_notify(uuid, uuid, text, text, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.booking_notify(uuid, uuid, text, text, jsonb) TO authenticated;

-- 🟡 can_manage_booking — information disclosure
REVOKE ALL ON FUNCTION public.can_manage_booking(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_manage_booking(uuid, uuid) TO authenticated;

-- 🟡 Trigger functions — no reason for direct execution by any role
-- (triggers invoke them internally as owner, not via EXECUTE privilege)
REVOKE ALL ON FUNCTION public.trg_booking_notify_new_request() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.trg_booking_notify_quote_accepted() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.trg_booking_notify_quote_sent() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.trg_enforce_vendor_limit() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.trg_enforce_booking_limit() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.trg_enforce_services_limit() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.trg_enforce_quotes_limit() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.trg_validate_booking_status_transition() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.trg_validate_qr_status_transition() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.set_company_created_by() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon;
