-- Drop the broken overloaded version that references non-existent columns
DROP FUNCTION IF EXISTS public.create_workspace_snapshot(uuid, uuid, text);