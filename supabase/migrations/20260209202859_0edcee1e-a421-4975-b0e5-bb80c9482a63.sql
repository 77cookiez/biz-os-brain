
-- ============================================================
-- ULL Phase 0: Foundation Schema
-- ============================================================

-- 1. Canonical Meaning Layer
CREATE TABLE public.meaning_objects (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id),
  type TEXT NOT NULL DEFAULT 'generic',
  meaning_json JSONB NOT NULL DEFAULT '{}',
  source_lang VARCHAR(5) NOT NULL DEFAULT 'en',
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Constrain type values
ALTER TABLE public.meaning_objects
  ADD CONSTRAINT meaning_objects_type_check
  CHECK (type IN ('task', 'goal', 'idea', 'brain_message', 'note', 'plan', 'generic'));

-- Enable RLS
ALTER TABLE public.meaning_objects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Workspace members can view meaning objects"
  ON public.meaning_objects FOR SELECT
  USING (is_workspace_member(auth.uid(), workspace_id));

CREATE POLICY "Workspace members can create meaning objects"
  ON public.meaning_objects FOR INSERT
  WITH CHECK (is_workspace_member(auth.uid(), workspace_id));

CREATE POLICY "Workspace members can update meaning objects"
  ON public.meaning_objects FOR UPDATE
  USING (is_workspace_member(auth.uid(), workspace_id));

-- 2. Translation Projection Cache
CREATE TABLE public.content_translations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  meaning_object_id UUID NOT NULL REFERENCES public.meaning_objects(id) ON DELETE CASCADE,
  field TEXT NOT NULL DEFAULT 'content',
  target_lang VARCHAR(5) NOT NULL,
  translated_text TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Unique constraint for cache lookup
ALTER TABLE public.content_translations
  ADD CONSTRAINT content_translations_unique
  UNIQUE (meaning_object_id, field, target_lang);

-- Index for fast lookups
CREATE INDEX idx_content_translations_lookup
  ON public.content_translations(meaning_object_id, target_lang);

-- Enable RLS - translations are readable if the user can read the meaning object
ALTER TABLE public.content_translations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read translations for accessible meanings"
  ON public.content_translations FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.meaning_objects mo
    WHERE mo.id = content_translations.meaning_object_id
    AND is_workspace_member(auth.uid(), mo.workspace_id)
  ));

CREATE POLICY "System can insert translations"
  ON public.content_translations FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.meaning_objects mo
    WHERE mo.id = content_translations.meaning_object_id
    AND is_workspace_member(auth.uid(), mo.workspace_id)
  ));

-- 3. Add source_lang + meaning_object_id to domain tables

-- Tasks
ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS source_lang VARCHAR(5) DEFAULT 'en',
  ADD COLUMN IF NOT EXISTS meaning_object_id UUID REFERENCES public.meaning_objects(id);

-- Goals
ALTER TABLE public.goals
  ADD COLUMN IF NOT EXISTS source_lang VARCHAR(5) DEFAULT 'en',
  ADD COLUMN IF NOT EXISTS meaning_object_id UUID REFERENCES public.meaning_objects(id);

-- Ideas
ALTER TABLE public.ideas
  ADD COLUMN IF NOT EXISTS source_lang VARCHAR(5) DEFAULT 'en',
  ADD COLUMN IF NOT EXISTS meaning_object_id UUID REFERENCES public.meaning_objects(id);

-- Brain Messages
ALTER TABLE public.brain_messages
  ADD COLUMN IF NOT EXISTS source_lang VARCHAR(5) DEFAULT 'en',
  ADD COLUMN IF NOT EXISTS meaning_object_id UUID REFERENCES public.meaning_objects(id);

-- Plans
ALTER TABLE public.plans
  ADD COLUMN IF NOT EXISTS source_lang VARCHAR(5) DEFAULT 'en',
  ADD COLUMN IF NOT EXISTS meaning_object_id UUID REFERENCES public.meaning_objects(id);

-- Indexes for meaning_object_id lookups
CREATE INDEX IF NOT EXISTS idx_tasks_meaning ON public.tasks(meaning_object_id) WHERE meaning_object_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_goals_meaning ON public.goals(meaning_object_id) WHERE meaning_object_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_ideas_meaning ON public.ideas(meaning_object_id) WHERE meaning_object_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_brain_messages_meaning ON public.brain_messages(meaning_object_id) WHERE meaning_object_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_plans_meaning ON public.plans(meaning_object_id) WHERE meaning_object_id IS NOT NULL;
