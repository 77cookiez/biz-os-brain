-- Drop all existing policies on companies and recreate with explicit PERMISSIVE
DROP POLICY IF EXISTS "Users can create companies" ON public.companies;
DROP POLICY IF EXISTS "Owners can update companies" ON public.companies;
DROP POLICY IF EXISTS "Users can view companies they belong to" ON public.companies;

-- Recreate INSERT policy - allow any authenticated user to insert
CREATE POLICY "Users can create companies"
ON public.companies
FOR INSERT
TO authenticated
WITH CHECK (true);

-- Recreate SELECT policy
CREATE POLICY "Users can view companies they belong to"
ON public.companies
FOR SELECT
TO authenticated
USING (is_company_member(auth.uid(), id));

-- Recreate UPDATE policy
CREATE POLICY "Owners can update companies"
ON public.companies
FOR UPDATE
TO authenticated
USING (has_company_role(auth.uid(), id, 'owner'::app_role));