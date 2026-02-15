
-- Fix: Restrict booking-assets storage policies to workspace members only
-- The first folder segment is the workspace_id, validated via is_workspace_member()

DROP POLICY IF EXISTS "Workspace members can upload booking assets" ON storage.objects;
DROP POLICY IF EXISTS "Workspace members can update booking assets" ON storage.objects;
DROP POLICY IF EXISTS "Workspace members can delete booking assets" ON storage.objects;

-- INSERT: only workspace members can upload
CREATE POLICY "Workspace members can upload booking assets"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'booking-assets'
  AND auth.uid() IS NOT NULL
  AND public.is_workspace_member(auth.uid(), (storage.foldername(name))[1]::uuid)
);

-- UPDATE: only workspace members can update
CREATE POLICY "Workspace members can update booking assets"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'booking-assets'
  AND auth.uid() IS NOT NULL
  AND public.is_workspace_member(auth.uid(), (storage.foldername(name))[1]::uuid)
);

-- DELETE: only workspace members can delete
CREATE POLICY "Workspace members can delete booking assets"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'booking-assets'
  AND auth.uid() IS NOT NULL
  AND public.is_workspace_member(auth.uid(), (storage.foldername(name))[1]::uuid)
);
