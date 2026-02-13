
-- =============================================================
-- Phase 4-B: Scoped anon access + tenant slug resolver RPC
-- =============================================================

-- 1. SECURITY DEFINER RPC: resolve tenant slug → settings + workspace name
--    Returns NULL if tenant is not live.
CREATE OR REPLACE FUNCTION public.get_live_booking_tenant_by_slug(p_slug text)
RETURNS json
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT row_to_json(t) FROM (
    SELECT
      bs.id,
      bs.workspace_id,
      bs.tenant_slug,
      bs.is_live,
      bs.primary_color,
      bs.accent_color,
      bs.logo_url,
      bs.currency,
      bs.theme_template,
      bs.contact_email,
      bs.whatsapp_number,
      bs.cancellation_policy,
      bs.deposit_enabled,
      bs.deposit_type,
      bs.deposit_value,
      bs.tone,
      w.name AS workspace_name
    FROM public.booking_settings bs
    JOIN public.workspaces w ON w.id = bs.workspace_id
    WHERE bs.tenant_slug = p_slug
      AND bs.is_live = true
    LIMIT 1
  ) t;
$$;

-- Grant execute to anon and authenticated
GRANT EXECUTE ON FUNCTION public.get_live_booking_tenant_by_slug(text) TO anon, authenticated;

-- 2. Anon SELECT on meaning_objects — ONLY if referenced by PUBLIC booking entities
--    Scoped to live tenants via booking_settings check.
CREATE POLICY "anon_read_booking_meaning_objects"
ON public.meaning_objects
FOR SELECT
TO anon, authenticated
USING (
  EXISTS (
    -- Vendor profile display names and bios
    SELECT 1 FROM public.booking_vendor_profiles bvp
    JOIN public.booking_vendors bv ON bv.id = bvp.vendor_id
    JOIN public.booking_settings bs ON bs.workspace_id = bv.workspace_id
    WHERE (bvp.display_name_meaning_object_id = meaning_objects.id
        OR bvp.bio_meaning_object_id = meaning_objects.id)
      AND bv.status = 'approved'
      AND bs.is_live = true
      AND bs.tenant_slug IS NOT NULL
  )
  OR EXISTS (
    -- Service titles and descriptions
    SELECT 1 FROM public.booking_services bsv
    JOIN public.booking_vendors bv ON bv.id = bsv.vendor_id
    JOIN public.booking_settings bs ON bs.workspace_id = bv.workspace_id
    WHERE (bsv.title_meaning_object_id = meaning_objects.id
        OR bsv.description_meaning_object_id = meaning_objects.id)
      AND bsv.is_active = true
      AND bv.status = 'approved'
      AND bs.is_live = true
      AND bs.tenant_slug IS NOT NULL
  )
  OR EXISTS (
    -- Service addon names
    SELECT 1 FROM public.booking_service_addons bsa
    JOIN public.booking_services bsv ON bsv.id = bsa.service_id
    JOIN public.booking_vendors bv ON bv.id = bsv.vendor_id
    JOIN public.booking_settings bs ON bs.workspace_id = bv.workspace_id
    WHERE bsa.meaning_object_id = meaning_objects.id
      AND bsv.is_active = true
      AND bv.status = 'approved'
      AND bs.is_live = true
      AND bs.tenant_slug IS NOT NULL
  )
);

-- 3. Update notification trigger for quote_sent to include tenant_slug
CREATE OR REPLACE FUNCTION public.trg_booking_notify_quote_sent()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  _customer_id uuid;
  _vendor_id uuid;
  _service_id uuid;
  _tenant_slug text;
BEGIN
  SELECT customer_user_id, vendor_id, service_id
  INTO _customer_id, _vendor_id, _service_id
  FROM public.booking_quote_requests
  WHERE id = NEW.quote_request_id;

  -- Resolve tenant_slug for customer-facing deep-link
  SELECT bs.tenant_slug INTO _tenant_slug
  FROM public.booking_settings bs
  JOIN public.booking_vendors bv ON bv.workspace_id = bs.workspace_id
  WHERE bv.id = _vendor_id AND bs.is_live = true
  LIMIT 1;

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
        'tenant_slug', COALESCE(_tenant_slug, ''),
        'link', CASE WHEN _tenant_slug IS NOT NULL
          THEN '/b/' || _tenant_slug || '/my'
          ELSE '/apps/booking/quotes'
        END
      )
    );
  END IF;

  RETURN NEW;
END;
$$;
