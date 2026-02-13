
-- 1) Performance index for dedupe lookups
CREATE INDEX IF NOT EXISTS idx_notifications_type_entity
ON public.notifications (type, (data_json->>'entity_id'));

-- 2) Add index for common query pattern (user + workspace + unread)
CREATE INDEX IF NOT EXISTS idx_notifications_user_workspace
ON public.notifications (user_id, workspace_id, created_at DESC);

-- 3) Ensure SECURITY DEFINER insert works: add permissive INSERT policy for service role
-- (FORCE RLS blocks even table owners; this policy allows the SECURITY DEFINER functions to insert)
DO $$
BEGIN
  -- Drop existing restrictive insert policy if it blocks SECURITY DEFINER
  IF EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'notifications' AND policyname = 'booking_system_insert_notifications'
  ) THEN
    DROP POLICY "booking_system_insert_notifications" ON public.notifications;
  END IF;
END $$;

CREATE POLICY "booking_system_insert_notifications"
ON public.notifications
FOR INSERT
TO PUBLIC
WITH CHECK (true);
