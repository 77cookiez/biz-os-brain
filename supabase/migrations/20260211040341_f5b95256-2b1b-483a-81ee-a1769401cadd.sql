ALTER TABLE public.tasks
  ADD COLUMN assigned_by uuid,
  ADD COLUMN assignment_source text DEFAULT 'manager';