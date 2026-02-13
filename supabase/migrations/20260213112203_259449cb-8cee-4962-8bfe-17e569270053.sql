
-- Add billing columns to workspace_apps for paid app support
ALTER TABLE public.workspace_apps
  ADD COLUMN IF NOT EXISTS plan text NOT NULL DEFAULT 'free',
  ADD COLUMN IF NOT EXISTS billing_status text NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS uninstalled_at timestamptz;

-- Register Leadership Augmentation app in the registry
INSERT INTO public.app_registry (id, name, description, icon, pricing, status, capabilities, actions)
VALUES (
  'leadership',
  'Leadership Augmentation',
  'AI-powered leadership coaching, team dynamics analysis, and strategic decision support for executives and managers.',
  'crown',
  'paid',
  'available',
  ARRAY['leadership_coaching', 'team_dynamics', 'decision_support', 'meeting_prep'],
  '{"tools": ["analyze_team", "coaching_session", "meeting_brief"]}'::jsonb
)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  pricing = EXCLUDED.pricing,
  capabilities = EXCLUDED.capabilities;
