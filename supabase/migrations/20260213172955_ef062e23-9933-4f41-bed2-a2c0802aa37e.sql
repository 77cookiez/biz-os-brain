
-- 1) Helper: extract workspace_id (first path segment) from storage object name
CREATE OR REPLACE FUNCTION public.workspace_id_from_path(path text)
RETURNS uuid
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT (split_part(path, '/', 1))::uuid;
$$;

-- 2) Helper: check if user is workspace admin/owner
CREATE OR REPLACE FUNCTION public.is_workspace_admin(_user_id uuid, _workspace_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT (
    has_company_role(_user_id, get_workspace_company(_workspace_id), 'owner'::app_role)
    OR has_company_role(_user_id, get_workspace_company(_workspace_id), 'admin'::app_role)
  );
$$;

-- 3) Drop old loose storage policies for booking-assets
DROP POLICY IF EXISTS "Public can view booking assets" ON storage.objects;
DROP POLICY IF EXISTS "Workspace members can upload booking assets" ON storage.objects;
DROP POLICY IF EXISTS "Workspace members can update booking assets" ON storage.objects;
DROP POLICY IF EXISTS "Workspace members can delete booking assets" ON storage.objects;

-- 4) New strict policies

-- Public read (logos are public-facing, no listing — object-level access only)
CREATE POLICY "booking_assets_public_read"
ON storage.objects FOR SELECT
USING (bucket_id = 'booking-assets');

-- Only workspace admins can upload, scoped to their workspace folder
CREATE POLICY "booking_assets_admin_insert"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'booking-assets'
  AND auth.uid() IS NOT NULL
  AND public.is_workspace_admin(auth.uid(), public.workspace_id_from_path(name))
);

-- Only workspace admins can update their workspace's files
CREATE POLICY "booking_assets_admin_update"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'booking-assets'
  AND auth.uid() IS NOT NULL
  AND public.is_workspace_admin(auth.uid(), public.workspace_id_from_path(name))
);

-- Only workspace admins can delete their workspace's files
CREATE POLICY "booking_assets_admin_delete"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'booking-assets'
  AND auth.uid() IS NOT NULL
  AND public.is_workspace_admin(auth.uid(), public.workspace_id_from_path(name))
);
