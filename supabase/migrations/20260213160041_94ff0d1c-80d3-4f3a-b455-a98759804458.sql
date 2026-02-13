
-- Phase 2.5 Quality Gate Migration

-- 1) Update subscription helper to accept 'trial' status
CREATE OR REPLACE FUNCTION public.is_booking_subscription_active(_workspace_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.booking_subscriptions
    WHERE workspace_id = _workspace_id
      AND status IN ('active', 'grace', 'trial')
  );
$$;

-- 2) Split booking_vendor_profiles meaning_object_id into two separate columns
-- Add new columns
ALTER TABLE public.booking_vendor_profiles
  ADD COLUMN display_name_meaning_object_id uuid,
  ADD COLUMN bio_meaning_object_id uuid;

-- Copy existing meaning_object_id to display_name (backward compat)
UPDATE public.booking_vendor_profiles
  SET display_name_meaning_object_id = meaning_object_id
  WHERE meaning_object_id IS NOT NULL;

-- Add FK constraints
ALTER TABLE public.booking_vendor_profiles
  ADD CONSTRAINT bvp_display_name_mo_fk FOREIGN KEY (display_name_meaning_object_id)
    REFERENCES public.meaning_objects(id),
  ADD CONSTRAINT bvp_bio_mo_fk FOREIGN KEY (bio_meaning_object_id)
    REFERENCES public.meaning_objects(id);

-- Make display_name_meaning_object_id NOT NULL (required)
ALTER TABLE public.booking_vendor_profiles
  ALTER COLUMN display_name_meaning_object_id SET NOT NULL;

-- Drop old single meaning_object_id column and its FK
ALTER TABLE public.booking_vendor_profiles
  DROP CONSTRAINT IF EXISTS booking_vendor_profiles_meaning_object_id_fkey,
  DROP COLUMN meaning_object_id;
