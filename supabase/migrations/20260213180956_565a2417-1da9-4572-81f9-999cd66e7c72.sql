-- 2. Availability Rules
DROP POLICY IF EXISTS "anon_read_public_availability" ON public.booking_availability_rules;
CREATE POLICY "anon_read_public_availability" ON public.booking_availability_rules
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.booking_settings bs
    WHERE bs.workspace_id = booking_availability_rules.workspace_id
    AND bs.is_live = true
    AND bs.tenant_slug IS NOT NULL
  )
);

-- 3. Blackout Dates
DROP POLICY IF EXISTS "anon_read_public_blackouts" ON public.booking_blackout_dates;
CREATE POLICY "anon_read_public_blackouts" ON public.booking_blackout_dates
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.booking_settings bs
    WHERE bs.workspace_id = booking_blackout_dates.workspace_id
    AND bs.is_live = true
    AND bs.tenant_slug IS NOT NULL
  )
);
