
-- Add Stripe Connect fields to booking_settings (per-tenant)
ALTER TABLE public.booking_settings
  ADD COLUMN IF NOT EXISTS stripe_account_id text,
  ADD COLUMN IF NOT EXISTS stripe_onboarding_completed boolean NOT NULL DEFAULT false;

-- Add payment columns to booking_quotes
ALTER TABLE public.booking_quotes
  ADD COLUMN IF NOT EXISTS payment_required_type text DEFAULT 'deposit' CHECK (payment_required_type IN ('deposit', 'full')),
  ADD COLUMN IF NOT EXISTS payment_status text NOT NULL DEFAULT 'unpaid' CHECK (payment_status IN ('unpaid', 'deposit_paid', 'fully_paid', 'failed'));

-- Add payment columns to booking_bookings
ALTER TABLE public.booking_bookings
  ADD COLUMN IF NOT EXISTS payment_intent_id text,
  ADD COLUMN IF NOT EXISTS payment_provider text DEFAULT 'stripe' CHECK (payment_provider IN ('stripe', 'ziina', 'manual')),
  ADD COLUMN IF NOT EXISTS paid_amount numeric DEFAULT 0;

-- Update booking_status enum to include new states
ALTER TYPE public.booking_status ADD VALUE IF NOT EXISTS 'pending_payment';
ALTER TYPE public.booking_status ADD VALUE IF NOT EXISTS 'deposit_paid';
ALTER TYPE public.booking_status ADD VALUE IF NOT EXISTS 'confirmed';
ALTER TYPE public.booking_status ADD VALUE IF NOT EXISTS 'refunded';
