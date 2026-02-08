-- Fix onboarding: allow company creator to read their company immediately (needed for INSERT ... RETURNING / .select())
DROP POLICY IF EXISTS "Users can view companies they belong to" ON public.companies;

CREATE POLICY "Users can view companies they belong to"
ON public.companies
FOR SELECT
TO authenticated
USING (
  is_company_member(auth.uid(), id)
  OR created_by = auth.uid()
);