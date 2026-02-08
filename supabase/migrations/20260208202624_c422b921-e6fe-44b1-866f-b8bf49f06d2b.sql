-- Fix trigger to not block inserts and handle auth.uid() properly
CREATE OR REPLACE FUNCTION public.set_company_created_by()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Set created_by to auth.uid() if available, otherwise keep what was passed
  IF auth.uid() IS NOT NULL THEN
    NEW.created_by := auth.uid();
  END IF;
  
  -- If still NULL after trying auth.uid(), that's an error
  IF NEW.created_by IS NULL THEN
    RAISE EXCEPTION 'User ID is required for company creation';
  END IF;
  
  RETURN NEW;
END;
$$;