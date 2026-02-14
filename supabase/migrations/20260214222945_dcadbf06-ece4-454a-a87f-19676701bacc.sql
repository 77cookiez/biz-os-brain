
-- Part B: Idempotency ledger for proposal execution
CREATE TABLE public.executed_proposals (
  proposal_id TEXT PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id),
  entity_type TEXT NOT NULL,
  entity_id UUID NOT NULL,
  executed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.executed_proposals ENABLE ROW LEVEL SECURITY;

-- Only service-role writes to this table; no client access needed
CREATE POLICY "No direct client access to executed_proposals"
  ON public.executed_proposals
  FOR SELECT
  USING (false);

CREATE INDEX idx_executed_proposals_workspace ON public.executed_proposals(workspace_id, executed_at);

-- Part C: Unify aurelius -> leadership in workspace_apps
UPDATE public.workspace_apps SET app_id = 'leadership' WHERE app_id = 'aurelius';

-- Ensure app_registry has leadership entry (upsert-safe)
INSERT INTO public.app_registry (id, name, description, icon, pricing, status, capabilities)
VALUES (
  'leadership',
  'Aurelius — Executive Intelligence',
  'AI-powered executive intelligence: leadership coaching, team dynamics analysis, and strategic decision support.',
  'crown',
  'paid',
  'available',
  ARRAY['leadership_coaching', 'team_dynamics', 'decision_support', 'meeting_prep']
)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description;

-- Remove stale aurelius registry entry if it exists
DELETE FROM public.app_registry WHERE id = 'aurelius';
