-- Fix onboarding: always set companies.created_by from the authenticated user

CREATE OR REPLACE FUNCTION public.set_company_created_by()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Unauthenticated';
  END IF;

  -- Prevent spoofing created_by from the client
  NEW.created_by := auth.uid();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_company_created_by ON public.companies;
CREATE TRIGGER set_company_created_by
BEFORE INSERT ON public.companies
FOR EACH ROW
EXECUTE FUNCTION public.set_company_created_by();
