
-- Add content_locale column to profiles (nullable, BCP-47 tag or free text)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS content_locale text DEFAULT NULL;

-- Comment for documentation
COMMENT ON COLUMN public.profiles.content_locale IS 'ULL content projection language (BCP-47). Falls back to preferred_locale, then workspace default_locale, then en.';
