
-- Fix: Chat threads delete policy - require admin to be thread member
DROP POLICY IF EXISTS "Admins can delete threads" ON public.chat_threads;

CREATE POLICY "Admins can delete threads"
ON public.chat_threads
FOR DELETE
TO authenticated
USING (
  is_workspace_member(auth.uid(), workspace_id)
  AND (
    created_by = auth.uid()
    OR (
      EXISTS (
        SELECT 1 FROM chat_thread_members
        WHERE chat_thread_members.thread_id = chat_threads.id
        AND chat_thread_members.user_id = auth.uid()
      )
      AND (
        has_company_role(auth.uid(), (SELECT company_id FROM workspaces WHERE id = chat_threads.workspace_id), 'owner'::app_role)
        OR has_company_role(auth.uid(), (SELECT company_id FROM workspaces WHERE id = chat_threads.workspace_id), 'admin'::app_role)
      )
    )
  )
);
