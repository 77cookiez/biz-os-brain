-- Make company-assets bucket private
UPDATE storage.buckets SET public = false WHERE id = 'company-assets';