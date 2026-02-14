-- Fix 2: Change entity_id from UUID to TEXT to match proposal.id type
ALTER TABLE public.executed_proposals
  ALTER COLUMN entity_id TYPE TEXT USING entity_id::text;