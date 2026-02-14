
-- Phase 4A: Allow multiple booking_settings per workspace
ALTER TABLE public.booking_settings DROP CONSTRAINT booking_settings_workspace_id_key;

-- Phase 4B: Add soft delete columns
ALTER TABLE public.booking_settings ADD COLUMN deleted_at timestamptz DEFAULT NULL;
ALTER TABLE public.booking_settings ADD COLUMN deleted_by uuid DEFAULT NULL;

-- Phase 4C: Replace tenant_slug unique with partial unique (only non-deleted rows)
ALTER TABLE public.booking_settings DROP CONSTRAINT booking_settings_tenant_slug_key;
CREATE UNIQUE INDEX booking_settings_tenant_slug_unique ON public.booking_settings (tenant_slug) WHERE tenant_slug IS NOT NULL AND deleted_at IS NULL;

-- Phase 4D: Add max_sites to billing_plans features
UPDATE public.billing_plans SET features = features || '{"max_sites": 1}'::jsonb WHERE id = 'free';
UPDATE public.billing_plans SET features = features || '{"max_sites": 1}'::jsonb WHERE id = 'professional';
UPDATE public.billing_plans SET features = features || '{"max_sites": null}'::jsonb WHERE id = 'enterprise';

-- Phase 4E: Enforcement trigger for max_sites on insert
CREATE OR REPLACE FUNCTION public.trg_enforce_sites_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE _limit int; _count int;
BEGIN
  -- Get max_sites from plan features
  SELECT (bp.features->>'max_sites')::int INTO _limit
  FROM billing_subscriptions bs JOIN billing_plans bp ON bp.id = bs.plan_id
  WHERE bs.workspace_id = NEW.workspace_id AND bs.status IN ('active','trial') LIMIT 1;
  
  -- Fallback to free plan
  IF _limit IS NULL THEN
    SELECT (bp.features->>'max_sites')::int INTO _limit FROM billing_plans bp WHERE bp.id = 'free';
  END IF;
  
  -- NULL means unlimited
  IF _limit IS NULL THEN RETURN NEW; END IF;
  
  -- Count existing non-deleted sites
  SELECT count(*) INTO _count FROM booking_settings
  WHERE workspace_id = NEW.workspace_id AND deleted_at IS NULL;
  
  IF _count >= _limit THEN
    RAISE EXCEPTION 'SITES_LIMIT_REACHED' USING ERRCODE = 'P0001';
  END IF;
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_enforce_sites_limit
  BEFORE INSERT ON public.booking_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_enforce_sites_limit();

-- Also update the foreign key relationship info (the isOneToOne was from the unique constraint we dropped)
-- The RPC get_live_booking_tenant_by_slug already handles multi-site correctly (LIMIT 1 where is_live=true)
