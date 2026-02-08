-- Fix onboarding insert: rely on trigger to set companies.created_by, and only require authentication

DROP POLICY IF EXISTS "Users can create companies" ON public.companies;

CREATE POLICY "Users can create companies"
ON public.companies
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() IS NOT NULL);
