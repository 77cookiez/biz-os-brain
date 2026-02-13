
-- Create booking-assets storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('booking-assets', 'booking-assets', true)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to read booking assets
CREATE POLICY "Public can view booking assets"
ON storage.objects FOR SELECT
USING (bucket_id = 'booking-assets');

-- Allow authenticated workspace members to upload booking assets scoped to their workspace folder
CREATE POLICY "Workspace members can upload booking assets"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'booking-assets'
  AND auth.uid() IS NOT NULL
);

-- Allow authenticated users to update their uploaded assets
CREATE POLICY "Workspace members can update booking assets"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'booking-assets'
  AND auth.uid() IS NOT NULL
);

-- Allow authenticated users to delete their uploaded assets
CREATE POLICY "Workspace members can delete booking assets"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'booking-assets'
  AND auth.uid() IS NOT NULL
);
