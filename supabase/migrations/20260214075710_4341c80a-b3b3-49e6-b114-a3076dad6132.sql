
-- ============================================================
-- BookEvo Production Hardening: DB Constraints & RBAC
-- ============================================================

-- A1: Prevent multiple accepted quotes per quote_request
-- Only one quote can be 'accepted' per quote_request_id
CREATE UNIQUE INDEX idx_one_accepted_quote_per_request
  ON public.booking_quotes (quote_request_id)
  WHERE (status = 'accepted');

-- A2: Ensure booking_bookings.quote_id is unique (idempotency)
-- Already enforced via FK isOneToOne, but add explicit unique constraint
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'booking_bookings_quote_id_key'
  ) THEN
    ALTER TABLE public.booking_bookings ADD CONSTRAINT booking_bookings_quote_id_key UNIQUE (quote_id);
  END IF;
END $$;

-- A3: can_manage_booking RBAC helper
CREATE OR REPLACE FUNCTION public.can_manage_booking(_user_id uuid, _booking_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.booking_bookings bb
    WHERE bb.id = _booking_id
      AND (
        bb.customer_user_id = _user_id
        OR is_booking_vendor_owner(_user_id, bb.vendor_id)
        OR has_company_role(_user_id, get_workspace_company(bb.workspace_id), 'owner'::app_role)
        OR has_company_role(_user_id, get_workspace_company(bb.workspace_id), 'admin'::app_role)
      )
  );
$$;

-- A4: Status transition validation trigger for bookings
CREATE OR REPLACE FUNCTION public.trg_validate_booking_status_transition()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  valid_transitions jsonb := '{
    "confirmed_pending_payment": ["paid_confirmed", "confirmed", "cancelled"],
    "paid_confirmed": ["completed", "cancelled", "refunded"],
    "confirmed": ["completed", "cancelled"],
    "completed": [],
    "cancelled": [],
    "refunded": []
  }'::jsonb;
  allowed jsonb;
BEGIN
  IF OLD.status = NEW.status THEN
    RETURN NEW;
  END IF;

  allowed := valid_transitions -> OLD.status::text;

  IF allowed IS NULL OR NOT (allowed ? NEW.status::text) THEN
    RAISE EXCEPTION 'Invalid status transition from % to %', OLD.status, NEW.status;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_booking_status_check
  BEFORE UPDATE OF status ON public.booking_bookings
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_validate_booking_status_transition();

-- A5: Status transition validation for quote_requests  
CREATE OR REPLACE FUNCTION public.trg_validate_qr_status_transition()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  valid_transitions jsonb := '{
    "requested": ["quoted", "accepted", "cancelled"],
    "quoted": ["accepted", "cancelled"],
    "accepted": ["cancelled"],
    "cancelled": []
  }'::jsonb;
  allowed jsonb;
BEGIN
  IF OLD.status = NEW.status THEN
    RETURN NEW;
  END IF;

  allowed := valid_transitions -> OLD.status::text;

  IF allowed IS NULL OR NOT (allowed ? NEW.status::text) THEN
    RAISE EXCEPTION 'Invalid quote request status transition from % to %', OLD.status, NEW.status;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_qr_status_check
  BEFORE UPDATE OF status ON public.booking_quote_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_validate_qr_status_transition();
