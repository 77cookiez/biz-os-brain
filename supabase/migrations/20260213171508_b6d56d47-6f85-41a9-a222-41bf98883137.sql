
-- =============================================
-- Phase 4: Anonymous RLS Policies for Public Booking Pages
-- Allows unauthenticated visitors to browse live marketplaces
-- =============================================

-- 1. booking_settings: anon can see live tenants
CREATE POLICY "anon_browse_booking_settings"
ON public.booking_settings
FOR SELECT
TO anon, authenticated
USING (is_live = true AND tenant_slug IS NOT NULL);

-- 2. booking_vendors: anon can see approved vendors in live workspaces
CREATE POLICY "anon_browse_vendors"
ON public.booking_vendors
FOR SELECT
TO anon, authenticated
USING (
  status = 'approved'
  AND EXISTS (
    SELECT 1 FROM public.booking_settings bs
    WHERE bs.workspace_id = booking_vendors.workspace_id
      AND bs.is_live = true
      AND bs.tenant_slug IS NOT NULL
  )
);

-- 3. booking_vendor_profiles: anon can see profiles of approved vendors
CREATE POLICY "anon_browse_vendor_profiles"
ON public.booking_vendor_profiles
FOR SELECT
TO anon, authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.booking_vendors bv
    WHERE bv.id = booking_vendor_profiles.vendor_id
      AND bv.status = 'approved'
      AND EXISTS (
        SELECT 1 FROM public.booking_settings bs
        WHERE bs.workspace_id = bv.workspace_id
          AND bs.is_live = true
          AND bs.tenant_slug IS NOT NULL
      )
  )
);

-- 4. booking_services: anon can see active services from approved vendors
CREATE POLICY "anon_browse_services"
ON public.booking_services
FOR SELECT
TO anon, authenticated
USING (
  is_active = true
  AND EXISTS (
    SELECT 1 FROM public.booking_vendors bv
    WHERE bv.id = booking_services.vendor_id
      AND bv.status = 'approved'
      AND EXISTS (
        SELECT 1 FROM public.booking_settings bs
        WHERE bs.workspace_id = bv.workspace_id
          AND bs.is_live = true
          AND bs.tenant_slug IS NOT NULL
      )
  )
);

-- 5. meaning_objects: anon can read meanings linked to live booking workspaces
CREATE POLICY "anon_read_public_meanings"
ON public.meaning_objects
FOR SELECT
TO anon, authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.booking_settings bs
    WHERE bs.workspace_id = meaning_objects.workspace_id
      AND bs.is_live = true
      AND bs.tenant_slug IS NOT NULL
  )
);

-- 6. content_translations: anon can read translations for public meanings
CREATE POLICY "anon_read_public_translations"
ON public.content_translations
FOR SELECT
TO anon, authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.meaning_objects mo
    JOIN public.booking_settings bs ON bs.workspace_id = mo.workspace_id
    WHERE mo.id = content_translations.meaning_object_id
      AND bs.is_live = true
      AND bs.tenant_slug IS NOT NULL
  )
);

-- 7. workspaces: anon can see id+name of workspaces with live booking
CREATE POLICY "anon_browse_workspace_name"
ON public.workspaces
FOR SELECT
TO anon, authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.booking_settings bs
    WHERE bs.workspace_id = workspaces.id
      AND bs.is_live = true
      AND bs.tenant_slug IS NOT NULL
  )
);
