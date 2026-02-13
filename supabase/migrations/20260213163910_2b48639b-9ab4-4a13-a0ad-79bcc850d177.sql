
-- Tighten the INSERT policy: only allow inserts where user_id matches auth.uid() OR via SECURITY DEFINER (no auth context)
DROP POLICY IF EXISTS "booking_system_insert_notifications" ON public.notifications;

CREATE POLICY "authenticated_or_system_insert_notifications"
ON public.notifications
FOR INSERT
WITH CHECK (
  -- Normal user inserting their own notification
  (auth.uid() = user_id)
  OR
  -- SECURITY DEFINER context (triggers) - auth.uid() is NULL
  (auth.uid() IS NULL)
);
