
-- Create notifications table
CREATE TABLE public.notifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT,
  data_json JSONB DEFAULT '{}'::jsonb,
  channels TEXT[] NOT NULL DEFAULT ARRAY['in_app'],
  read_at TIMESTAMPTZ,
  week_key TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Unique constraint to prevent duplicate notifications per type/week/user
CREATE UNIQUE INDEX idx_notifications_dedup ON public.notifications (user_id, workspace_id, type, week_key) WHERE week_key IS NOT NULL;

-- Index for fast user queries
CREATE INDEX idx_notifications_user ON public.notifications (user_id, workspace_id, created_at DESC);

-- Enable RLS
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Users can only view their own notifications
CREATE POLICY "Users can view own notifications"
ON public.notifications FOR SELECT
USING (auth.uid() = user_id);

-- System/workspace members can insert notifications
CREATE POLICY "Workspace members can create notifications"
ON public.notifications FOR INSERT
WITH CHECK (is_workspace_member(auth.uid(), workspace_id));

-- Users can update (mark as read) their own notifications
CREATE POLICY "Users can update own notifications"
ON public.notifications FOR UPDATE
USING (auth.uid() = user_id);

-- Users can delete their own notifications
CREATE POLICY "Users can delete own notifications"
ON public.notifications FOR DELETE
USING (auth.uid() = user_id);

-- Extend digest_preferences with schedule columns
ALTER TABLE public.digest_preferences
ADD COLUMN IF NOT EXISTS schedule_day INTEGER NOT NULL DEFAULT 1,
ADD COLUMN IF NOT EXISTS schedule_hour INTEGER NOT NULL DEFAULT 9;
