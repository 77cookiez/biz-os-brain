
-- Create ideas table for Workboard brainstorming
CREATE TABLE public.ideas (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  created_by UUID NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  source TEXT NOT NULL DEFAULT 'manual',
  status TEXT NOT NULL DEFAULT 'idea',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.ideas ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Workspace members can view ideas"
ON public.ideas FOR SELECT
USING (is_workspace_member(auth.uid(), workspace_id));

CREATE POLICY "Workspace members can manage ideas"
ON public.ideas FOR ALL
USING (is_workspace_member(auth.uid(), workspace_id));

-- Timestamp trigger
CREATE TRIGGER update_ideas_updated_at
BEFORE UPDATE ON public.ideas
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
