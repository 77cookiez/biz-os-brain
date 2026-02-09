
-- ═══════════════════════════════════════════════════════════
-- Phase 2A: Multilingual Chat Tables (fixed ordering)
-- ═══════════════════════════════════════════════════════════

-- 1. Create all tables first (no policies yet)

CREATE TABLE public.chat_threads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  type text NOT NULL DEFAULT 'direct' CHECK (type IN ('direct', 'group')),
  title text,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.chat_thread_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id uuid NOT NULL REFERENCES public.chat_threads(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  role text NOT NULL DEFAULT 'member',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(thread_id, user_id)
);

CREATE TABLE public.chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  thread_id uuid NOT NULL REFERENCES public.chat_threads(id) ON DELETE CASCADE,
  sender_user_id uuid NOT NULL,
  meaning_object_id uuid NOT NULL REFERENCES public.meaning_objects(id),
  source_lang varchar(5) NOT NULL DEFAULT 'en',
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 2. Enable RLS on all tables

ALTER TABLE public.chat_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_thread_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

-- 3. RLS Policies

-- chat_threads
CREATE POLICY "Thread members can view their threads"
  ON public.chat_threads FOR SELECT
  USING (
    is_workspace_member(auth.uid(), workspace_id)
    AND EXISTS (
      SELECT 1 FROM public.chat_thread_members
      WHERE thread_id = chat_threads.id AND user_id = auth.uid()
    )
  );

CREATE POLICY "Workspace members can create threads"
  ON public.chat_threads FOR INSERT
  WITH CHECK (
    is_workspace_member(auth.uid(), workspace_id)
    AND created_by = auth.uid()
  );

-- chat_thread_members
CREATE POLICY "Thread members can view membership"
  ON public.chat_thread_members FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.chat_thread_members AS m
      JOIN public.chat_threads AS t ON t.id = m.thread_id
      WHERE m.thread_id = chat_thread_members.thread_id
        AND m.user_id = auth.uid()
        AND is_workspace_member(auth.uid(), t.workspace_id)
    )
  );

CREATE POLICY "Workspace members can add thread members"
  ON public.chat_thread_members FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.chat_threads t
      WHERE t.id = chat_thread_members.thread_id
        AND is_workspace_member(auth.uid(), t.workspace_id)
    )
  );

-- chat_messages
CREATE POLICY "Thread members can view messages"
  ON public.chat_messages FOR SELECT
  USING (
    is_workspace_member(auth.uid(), workspace_id)
    AND EXISTS (
      SELECT 1 FROM public.chat_thread_members
      WHERE thread_id = chat_messages.thread_id AND user_id = auth.uid()
    )
  );

CREATE POLICY "Thread members can send messages"
  ON public.chat_messages FOR INSERT
  WITH CHECK (
    sender_user_id = auth.uid()
    AND is_workspace_member(auth.uid(), workspace_id)
    AND EXISTS (
      SELECT 1 FROM public.chat_thread_members
      WHERE thread_id = chat_messages.thread_id AND user_id = auth.uid()
    )
    AND EXISTS (
      SELECT 1 FROM public.meaning_objects
      WHERE id = chat_messages.meaning_object_id AND workspace_id = chat_messages.workspace_id
    )
  );

-- 4. Indexes
CREATE INDEX idx_chat_messages_thread ON public.chat_messages(thread_id, created_at);
CREATE INDEX idx_chat_thread_members_user ON public.chat_thread_members(user_id);

-- 5. Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_messages;

-- 6. Register Chat in app_registry
INSERT INTO public.app_registry (id, name, description, icon, pricing, status, capabilities)
VALUES (
  'chat',
  'Chat',
  'Multilingual team chat powered by ULL. Messages are automatically projected into each user''s preferred language.',
  '💬',
  'free',
  'available',
  ARRAY['messaging', 'multilingual', 'collaboration']
);
