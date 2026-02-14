
-- Idempotency table for draft execution (Milestone 3)
CREATE TABLE public.executed_drafts (
  draft_id text PRIMARY KEY,
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id),
  agent_type text NOT NULL,
  draft_type text NOT NULL,
  entity_refs jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  executed_by uuid NOT NULL,
  status text NOT NULL DEFAULT 'reserved',
  error text
);

-- Enable RLS
ALTER TABLE public.executed_drafts ENABLE ROW LEVEL SECURITY;

-- Only service role writes to this table (edge function uses service client)
-- Workspace members can read their own drafts
CREATE POLICY "Workspace members can view executed drafts"
  ON public.executed_drafts
  FOR SELECT
  USING (
    public.is_workspace_member(auth.uid(), workspace_id)
  );

-- Index for quick lookups
CREATE INDEX idx_executed_drafts_workspace ON public.executed_drafts (workspace_id, created_at DESC);
