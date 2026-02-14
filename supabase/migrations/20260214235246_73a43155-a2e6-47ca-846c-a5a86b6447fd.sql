
-- Plan B: Dedicated draft_confirmations table for idempotent confirm + meaning binding
-- This avoids inserting fake values into executed_drafts which has NOT NULL on agent_type/draft_type/executed_by

CREATE TABLE IF NOT EXISTS public.draft_confirmations (
  draft_id text PRIMARY KEY,
  workspace_id uuid NOT NULL,
  confirmed_meaning_object_id uuid NOT NULL,
  confirmed_by uuid NOT NULL,
  confirmed_at timestamptz NOT NULL DEFAULT now(),
  confirmation_hash text NOT NULL,
  expires_at bigint NOT NULL,
  request_id uuid NULL
);

-- Enable RLS
ALTER TABLE public.draft_confirmations ENABLE ROW LEVEL SECURITY;

-- Workspace members can read their confirmations
CREATE POLICY "Workspace members can view draft confirmations"
  ON public.draft_confirmations
  FOR SELECT
  USING (public.is_workspace_member(auth.uid(), workspace_id));

-- Service role handles inserts (edge function uses service client)
-- No user-facing INSERT policy needed since edge function uses service role key

-- Add index on workspace_id + status for executed_drafts
CREATE INDEX IF NOT EXISTS idx_executed_drafts_ws_status 
  ON public.executed_drafts (workspace_id, status);

-- Drop the old confirm-related index that was on executed_drafts (no longer needed)
DROP INDEX IF EXISTS idx_executed_drafts_confirm_meaning;

-- Clean up: Remove confirmed_meaning_object_id from executed_drafts 
-- since it now lives in draft_confirmations
-- NOTE: We keep it for backward compat but stop writing to it
