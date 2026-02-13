
-- Allow vendor owners to upload to booking-assets under their workspace path
CREATE POLICY "booking_assets_vendor_insert"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'booking-assets'
  AND auth.uid() IS NOT NULL
  AND (
    is_workspace_admin(auth.uid(), workspace_id_from_path(name))
    OR EXISTS (
      SELECT 1 FROM public.booking_vendors bv
      WHERE bv.owner_user_id = auth.uid()
        AND bv.status = 'approved'
        AND bv.workspace_id = workspace_id_from_path(name)
    )
  )
);

-- Allow vendor owners to update their uploads
CREATE POLICY "booking_assets_vendor_update"
ON storage.objects
FOR UPDATE
USING (
  bucket_id = 'booking-assets'
  AND auth.uid() IS NOT NULL
  AND (
    is_workspace_admin(auth.uid(), workspace_id_from_path(name))
    OR EXISTS (
      SELECT 1 FROM public.booking_vendors bv
      WHERE bv.owner_user_id = auth.uid()
        AND bv.status = 'approved'
        AND bv.workspace_id = workspace_id_from_path(name)
    )
  )
);
