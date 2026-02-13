
-- Step 1: Fix chat_thread_members SELECT - remove recursive is_chat_thread_member call
DROP POLICY IF EXISTS "Thread members can view membership" ON chat_thread_members;
CREATE POLICY "Thread members can view membership" 
  ON chat_thread_members FOR SELECT
  USING (user_id = auth.uid());

-- Step 2: Fix chat_threads SELECT - replace is_chat_thread_member with direct EXISTS
DROP POLICY IF EXISTS "Thread members can view their threads" ON chat_threads;
CREATE POLICY "Thread members can view their threads" 
  ON chat_threads FOR SELECT
  USING (
    is_workspace_member(auth.uid(), workspace_id) 
    AND EXISTS (
      SELECT 1 FROM chat_thread_members 
      WHERE thread_id = chat_threads.id AND user_id = auth.uid()
    )
  );

-- Step 3: Fix chat_messages SELECT
DROP POLICY IF EXISTS "Thread members can view messages" ON chat_messages;
CREATE POLICY "Thread members can view messages" 
  ON chat_messages FOR SELECT
  USING (
    is_workspace_member(auth.uid(), workspace_id) 
    AND EXISTS (
      SELECT 1 FROM chat_thread_members 
      WHERE thread_id = chat_messages.thread_id AND user_id = auth.uid()
    )
  );

-- Step 4: Fix chat_messages INSERT
DROP POLICY IF EXISTS "Thread members can send messages" ON chat_messages;
CREATE POLICY "Thread members can send messages" 
  ON chat_messages FOR INSERT
  WITH CHECK (
    sender_user_id = auth.uid() 
    AND is_workspace_member(auth.uid(), workspace_id) 
    AND EXISTS (
      SELECT 1 FROM chat_thread_members 
      WHERE thread_id = chat_messages.thread_id AND user_id = auth.uid()
    )
    AND EXISTS (
      SELECT 1 FROM meaning_objects 
      WHERE id = chat_messages.meaning_object_id 
      AND workspace_id = chat_messages.workspace_id
    )
  );

-- Step 5: Fix chat_messages DELETE
DROP POLICY IF EXISTS "Admins can delete messages" ON chat_messages;
CREATE POLICY "Admins can delete messages" 
  ON chat_messages FOR DELETE
  USING (
    is_workspace_member(auth.uid(), workspace_id) 
    AND (
      sender_user_id = auth.uid() 
      OR has_company_role(auth.uid(), get_workspace_company(workspace_id), 'owner') 
      OR has_company_role(auth.uid(), get_workspace_company(workspace_id), 'admin')
    )
  );
