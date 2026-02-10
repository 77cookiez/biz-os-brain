
-- Backfill email from auth.users into workspace_members where email is null
UPDATE public.workspace_members wm
SET email = u.email
FROM auth.users u
WHERE wm.user_id = u.id AND wm.email IS NULL;
