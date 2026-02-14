
-- Add payment_mode and offline_methods to booking_settings
ALTER TABLE public.booking_settings
  ADD COLUMN IF NOT EXISTS payment_mode text NOT NULL DEFAULT 'offline_only',
  ADD COLUMN IF NOT EXISTS offline_methods text[] NOT NULL DEFAULT ARRAY['cash', 'bank_transfer', 'card_on_delivery'];

-- Add payment_status to booking_bookings (separate from status)
ALTER TABLE public.booking_bookings
  ADD COLUMN IF NOT EXISTS payment_status text NOT NULL DEFAULT 'unpaid',
  ADD COLUMN IF NOT EXISTS offline_payment_method text;

-- Update the booking_status enum to include confirmed_pending_payment
ALTER TYPE public.booking_status ADD VALUE IF NOT EXISTS 'confirmed_pending_payment';
