-- Allow workspace members to read platform_grants scoped to their workspace
-- This is needed so useBilling/useBookingSubscription can check for overrides client-side
CREATE POLICY "Workspace members can read own workspace grants"
ON public.platform_grants
FOR SELECT
TO authenticated
USING (
  scope = 'workspace'
  AND is_workspace_member(auth.uid(), scope_id::uuid)
);