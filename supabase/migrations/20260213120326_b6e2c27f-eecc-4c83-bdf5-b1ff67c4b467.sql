-- Add 'message' to the meaning_objects type check constraint
ALTER TABLE public.meaning_objects DROP CONSTRAINT meaning_objects_type_check;
ALTER TABLE public.meaning_objects ADD CONSTRAINT meaning_objects_type_check 
  CHECK (type = ANY (ARRAY['task'::text, 'goal'::text, 'idea'::text, 'brain_message'::text, 'note'::text, 'plan'::text, 'generic'::text, 'message'::text]));
