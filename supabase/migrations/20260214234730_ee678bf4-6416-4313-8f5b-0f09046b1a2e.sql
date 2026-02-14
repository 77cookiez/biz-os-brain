
-- Add columns to executed_drafts for strong idempotency replay + confirm tracking
ALTER TABLE public.executed_drafts
  ADD COLUMN IF NOT EXISTS audit_log_id uuid DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS request_id text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS confirmed_meaning_object_id uuid DEFAULT NULL;

-- Index for confirm idempotency lookup
CREATE INDEX IF NOT EXISTS idx_executed_drafts_confirm_meaning ON public.executed_drafts (draft_id) WHERE confirmed_meaning_object_id IS NOT NULL;
