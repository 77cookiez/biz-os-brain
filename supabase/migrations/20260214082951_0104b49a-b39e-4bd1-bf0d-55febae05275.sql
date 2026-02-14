
-- Drop the old 2-param overload
DROP FUNCTION IF EXISTS public.accept_quote_atomic(uuid, uuid);

-- Now REVOKE from PUBLIC on all functions (including anon which inherits from PUBLIC)
REVOKE ALL ON FUNCTION public.check_booking_limit(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.check_quotes_limit(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.check_vendor_limit(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.check_services_limit(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.check_seat_limit(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.can_use_feature(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_workspace_usage(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.can_manage_billing(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.request_upgrade(uuid, text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.decide_upgrade(uuid, text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.accept_quote_atomic(uuid) FROM PUBLIC, anon;

-- Grant ONLY to authenticated
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
