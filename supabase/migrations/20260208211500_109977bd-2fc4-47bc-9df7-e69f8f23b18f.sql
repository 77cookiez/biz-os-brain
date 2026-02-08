-- Fix 1: Restrict profiles SELECT to authenticated users who share workspaces
DROP POLICY IF EXISTS "Users can view all profiles" ON public.profiles;

CREATE POLICY "Users can view profiles in shared workspaces"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  auth.uid() = user_id
  OR EXISTS (
    SELECT 1 FROM public.workspace_members wm1
    JOIN public.workspace_members wm2 ON wm1.workspace_id = wm2.workspace_id
    WHERE wm1.user_id = auth.uid()
    AND wm2.user_id = profiles.user_id
  )
);

-- Fix 2: Restrict app_registry to authenticated users only
DROP POLICY IF EXISTS "Anyone can view app registry" ON public.app_registry;

CREATE POLICY "Authenticated users can view app registry"
ON public.app_registry
FOR SELECT
TO authenticated
USING (true);

-- Fix 3: Tighten companies INSERT policy (require auth instead of true)
DROP POLICY IF EXISTS "Users can create companies" ON public.companies;

CREATE POLICY "Authenticated users can create companies"
ON public.companies
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() IS NOT NULL);

-- Fix 4: Add missing UPDATE/DELETE policies for weekly_checkins
CREATE POLICY "Check-in creators can update their checkins"
ON public.weekly_checkins
FOR UPDATE
TO authenticated
USING (completed_by = auth.uid() AND is_workspace_member(auth.uid(), workspace_id));

CREATE POLICY "Check-in creators can delete their checkins"
ON public.weekly_checkins
FOR DELETE
TO authenticated
USING (completed_by = auth.uid() AND is_workspace_member(auth.uid(), workspace_id));

-- Fix 5: Add UPDATE/DELETE policies for ai_action_logs (restrict to log creator)
CREATE POLICY "Users can update their own action logs"
ON public.ai_action_logs
FOR UPDATE
TO authenticated
USING (user_id = auth.uid() AND is_workspace_member(auth.uid(), workspace_id));

CREATE POLICY "Users can delete their own action logs"
ON public.ai_action_logs
FOR DELETE
TO authenticated
USING (user_id = auth.uid() AND is_workspace_member(auth.uid(), workspace_id));