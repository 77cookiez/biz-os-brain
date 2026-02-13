
-- Add title_meaning_object_id and description_meaning_object_id to booking_services
ALTER TABLE public.booking_services
  ADD COLUMN title_meaning_object_id uuid,
  ADD COLUMN description_meaning_object_id uuid;

-- Backfill: copy existing meaning_object_id to title_meaning_object_id
UPDATE public.booking_services SET title_meaning_object_id = meaning_object_id;

-- Now set NOT NULL
ALTER TABLE public.booking_services ALTER COLUMN title_meaning_object_id SET NOT NULL;

-- Add foreign keys
ALTER TABLE public.booking_services
  ADD CONSTRAINT booking_services_title_mo_fk FOREIGN KEY (title_meaning_object_id) REFERENCES public.meaning_objects(id),
  ADD CONSTRAINT booking_services_desc_mo_fk FOREIGN KEY (description_meaning_object_id) REFERENCES public.meaning_objects(id);

-- Drop old meaning_object_id column (no longer needed)
ALTER TABLE public.booking_services DROP COLUMN meaning_object_id;
