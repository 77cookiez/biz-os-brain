-- Make company-assets bucket public so all team members can see company logos
UPDATE storage.buckets SET public = true WHERE id = 'company-assets';