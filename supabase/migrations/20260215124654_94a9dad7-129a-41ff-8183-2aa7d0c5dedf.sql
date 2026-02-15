-- Create workspace_backup_settings table for SafeBack schedule settings
CREATE TABLE IF NOT EXISTS public.workspace_backup_settings (
  workspace_id uuid PRIMARY KEY REFERENCES public.workspaces(id) ON DELETE CASCADE,
  is_enabled boolean NOT NULL DEFAULT false,
  cadence text NOT NULL DEFAULT 'daily',
  retain_count integer NOT NULL DEFAULT 30,
  include_tables text[] NOT NULL DEFAULT ARRAY['tasks','goals','plans','ideas'],
  store_in_storage boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.workspace_backup_settings ENABLE ROW LEVEL SECURITY;

-- Only workspace admins can manage backup settings
CREATE POLICY "Admins manage backup settings"
  ON public.workspace_backup_settings
  FOR ALL
  USING (
    has_company_role(auth.uid(), get_workspace_company(workspace_id), 'owner'::app_role)
    OR has_company_role(auth.uid(), get_workspace_company(workspace_id), 'admin'::app_role)
  );

-- Members can view backup settings
CREATE POLICY "Members view backup settings"
  ON public.workspace_backup_settings
  FOR SELECT
  USING (is_workspace_member(auth.uid(), workspace_id));