
-- Add missing RLS policies for workspace_backup_settings
CREATE POLICY "Admins can manage backup settings" ON public.workspace_backup_settings
  FOR ALL USING (is_workspace_admin(auth.uid(), workspace_id));

CREATE POLICY "Members can view backup settings" ON public.workspace_backup_settings
  FOR SELECT USING (is_workspace_member(auth.uid(), workspace_id));
