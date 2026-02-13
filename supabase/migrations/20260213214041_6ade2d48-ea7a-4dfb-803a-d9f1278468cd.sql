-- Add cover_url column to booking_services
ALTER TABLE public.booking_services ADD COLUMN IF NOT EXISTS cover_url TEXT DEFAULT NULL;