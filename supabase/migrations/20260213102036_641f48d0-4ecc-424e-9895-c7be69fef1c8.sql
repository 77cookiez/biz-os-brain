
-- ═══ PHASE D: GDPR soft-delete columns ═══
ALTER TABLE public.meaning_objects ADD COLUMN IF NOT EXISTS deleted_at timestamptz DEFAULT NULL;
ALTER TABLE public.brain_messages ADD COLUMN IF NOT EXISTS deleted_at timestamptz DEFAULT NULL;
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS deleted_at timestamptz DEFAULT NULL;
ALTER TABLE public.goals ADD COLUMN IF NOT EXISTS deleted_at timestamptz DEFAULT NULL;
ALTER TABLE public.ideas ADD COLUMN IF NOT EXISTS deleted_at timestamptz DEFAULT NULL;
ALTER TABLE public.plans ADD COLUMN IF NOT EXISTS deleted_at timestamptz DEFAULT NULL;

-- ═══ PHASE E: Onboarding tour completion tracking ═══
CREATE TABLE IF NOT EXISTS public.onboarding_completions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id),
  completed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, workspace_id)
);

ALTER TABLE public.onboarding_completions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own onboarding" ON public.onboarding_completions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own onboarding" ON public.onboarding_completions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- ═══ GDPR: Data export/delete policies ═══
-- Allow authenticated users to soft-delete their own meaning objects
CREATE POLICY "Users can soft-delete own meaning objects" ON public.meaning_objects
  FOR UPDATE USING (created_by = auth.uid() AND is_workspace_member(auth.uid(), workspace_id))
  WITH CHECK (created_by = auth.uid());
