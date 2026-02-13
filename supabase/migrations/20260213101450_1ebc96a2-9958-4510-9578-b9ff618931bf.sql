
-- Fix: Backfill meaning_object_id for existing orphan rows
DO $$
DECLARE
  task_rec RECORD;
  new_meaning_id uuid;
BEGIN
  -- Backfill tasks
  FOR task_rec IN SELECT id, workspace_id, created_by, title, COALESCE(source_lang, 'en') as src FROM tasks WHERE meaning_object_id IS NULL
  LOOP
    INSERT INTO meaning_objects (workspace_id, created_by, type, source_lang, meaning_json)
    VALUES (task_rec.workspace_id, task_rec.created_by, 'task', task_rec.src,
      jsonb_build_object('version', 'v1', 'type', 'TASK', 'intent', 'create', 'subject', task_rec.title, 'metadata', jsonb_build_object('created_from', 'migration'))
    )
    RETURNING id INTO new_meaning_id;
    UPDATE tasks SET meaning_object_id = new_meaning_id WHERE id = task_rec.id;
  END LOOP;

  -- Backfill goals
  FOR task_rec IN SELECT id, workspace_id, created_by, title, COALESCE(source_lang, 'en') as src FROM goals WHERE meaning_object_id IS NULL
  LOOP
    INSERT INTO meaning_objects (workspace_id, created_by, type, source_lang, meaning_json)
    VALUES (task_rec.workspace_id, task_rec.created_by, 'goal', task_rec.src,
      jsonb_build_object('version', 'v1', 'type', 'GOAL', 'intent', 'plan', 'subject', task_rec.title, 'metadata', jsonb_build_object('created_from', 'migration'))
    )
    RETURNING id INTO new_meaning_id;
    UPDATE goals SET meaning_object_id = new_meaning_id WHERE id = task_rec.id;
  END LOOP;

  -- Backfill ideas
  FOR task_rec IN SELECT id, workspace_id, created_by, title, COALESCE(source_lang, 'en') as src FROM ideas WHERE meaning_object_id IS NULL
  LOOP
    INSERT INTO meaning_objects (workspace_id, created_by, type, source_lang, meaning_json)
    VALUES (task_rec.workspace_id, task_rec.created_by, 'idea', task_rec.src,
      jsonb_build_object('version', 'v1', 'type', 'IDEA', 'intent', 'discuss', 'subject', task_rec.title, 'metadata', jsonb_build_object('created_from', 'migration'))
    )
    RETURNING id INTO new_meaning_id;
    UPDATE ideas SET meaning_object_id = new_meaning_id WHERE id = task_rec.id;
  END LOOP;

  -- Backfill plans
  FOR task_rec IN SELECT id, workspace_id, created_by, title, COALESCE(source_lang, 'en') as src FROM plans WHERE meaning_object_id IS NULL
  LOOP
    INSERT INTO meaning_objects (workspace_id, created_by, type, source_lang, meaning_json)
    VALUES (task_rec.workspace_id, task_rec.created_by, 'plan', task_rec.src,
      jsonb_build_object('version', 'v1', 'type', 'PLAN', 'intent', 'plan', 'subject', task_rec.title, 'metadata', jsonb_build_object('created_from', 'migration'))
    )
    RETURNING id INTO new_meaning_id;
    UPDATE plans SET meaning_object_id = new_meaning_id WHERE id = task_rec.id;
  END LOOP;

  -- Backfill brain_messages
  FOR task_rec IN SELECT id, workspace_id, user_id, content, COALESCE(source_lang, 'en') as src FROM brain_messages WHERE meaning_object_id IS NULL
  LOOP
    INSERT INTO meaning_objects (workspace_id, created_by, type, source_lang, meaning_json)
    VALUES (task_rec.workspace_id, task_rec.user_id, 'brain_message', task_rec.src,
      jsonb_build_object('version', 'v1', 'type', 'BRAIN_MESSAGE', 'intent', 'communicate', 'subject', LEFT(task_rec.content, 120), 'metadata', jsonb_build_object('created_from', 'migration'))
    )
    RETURNING id INTO new_meaning_id;
    UPDATE brain_messages SET meaning_object_id = new_meaning_id WHERE id = task_rec.id;
  END LOOP;
END $$;

-- Now enforce NOT NULL
ALTER TABLE public.tasks ALTER COLUMN meaning_object_id SET NOT NULL;
ALTER TABLE public.goals ALTER COLUMN meaning_object_id SET NOT NULL;
ALTER TABLE public.ideas ALTER COLUMN meaning_object_id SET NOT NULL;
ALTER TABLE public.plans ALTER COLUMN meaning_object_id SET NOT NULL;
ALTER TABLE public.brain_messages ALTER COLUMN meaning_object_id SET NOT NULL;

-- Ensure FK constraints
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'tasks_meaning_object_id_fkey') THEN
    ALTER TABLE public.tasks ADD CONSTRAINT tasks_meaning_object_id_fkey FOREIGN KEY (meaning_object_id) REFERENCES public.meaning_objects(id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'goals_meaning_object_id_fkey') THEN
    ALTER TABLE public.goals ADD CONSTRAINT goals_meaning_object_id_fkey FOREIGN KEY (meaning_object_id) REFERENCES public.meaning_objects(id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ideas_meaning_object_id_fkey') THEN
    ALTER TABLE public.ideas ADD CONSTRAINT ideas_meaning_object_id_fkey FOREIGN KEY (meaning_object_id) REFERENCES public.meaning_objects(id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'plans_meaning_object_id_fkey') THEN
    ALTER TABLE public.plans ADD CONSTRAINT plans_meaning_object_id_fkey FOREIGN KEY (meaning_object_id) REFERENCES public.meaning_objects(id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'brain_messages_meaning_object_id_fkey') THEN
    ALTER TABLE public.brain_messages ADD CONSTRAINT brain_messages_meaning_object_id_fkey FOREIGN KEY (meaning_object_id) REFERENCES public.meaning_objects(id);
  END IF;
END $$;

-- Fix workspace_members RLS
DROP POLICY IF EXISTS "Workspace owners can manage members" ON public.workspace_members;
CREATE POLICY "Company owners/admins can manage members"
  ON public.workspace_members
  FOR ALL
  USING (
    has_company_role(auth.uid(), get_workspace_company(workspace_id), 'owner'::app_role)
    OR has_company_role(auth.uid(), get_workspace_company(workspace_id), 'admin'::app_role)
  );

-- Enterprise audit_log table
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id),
  actor_user_id uuid NOT NULL,
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id text,
  metadata jsonb DEFAULT '{}'::jsonb,
  ip_address text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners/admins can view audit logs"
  ON public.audit_logs FOR SELECT
  USING (
    has_company_role(auth.uid(), get_workspace_company(workspace_id), 'owner'::app_role)
    OR has_company_role(auth.uid(), get_workspace_company(workspace_id), 'admin'::app_role)
  );

CREATE POLICY "System can insert audit logs"
  ON public.audit_logs FOR INSERT
  WITH CHECK (is_workspace_member(auth.uid(), workspace_id));

CREATE INDEX idx_audit_logs_workspace_created ON public.audit_logs(workspace_id, created_at DESC);
CREATE INDEX idx_audit_logs_actor ON public.audit_logs(actor_user_id);
CREATE INDEX idx_audit_logs_entity ON public.audit_logs(entity_type, entity_id);

-- Retention cleanup functions
CREATE OR REPLACE FUNCTION public.cleanup_old_org_events()
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  DELETE FROM public.org_events WHERE created_at < now() - interval '90 days';
$$;

CREATE OR REPLACE FUNCTION public.cleanup_stale_memory()
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE public.company_memory SET status = 'archived'
  WHERE status = 'active' AND confidence < 0.3 AND last_seen_at < now() - interval '30 days';
$$;

-- Performance indexes
CREATE INDEX IF NOT EXISTS idx_tasks_workspace_status ON public.tasks(workspace_id, status);
CREATE INDEX IF NOT EXISTS idx_tasks_assigned_to ON public.tasks(assigned_to) WHERE assigned_to IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tasks_due_date ON public.tasks(due_date) WHERE due_date IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_goals_workspace_status ON public.goals(workspace_id, status);
CREATE INDEX IF NOT EXISTS idx_meaning_objects_workspace_type ON public.meaning_objects(workspace_id, type);
CREATE INDEX IF NOT EXISTS idx_org_events_workspace_created ON public.org_events(workspace_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_brain_messages_workspace ON public.brain_messages(workspace_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_content_translations_meaning ON public.content_translations(meaning_object_id, target_lang);
