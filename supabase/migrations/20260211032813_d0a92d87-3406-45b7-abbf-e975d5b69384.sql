
-- Add new columns to weekly_checkins for the enhanced checkin flow
ALTER TABLE public.weekly_checkins 
  ADD COLUMN IF NOT EXISTS goal_reviews jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS action_items jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS oil_snapshot jsonb DEFAULT '{}'::jsonb;
