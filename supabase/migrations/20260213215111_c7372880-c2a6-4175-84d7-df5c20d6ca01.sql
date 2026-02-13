
-- 1. Unique constraint on booking_bookings.quote_id for idempotency
ALTER TABLE public.booking_bookings
  ADD CONSTRAINT booking_bookings_quote_id_unique UNIQUE (quote_id);

-- 2. Storage policies for booking-assets bucket (strict prefix enforcement)

-- Allow public read (bucket is already public, but ensure policy exists)
CREATE POLICY "public_read_booking_assets"
ON storage.objects FOR SELECT
USING (bucket_id = 'booking-assets');

-- Insert: only approved vendors can upload to their own workspace/vendor path
CREATE POLICY "approved_vendor_upload_booking_assets"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'booking-assets'
  AND (
    -- Vendor logo/cover: path must start with {workspace_id}/vendor/{vendor_id}/
    EXISTS (
      SELECT 1 FROM public.booking_vendors bv
      WHERE bv.owner_user_id = auth.uid()
        AND bv.status = 'approved'
        AND name LIKE bv.workspace_id::text || '/vendor/' || bv.id::text || '/%'
    )
    OR
    -- Service cover: path must start with {workspace_id}/service/ and service belongs to vendor
    EXISTS (
      SELECT 1 FROM public.booking_services bs
      JOIN public.booking_vendors bv ON bv.id = bs.vendor_id
      WHERE bv.owner_user_id = auth.uid()
        AND bv.status = 'approved'
        AND name LIKE bv.workspace_id::text || '/service/' || bs.id::text || '/%'
    )
    OR
    -- Workspace admin can upload tenant-level assets
    EXISTS (
      SELECT 1 FROM public.workspaces w
      WHERE name LIKE w.id::text || '/%'
        AND (
          public.has_company_role(auth.uid(), w.company_id, 'owner')
          OR public.has_company_role(auth.uid(), w.company_id, 'admin')
        )
    )
  )
);

-- Update: same rules as insert
CREATE POLICY "approved_vendor_update_booking_assets"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'booking-assets'
  AND (
    EXISTS (
      SELECT 1 FROM public.booking_vendors bv
      WHERE bv.owner_user_id = auth.uid()
        AND bv.status = 'approved'
        AND name LIKE bv.workspace_id::text || '/vendor/' || bv.id::text || '/%'
    )
    OR
    EXISTS (
      SELECT 1 FROM public.booking_services bs
      JOIN public.booking_vendors bv ON bv.id = bs.vendor_id
      WHERE bv.owner_user_id = auth.uid()
        AND bv.status = 'approved'
        AND name LIKE bv.workspace_id::text || '/service/' || bs.id::text || '/%'
    )
    OR
    EXISTS (
      SELECT 1 FROM public.workspaces w
      WHERE name LIKE w.id::text || '/%'
        AND (
          public.has_company_role(auth.uid(), w.company_id, 'owner')
          OR public.has_company_role(auth.uid(), w.company_id, 'admin')
        )
    )
  )
);

-- Delete: same rules
CREATE POLICY "approved_vendor_delete_booking_assets"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'booking-assets'
  AND (
    EXISTS (
      SELECT 1 FROM public.booking_vendors bv
      WHERE bv.owner_user_id = auth.uid()
        AND bv.status = 'approved'
        AND name LIKE bv.workspace_id::text || '/vendor/' || bv.id::text || '/%'
    )
    OR
    EXISTS (
      SELECT 1 FROM public.booking_services bs
      JOIN public.booking_vendors bv ON bv.id = bs.vendor_id
      WHERE bv.owner_user_id = auth.uid()
        AND bv.status = 'approved'
        AND name LIKE bv.workspace_id::text || '/service/' || bs.id::text || '/%'
    )
    OR
    EXISTS (
      SELECT 1 FROM public.workspaces w
      WHERE name LIKE w.id::text || '/%'
        AND (
          public.has_company_role(auth.uid(), w.company_id, 'owner')
          OR public.has_company_role(auth.uid(), w.company_id, 'admin')
        )
    )
  )
);
