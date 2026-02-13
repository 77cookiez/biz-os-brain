
ALTER TABLE public.booking_settings
  ADD COLUMN IF NOT EXISTS app_keywords text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS app_support_email text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS app_privacy_url text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS app_version text DEFAULT '1.0.0',
  ADD COLUMN IF NOT EXISTS app_build_number integer DEFAULT 1,
  ADD COLUMN IF NOT EXISTS publishing_progress jsonb DEFAULT '{}'::jsonb;
