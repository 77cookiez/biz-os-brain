
-- Fix infinite recursion in chat_thread_members RLS policy
-- The current SELECT policy on chat_thread_members joins back to itself, causing recursion.
-- Solution: Create a security definer function to check thread membership without triggering RLS.

-- 1. Create security definer function to check if a user is a member of a chat thread
CREATE OR REPLACE FUNCTION public.is_chat_thread_member(_user_id uuid, _thread_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.chat_thread_members
    WHERE user_id = _user_id AND thread_id = _thread_id
  )
$$;

-- 2. Create security definer function to get workspace_id from a thread
CREATE OR REPLACE FUNCTION public.get_thread_workspace(_thread_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT workspace_id FROM public.chat_threads WHERE id = _thread_id
$$;

-- 3. Drop the recursive SELECT policy on chat_thread_members
DROP POLICY IF EXISTS "Thread members can view membership" ON public.chat_thread_members;

-- 4. Create new non-recursive SELECT policy
CREATE POLICY "Thread members can view membership"
ON public.chat_thread_members
FOR SELECT
USING (
  is_workspace_member(auth.uid(), get_thread_workspace(thread_id))
  AND is_chat_thread_member(auth.uid(), thread_id)
);

-- 5. Fix chat_threads SELECT policy to use the security definer function
DROP POLICY IF EXISTS "Thread members can view their threads" ON public.chat_threads;

CREATE POLICY "Thread members can view their threads"
ON public.chat_threads
FOR SELECT
USING (
  is_workspace_member(auth.uid(), workspace_id)
  AND is_chat_thread_member(auth.uid(), id)
);

-- 6. Fix chat_threads DELETE policy to avoid subquery recursion
DROP POLICY IF EXISTS "Admins can delete threads" ON public.chat_threads;

CREATE POLICY "Admins can delete threads"
ON public.chat_threads
FOR DELETE
USING (
  is_workspace_member(auth.uid(), workspace_id)
  AND (
    created_by = auth.uid()
    OR has_company_role(auth.uid(), get_workspace_company(workspace_id), 'owner'::app_role)
    OR has_company_role(auth.uid(), get_workspace_company(workspace_id), 'admin'::app_role)
  )
);

-- 7. Fix chat_messages SELECT policy to use security definer
DROP POLICY IF EXISTS "Thread members can view messages" ON public.chat_messages;

CREATE POLICY "Thread members can view messages"
ON public.chat_messages
FOR SELECT
USING (
  is_workspace_member(auth.uid(), workspace_id)
  AND is_chat_thread_member(auth.uid(), thread_id)
);

-- 8. Fix chat_messages INSERT policy to use security definer
DROP POLICY IF EXISTS "Thread members can send messages" ON public.chat_messages;

CREATE POLICY "Thread members can send messages"
ON public.chat_messages
FOR INSERT
WITH CHECK (
  sender_user_id = auth.uid()
  AND is_workspace_member(auth.uid(), workspace_id)
  AND is_chat_thread_member(auth.uid(), thread_id)
  AND EXISTS (
    SELECT 1 FROM meaning_objects
    WHERE id = meaning_object_id AND workspace_id = chat_messages.workspace_id
  )
);

-- 9. Fix chat_messages DELETE policy to avoid subqueries
DROP POLICY IF EXISTS "Admins can delete messages" ON public.chat_messages;

CREATE POLICY "Admins can delete messages"
ON public.chat_messages
FOR DELETE
USING (
  is_workspace_member(auth.uid(), workspace_id)
  AND (
    sender_user_id = auth.uid()
    OR has_company_role(auth.uid(), get_workspace_company(workspace_id), 'owner'::app_role)
    OR has_company_role(auth.uid(), get_workspace_company(workspace_id), 'admin'::app_role)
  )
);

-- 10. Fix chat_thread_members INSERT policy
DROP POLICY IF EXISTS "Workspace members can add thread members" ON public.chat_thread_members;

CREATE POLICY "Workspace members can add thread members"
ON public.chat_thread_members
FOR INSERT
WITH CHECK (
  is_workspace_member(auth.uid(), get_thread_workspace(thread_id))
);

-- 11. Fix chat_thread_members DELETE policy
DROP POLICY IF EXISTS "Admins can delete thread members" ON public.chat_thread_members;

CREATE POLICY "Admins can delete thread members"
ON public.chat_thread_members
FOR DELETE
USING (
  user_id = auth.uid()
  OR has_company_role(auth.uid(), get_workspace_company(get_thread_workspace(thread_id)), 'owner'::app_role)
  OR has_company_role(auth.uid(), get_workspace_company(get_thread_workspace(thread_id)), 'admin'::app_role)
);
