
-- Fix: Allow thread creator to see their thread immediately after INSERT
-- (before chat_thread_members are added)
DROP POLICY IF EXISTS "Thread members can view their threads" ON chat_threads;
CREATE POLICY "Thread members can view their threads" 
  ON chat_threads FOR SELECT
  USING (
    is_workspace_member(auth.uid(), workspace_id) 
    AND (
      created_by = auth.uid()
      OR EXISTS (
        SELECT 1 FROM chat_thread_members 
        WHERE thread_id = chat_threads.id AND user_id = auth.uid()
      )
    )
  );
