-- Add unique constraint for content_translations upsert (meaning_object_id + target_lang + field)
ALTER TABLE public.content_translations
ADD CONSTRAINT content_translations_meaning_lang_field_unique
UNIQUE (meaning_object_id, target_lang, field);