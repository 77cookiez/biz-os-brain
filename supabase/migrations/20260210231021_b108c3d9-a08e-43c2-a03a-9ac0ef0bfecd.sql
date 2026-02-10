
-- Table to store user digest preferences (per workspace)
CREATE TABLE public.digest_preferences (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  enabled BOOLEAN NOT NULL DEFAULT true,
  in_app BOOLEAN NOT NULL DEFAULT true,
  email BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, workspace_id)
);

-- Table to store generated weekly digests
CREATE TABLE public.weekly_digests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  week_start DATE NOT NULL,
  week_end DATE NOT NULL,
  stats JSONB NOT NULL DEFAULT '{}',
  blockers_summary JSONB DEFAULT '[]',
  decisions_summary JSONB DEFAULT '{}',
  narrative_text TEXT,
  read_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, workspace_id, week_start)
);

-- Enable RLS
ALTER TABLE public.digest_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.weekly_digests ENABLE ROW LEVEL SECURITY;

-- RLS policies for digest_preferences
CREATE POLICY "Users can view own digest preferences"
ON public.digest_preferences FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own digest preferences"
ON public.digest_preferences FOR INSERT
WITH CHECK (auth.uid() = user_id AND is_workspace_member(auth.uid(), workspace_id));

CREATE POLICY "Users can update own digest preferences"
ON public.digest_preferences FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own digest preferences"
ON public.digest_preferences FOR DELETE
USING (auth.uid() = user_id);

-- RLS policies for weekly_digests
CREATE POLICY "Users can view own digests"
ON public.weekly_digests FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "System can insert digests for workspace members"
ON public.weekly_digests FOR INSERT
WITH CHECK (is_workspace_member(auth.uid(), workspace_id));

CREATE POLICY "Users can update own digests"
ON public.weekly_digests FOR UPDATE
USING (auth.uid() = user_id);

-- Trigger for updated_at on preferences
CREATE TRIGGER update_digest_preferences_updated_at
BEFORE UPDATE ON public.digest_preferences
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
