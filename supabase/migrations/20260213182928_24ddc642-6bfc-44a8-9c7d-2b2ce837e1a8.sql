
-- Add app-related columns to booking_settings
ALTER TABLE public.booking_settings
  ADD COLUMN IF NOT EXISTS app_name text,
  ADD COLUMN IF NOT EXISTS app_icon_url text,
  ADD COLUMN IF NOT EXISTS app_splash_url text,
  ADD COLUMN IF NOT EXISTS app_description text,
  ADD COLUMN IF NOT EXISTS app_bundle_id text;
