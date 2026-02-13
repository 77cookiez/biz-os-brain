
-- A) Helper function to insert booking notifications (SECURITY DEFINER to bypass RLS)
CREATE OR REPLACE FUNCTION public.booking_notify(
  _user_id uuid,
  _workspace_id uuid,
  _type text,
  _title text,
  _data_json jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Dedupe: skip if identical notification already exists (same user + type + entity_id)
  IF EXISTS (
    SELECT 1 FROM public.notifications
    WHERE user_id = _user_id
      AND workspace_id = _workspace_id
      AND type = _type
      AND data_json->>'entity_id' = _data_json->>'entity_id'
  ) THEN
    RETURN;
  END IF;

  INSERT INTO public.notifications (workspace_id, user_id, type, title, body, data_json, channels)
  VALUES (
    _workspace_id,
    _user_id,
    _type,
    _title,
    NULL,
    _data_json,
    ARRAY['in_app']
  );
END;
$$;

-- B) Trigger #1: New quote request -> notify vendor owner
CREATE OR REPLACE FUNCTION public.trg_booking_notify_new_request()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _vendor_owner uuid;
BEGIN
  SELECT owner_user_id INTO _vendor_owner
  FROM public.booking_vendors
  WHERE id = NEW.vendor_id;

  IF _vendor_owner IS NOT NULL AND _vendor_owner != NEW.customer_user_id THEN
    PERFORM public.booking_notify(
      _vendor_owner,
      NEW.workspace_id,
      'booking.new_quote_request',
      'booking.notifications.newQuoteRequest',
      jsonb_build_object(
        'entity', 'booking_quote_request',
        'entity_id', NEW.id::text,
        'quote_request_id', NEW.id,
        'vendor_id', NEW.vendor_id,
        'service_id', NEW.service_id,
        'meaning_object_id', NEW.meaning_object_id,
        'link', '/apps/booking/quotes'
      )
    );
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_booking_new_request_notify
AFTER INSERT ON public.booking_quote_requests
FOR EACH ROW
EXECUTE FUNCTION public.trg_booking_notify_new_request();

-- C) Trigger #2: Quote sent -> notify customer
CREATE OR REPLACE FUNCTION public.trg_booking_notify_quote_sent()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _customer_id uuid;
  _vendor_id uuid;
  _service_id uuid;
BEGIN
  SELECT customer_user_id, vendor_id, service_id
  INTO _customer_id, _vendor_id, _service_id
  FROM public.booking_quote_requests
  WHERE id = NEW.quote_request_id;

  IF _customer_id IS NOT NULL THEN
    PERFORM public.booking_notify(
      _customer_id,
      NEW.workspace_id,
      'booking.quote_sent',
      'booking.notifications.quoteSent',
      jsonb_build_object(
        'entity', 'booking_quote',
        'entity_id', NEW.id::text,
        'quote_id', NEW.id,
        'quote_request_id', NEW.quote_request_id,
        'vendor_id', _vendor_id,
        'service_id', _service_id,
        'meaning_object_id', NEW.meaning_object_id,
        'link', '/apps/booking/quotes'
      )
    );
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_booking_quote_sent_notify
AFTER INSERT ON public.booking_quotes
FOR EACH ROW
EXECUTE FUNCTION public.trg_booking_notify_quote_sent();

-- D) Trigger #3: Quote accepted -> notify vendor owner
CREATE OR REPLACE FUNCTION public.trg_booking_notify_quote_accepted()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _vendor_owner uuid;
BEGIN
  -- Only fire on transition TO 'accepted'
  IF OLD.status = 'accepted' OR NEW.status != 'accepted' THEN
    RETURN NEW;
  END IF;

  SELECT owner_user_id INTO _vendor_owner
  FROM public.booking_vendors
  WHERE id = NEW.vendor_id;

  IF _vendor_owner IS NOT NULL THEN
    PERFORM public.booking_notify(
      _vendor_owner,
      NEW.workspace_id,
      'booking.quote_accepted',
      'booking.notifications.quoteAccepted',
      jsonb_build_object(
        'entity', 'booking_quote_request',
        'entity_id', NEW.id::text,
        'quote_request_id', NEW.id,
        'vendor_id', NEW.vendor_id,
        'service_id', NEW.service_id,
        'meaning_object_id', NEW.meaning_object_id,
        'link', '/apps/booking/quotes'
      )
    );
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_booking_quote_accepted_notify
AFTER UPDATE ON public.booking_quote_requests
FOR EACH ROW
EXECUTE FUNCTION public.trg_booking_notify_quote_accepted();
