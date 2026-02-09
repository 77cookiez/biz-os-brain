-- 1. Add logo_url to companies
ALTER TABLE public.companies 
ADD COLUMN IF NOT EXISTS logo_url TEXT;

-- 2. Create storage bucket for avatars
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

-- 3. Create storage bucket for company assets
INSERT INTO storage.buckets (id, name, public)
VALUES ('company-assets', 'company-assets', true)
ON CONFLICT (id) DO NOTHING;

-- 4. RLS for avatars bucket - Users can upload own avatar
CREATE POLICY "Users can upload own avatar"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'avatars' AND 
  (storage.foldername(name))[1] = auth.uid()::text
);

-- 5. RLS for avatars bucket - Users can update own avatar
CREATE POLICY "Users can update own avatar"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'avatars' AND 
  (storage.foldername(name))[1] = auth.uid()::text
);

-- 6. RLS for avatars bucket - Users can delete own avatar
CREATE POLICY "Users can delete own avatar"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'avatars' AND 
  (storage.foldername(name))[1] = auth.uid()::text
);

-- 7. RLS for avatars bucket - Anyone can view avatars
CREATE POLICY "Anyone can view avatars"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'avatars');

-- 8. RLS for company-assets bucket - Company owners can upload logo
CREATE POLICY "Company owners can upload logo"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'company-assets' AND 
  public.has_company_role(
    auth.uid(), 
    (storage.foldername(name))[1]::uuid, 
    'owner'
  )
);

-- 9. RLS for company-assets bucket - Company owners can update logo
CREATE POLICY "Company owners can update logo"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'company-assets' AND 
  public.has_company_role(
    auth.uid(), 
    (storage.foldername(name))[1]::uuid, 
    'owner'
  )
);

-- 10. RLS for company-assets bucket - Company owners can delete logo
CREATE POLICY "Company owners can delete logo"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'company-assets' AND 
  public.has_company_role(
    auth.uid(), 
    (storage.foldername(name))[1]::uuid, 
    'owner'
  )
);

-- 11. RLS for company-assets bucket - Anyone can view company assets
CREATE POLICY "Anyone can view company assets"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'company-assets');