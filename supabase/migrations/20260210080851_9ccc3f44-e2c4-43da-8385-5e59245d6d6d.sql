
-- Add email column to workspace_members to store invited email
ALTER TABLE public.workspace_members ADD COLUMN email text;

-- Backfill existing members with their auth email via profiles (no direct auth access)
-- We'll update via the invite flow going forward
