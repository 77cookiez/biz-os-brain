
-- ═══════════════════════════════════════════════════════════
-- Phase 2A.1: Read receipts, audit logging, delete policies
-- ═══════════════════════════════════════════════════════════

-- 1. Add last_read_at to chat_thread_members for read receipts
ALTER TABLE public.chat_thread_members
  ADD COLUMN last_read_at timestamptz DEFAULT NULL;

-- 2. Allow members to update their own membership (for last_read_at)
CREATE POLICY "Members can update own membership"
  ON public.chat_thread_members FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- 3. Chat audit logs table
CREATE TABLE public.chat_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  action text NOT NULL,
  actor_user_id uuid NOT NULL,
  target_id uuid,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.chat_audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Workspace members can view chat audit logs"
  ON public.chat_audit_logs FOR SELECT
  USING (is_workspace_member(auth.uid(), workspace_id));

CREATE POLICY "Workspace members can create chat audit logs"
  ON public.chat_audit_logs FOR INSERT
  WITH CHECK (
    actor_user_id = auth.uid()
    AND is_workspace_member(auth.uid(), workspace_id)
  );

CREATE INDEX idx_chat_audit_workspace ON public.chat_audit_logs(workspace_id, created_at DESC);

-- 4. Delete policies for messages (workspace owners/admins via company role)
CREATE POLICY "Admins can delete messages"
  ON public.chat_messages FOR DELETE
  USING (
    is_workspace_member(auth.uid(), workspace_id)
    AND (
      sender_user_id = auth.uid()
      OR has_company_role(auth.uid(), (SELECT company_id FROM workspaces WHERE id = workspace_id), 'owner'::app_role)
      OR has_company_role(auth.uid(), (SELECT company_id FROM workspaces WHERE id = workspace_id), 'admin'::app_role)
    )
  );

-- 5. Delete policy for threads (admins only)
CREATE POLICY "Admins can delete threads"
  ON public.chat_threads FOR DELETE
  USING (
    is_workspace_member(auth.uid(), workspace_id)
    AND (
      created_by = auth.uid()
      OR has_company_role(auth.uid(), (SELECT company_id FROM workspaces WHERE id = workspace_id), 'owner'::app_role)
      OR has_company_role(auth.uid(), (SELECT company_id FROM workspaces WHERE id = workspace_id), 'admin'::app_role)
    )
  );

-- 6. Delete policy for thread members (cascade handled, but allow admin removal)
CREATE POLICY "Admins can delete thread members"
  ON public.chat_thread_members FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM chat_threads t
      WHERE t.id = chat_thread_members.thread_id
        AND is_workspace_member(auth.uid(), t.workspace_id)
        AND (
          chat_thread_members.user_id = auth.uid()
          OR has_company_role(auth.uid(), (SELECT company_id FROM workspaces WHERE id = t.workspace_id), 'owner'::app_role)
          OR has_company_role(auth.uid(), (SELECT company_id FROM workspaces WHERE id = t.workspace_id), 'admin'::app_role)
        )
    )
  );
