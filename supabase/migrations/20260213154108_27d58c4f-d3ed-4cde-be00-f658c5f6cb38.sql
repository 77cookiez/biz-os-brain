
-- ============================================================
-- BOOKING OS MODULE — Phase 1 Foundation Migration (reordered)
-- ============================================================

-- 1. Enums
CREATE TYPE public.booking_status AS ENUM (
  'requested', 'quoted', 'accepted', 'paid_confirmed', 'completed', 'cancelled'
);
CREATE TYPE public.booking_vendor_status AS ENUM (
  'pending', 'approved', 'suspended'
);

-- ============================================================
-- TABLES FIRST (no RLS yet, just structure)
-- ============================================================

-- T1: booking_settings
CREATE TABLE public.booking_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  tenant_slug text UNIQUE,
  theme_template text NOT NULL DEFAULT 'marketplace',
  logo_url text,
  primary_color text DEFAULT '#6366f1',
  accent_color text DEFAULT '#f59e0b',
  tone text DEFAULT 'professional',
  currency text NOT NULL DEFAULT 'AED',
  commission_mode text NOT NULL DEFAULT 'subscription',
  commission_rate numeric DEFAULT 0,
  deposit_enabled boolean NOT NULL DEFAULT true,
  deposit_type text DEFAULT 'percentage',
  deposit_value numeric DEFAULT 25,
  cancellation_policy text NOT NULL DEFAULT 'standard',
  refund_policy text DEFAULT 'standard',
  payment_provider text,
  payment_config jsonb DEFAULT '{}'::jsonb,
  whatsapp_number text,
  contact_email text,
  ai_booking_assistant_enabled boolean NOT NULL DEFAULT false,
  distribution_mode text NOT NULL DEFAULT 'pwa',
  is_live boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(workspace_id)
);

-- T2: booking_subscriptions
CREATE TABLE public.booking_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'active',
  plan text NOT NULL DEFAULT 'monthly',
  started_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz,
  grace_period_days integer NOT NULL DEFAULT 7,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(workspace_id)
);

-- T3: booking_vendors
CREATE TABLE public.booking_vendors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  owner_user_id uuid NOT NULL,
  status public.booking_vendor_status NOT NULL DEFAULT 'pending',
  approved_at timestamptz,
  approved_by uuid,
  suspended_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- T4: booking_vendor_profiles (ULL)
CREATE TABLE public.booking_vendor_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  vendor_id uuid NOT NULL REFERENCES public.booking_vendors(id) ON DELETE CASCADE,
  meaning_object_id uuid NOT NULL REFERENCES public.meaning_objects(id),
  display_name text NOT NULL,
  bio text,
  whatsapp text,
  email text,
  logo_url text,
  cover_url text,
  source_lang varchar DEFAULT 'en',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(vendor_id)
);

-- T5: booking_services (ULL)
CREATE TABLE public.booking_services (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  vendor_id uuid NOT NULL REFERENCES public.booking_vendors(id) ON DELETE CASCADE,
  meaning_object_id uuid NOT NULL REFERENCES public.meaning_objects(id),
  title text NOT NULL,
  description text,
  price_type text NOT NULL DEFAULT 'fixed',
  price_amount numeric,
  currency text NOT NULL DEFAULT 'AED',
  min_guests integer,
  max_guests integer,
  duration_minutes integer,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer DEFAULT 0,
  source_lang varchar DEFAULT 'en',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- T6: booking_service_addons (ULL)
CREATE TABLE public.booking_service_addons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  service_id uuid NOT NULL REFERENCES public.booking_services(id) ON DELETE CASCADE,
  meaning_object_id uuid NOT NULL REFERENCES public.meaning_objects(id),
  name text NOT NULL,
  price numeric NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'AED',
  source_lang varchar DEFAULT 'en',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- T7: booking_availability_rules
CREATE TABLE public.booking_availability_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  vendor_id uuid NOT NULL REFERENCES public.booking_vendors(id) ON DELETE CASCADE,
  rules jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(vendor_id)
);

-- T8: booking_blackout_dates
CREATE TABLE public.booking_blackout_dates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  vendor_id uuid NOT NULL REFERENCES public.booking_vendors(id) ON DELETE CASCADE,
  blackout_date date NOT NULL,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- T9: booking_quote_requests (ULL)
CREATE TABLE public.booking_quote_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  customer_user_id uuid NOT NULL,
  vendor_id uuid NOT NULL REFERENCES public.booking_vendors(id),
  service_id uuid NOT NULL REFERENCES public.booking_services(id),
  meaning_object_id uuid NOT NULL REFERENCES public.meaning_objects(id),
  event_date date,
  event_time time,
  guest_count integer,
  status public.booking_status NOT NULL DEFAULT 'requested',
  notes text,
  source_lang varchar DEFAULT 'en',
  chat_thread_id uuid REFERENCES public.chat_threads(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- T10: booking_quotes (ULL)
CREATE TABLE public.booking_quotes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  quote_request_id uuid NOT NULL REFERENCES public.booking_quote_requests(id),
  vendor_id uuid NOT NULL REFERENCES public.booking_vendors(id),
  meaning_object_id uuid NOT NULL REFERENCES public.meaning_objects(id),
  amount numeric NOT NULL,
  currency text NOT NULL DEFAULT 'AED',
  deposit_amount numeric,
  expiry_hours integer NOT NULL DEFAULT 48,
  expires_at timestamptz,
  notes text,
  status text NOT NULL DEFAULT 'pending',
  source_lang varchar DEFAULT 'en',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- T11: booking_bookings
CREATE TABLE public.booking_bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  quote_id uuid NOT NULL REFERENCES public.booking_quotes(id),
  quote_request_id uuid NOT NULL REFERENCES public.booking_quote_requests(id),
  vendor_id uuid NOT NULL REFERENCES public.booking_vendors(id),
  customer_user_id uuid NOT NULL,
  status public.booking_status NOT NULL DEFAULT 'paid_confirmed',
  event_date date,
  total_amount numeric NOT NULL,
  deposit_paid numeric DEFAULT 0,
  currency text NOT NULL DEFAULT 'AED',
  completed_at timestamptz,
  cancelled_at timestamptz,
  cancelled_by uuid,
  cancellation_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- T12: booking_payments
CREATE TABLE public.booking_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  booking_id uuid NOT NULL REFERENCES public.booking_bookings(id),
  provider text NOT NULL DEFAULT 'manual',
  payment_reference text,
  amount numeric NOT NULL,
  currency text NOT NULL DEFAULT 'AED',
  payment_type text NOT NULL DEFAULT 'deposit',
  status text NOT NULL DEFAULT 'pending',
  paid_at timestamptz,
  refunded_at timestamptz,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- HELPER FUNCTIONS (now tables exist)
-- ============================================================
CREATE OR REPLACE FUNCTION public.is_booking_vendor_owner(_user_id uuid, _vendor_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.booking_vendors
    WHERE id = _vendor_id AND owner_user_id = _user_id
  );
$$;

CREATE OR REPLACE FUNCTION public.is_booking_subscription_active(_workspace_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.booking_subscriptions
    WHERE workspace_id = _workspace_id
      AND status IN ('active', 'grace')
  );
$$;

-- ============================================================
-- ENABLE RLS ON ALL TABLES
-- ============================================================
ALTER TABLE public.booking_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.booking_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.booking_vendors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.booking_vendor_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.booking_services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.booking_service_addons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.booking_availability_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.booking_blackout_dates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.booking_quote_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.booking_quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.booking_bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.booking_payments ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- RLS POLICIES
-- ============================================================

-- booking_settings
CREATE POLICY "ws_members_view_booking_settings" ON public.booking_settings FOR SELECT
  USING (is_workspace_member(auth.uid(), workspace_id));
CREATE POLICY "admins_manage_booking_settings" ON public.booking_settings FOR ALL
  USING (has_company_role(auth.uid(), get_workspace_company(workspace_id), 'owner'::app_role)
    OR has_company_role(auth.uid(), get_workspace_company(workspace_id), 'admin'::app_role));

-- booking_subscriptions
CREATE POLICY "ws_members_view_booking_sub" ON public.booking_subscriptions FOR SELECT
  USING (is_workspace_member(auth.uid(), workspace_id));
CREATE POLICY "admins_manage_booking_sub" ON public.booking_subscriptions FOR ALL
  USING (has_company_role(auth.uid(), get_workspace_company(workspace_id), 'owner'::app_role)
    OR has_company_role(auth.uid(), get_workspace_company(workspace_id), 'admin'::app_role));

-- booking_vendors
CREATE POLICY "ws_members_view_vendors" ON public.booking_vendors FOR SELECT
  USING (is_workspace_member(auth.uid(), workspace_id));
CREATE POLICY "ws_members_create_vendors" ON public.booking_vendors FOR INSERT
  WITH CHECK (is_workspace_member(auth.uid(), workspace_id) AND owner_user_id = auth.uid());
CREATE POLICY "vendor_owner_or_admin_update" ON public.booking_vendors FOR UPDATE
  USING (owner_user_id = auth.uid()
    OR has_company_role(auth.uid(), get_workspace_company(workspace_id), 'owner'::app_role)
    OR has_company_role(auth.uid(), get_workspace_company(workspace_id), 'admin'::app_role));

-- booking_vendor_profiles
CREATE POLICY "ws_members_view_vendor_profiles" ON public.booking_vendor_profiles FOR SELECT
  USING (is_workspace_member(auth.uid(), workspace_id));
CREATE POLICY "vendor_owner_manage_profile" ON public.booking_vendor_profiles FOR ALL
  USING (is_booking_vendor_owner(auth.uid(), vendor_id)
    OR has_company_role(auth.uid(), get_workspace_company(workspace_id), 'owner'::app_role)
    OR has_company_role(auth.uid(), get_workspace_company(workspace_id), 'admin'::app_role));

-- booking_services
CREATE POLICY "ws_members_view_services" ON public.booking_services FOR SELECT
  USING (is_workspace_member(auth.uid(), workspace_id));
CREATE POLICY "vendor_owner_manage_services" ON public.booking_services FOR ALL
  USING (is_booking_vendor_owner(auth.uid(), vendor_id)
    OR has_company_role(auth.uid(), get_workspace_company(workspace_id), 'owner'::app_role)
    OR has_company_role(auth.uid(), get_workspace_company(workspace_id), 'admin'::app_role));

-- booking_service_addons
CREATE POLICY "ws_members_view_addons" ON public.booking_service_addons FOR SELECT
  USING (is_workspace_member(auth.uid(), workspace_id));
CREATE POLICY "vendor_manage_addons" ON public.booking_service_addons FOR ALL
  USING (EXISTS (SELECT 1 FROM public.booking_services bs WHERE bs.id = booking_service_addons.service_id
    AND (is_booking_vendor_owner(auth.uid(), bs.vendor_id)
      OR has_company_role(auth.uid(), get_workspace_company(booking_service_addons.workspace_id), 'owner'::app_role)
      OR has_company_role(auth.uid(), get_workspace_company(booking_service_addons.workspace_id), 'admin'::app_role))));

-- booking_availability_rules
CREATE POLICY "ws_members_view_availability" ON public.booking_availability_rules FOR SELECT
  USING (is_workspace_member(auth.uid(), workspace_id));
CREATE POLICY "vendor_manage_availability" ON public.booking_availability_rules FOR ALL
  USING (is_booking_vendor_owner(auth.uid(), vendor_id)
    OR has_company_role(auth.uid(), get_workspace_company(workspace_id), 'owner'::app_role)
    OR has_company_role(auth.uid(), get_workspace_company(workspace_id), 'admin'::app_role));

-- booking_blackout_dates
CREATE POLICY "ws_members_view_blackouts" ON public.booking_blackout_dates FOR SELECT
  USING (is_workspace_member(auth.uid(), workspace_id));
CREATE POLICY "vendor_manage_blackouts" ON public.booking_blackout_dates FOR ALL
  USING (is_booking_vendor_owner(auth.uid(), vendor_id)
    OR has_company_role(auth.uid(), get_workspace_company(workspace_id), 'owner'::app_role)
    OR has_company_role(auth.uid(), get_workspace_company(workspace_id), 'admin'::app_role));

-- booking_quote_requests
CREATE POLICY "participants_view_quote_requests" ON public.booking_quote_requests FOR SELECT
  USING (is_workspace_member(auth.uid(), workspace_id)
    AND (customer_user_id = auth.uid()
      OR is_booking_vendor_owner(auth.uid(), vendor_id)
      OR has_company_role(auth.uid(), get_workspace_company(workspace_id), 'owner'::app_role)
      OR has_company_role(auth.uid(), get_workspace_company(workspace_id), 'admin'::app_role)));
CREATE POLICY "customers_create_quote_requests" ON public.booking_quote_requests FOR INSERT
  WITH CHECK (is_workspace_member(auth.uid(), workspace_id)
    AND customer_user_id = auth.uid()
    AND is_booking_subscription_active(workspace_id));
CREATE POLICY "participants_update_quote_requests" ON public.booking_quote_requests FOR UPDATE
  USING (is_workspace_member(auth.uid(), workspace_id)
    AND (customer_user_id = auth.uid()
      OR is_booking_vendor_owner(auth.uid(), vendor_id)
      OR has_company_role(auth.uid(), get_workspace_company(workspace_id), 'owner'::app_role)
      OR has_company_role(auth.uid(), get_workspace_company(workspace_id), 'admin'::app_role)));

-- booking_quotes
CREATE POLICY "participants_view_quotes" ON public.booking_quotes FOR SELECT
  USING (is_workspace_member(auth.uid(), workspace_id)
    AND (is_booking_vendor_owner(auth.uid(), vendor_id)
      OR EXISTS (SELECT 1 FROM public.booking_quote_requests qr WHERE qr.id = booking_quotes.quote_request_id AND qr.customer_user_id = auth.uid())
      OR has_company_role(auth.uid(), get_workspace_company(workspace_id), 'owner'::app_role)
      OR has_company_role(auth.uid(), get_workspace_company(workspace_id), 'admin'::app_role)));
CREATE POLICY "vendors_create_quotes" ON public.booking_quotes FOR INSERT
  WITH CHECK (is_workspace_member(auth.uid(), workspace_id)
    AND is_booking_vendor_owner(auth.uid(), vendor_id)
    AND is_booking_subscription_active(workspace_id));
CREATE POLICY "participants_update_quotes" ON public.booking_quotes FOR UPDATE
  USING (is_workspace_member(auth.uid(), workspace_id)
    AND (is_booking_vendor_owner(auth.uid(), vendor_id)
      OR EXISTS (SELECT 1 FROM public.booking_quote_requests qr WHERE qr.id = booking_quotes.quote_request_id AND qr.customer_user_id = auth.uid())
      OR has_company_role(auth.uid(), get_workspace_company(workspace_id), 'owner'::app_role)
      OR has_company_role(auth.uid(), get_workspace_company(workspace_id), 'admin'::app_role)));

-- booking_bookings
CREATE POLICY "participants_view_bookings" ON public.booking_bookings FOR SELECT
  USING (is_workspace_member(auth.uid(), workspace_id)
    AND (customer_user_id = auth.uid()
      OR is_booking_vendor_owner(auth.uid(), vendor_id)
      OR has_company_role(auth.uid(), get_workspace_company(workspace_id), 'owner'::app_role)
      OR has_company_role(auth.uid(), get_workspace_company(workspace_id), 'admin'::app_role)));
CREATE POLICY "system_create_bookings" ON public.booking_bookings FOR INSERT
  WITH CHECK (is_workspace_member(auth.uid(), workspace_id) AND is_booking_subscription_active(workspace_id));
CREATE POLICY "participants_update_bookings" ON public.booking_bookings FOR UPDATE
  USING (is_workspace_member(auth.uid(), workspace_id)
    AND (customer_user_id = auth.uid()
      OR is_booking_vendor_owner(auth.uid(), vendor_id)
      OR has_company_role(auth.uid(), get_workspace_company(workspace_id), 'owner'::app_role)
      OR has_company_role(auth.uid(), get_workspace_company(workspace_id), 'admin'::app_role)));

-- booking_payments
CREATE POLICY "participants_view_payments" ON public.booking_payments FOR SELECT
  USING (is_workspace_member(auth.uid(), workspace_id)
    AND EXISTS (SELECT 1 FROM public.booking_bookings bb WHERE bb.id = booking_payments.booking_id
      AND (bb.customer_user_id = auth.uid()
        OR is_booking_vendor_owner(auth.uid(), bb.vendor_id)
        OR has_company_role(auth.uid(), get_workspace_company(booking_payments.workspace_id), 'owner'::app_role)
        OR has_company_role(auth.uid(), get_workspace_company(booking_payments.workspace_id), 'admin'::app_role))));
CREATE POLICY "system_create_payments" ON public.booking_payments FOR INSERT
  WITH CHECK (is_workspace_member(auth.uid(), workspace_id) AND is_booking_subscription_active(workspace_id));
CREATE POLICY "admins_update_payments" ON public.booking_payments FOR UPDATE
  USING (has_company_role(auth.uid(), get_workspace_company(workspace_id), 'owner'::app_role)
    OR has_company_role(auth.uid(), get_workspace_company(workspace_id), 'admin'::app_role));

-- ============================================================
-- TRIGGERS (updated_at)
-- ============================================================
CREATE TRIGGER update_booking_settings_ts BEFORE UPDATE ON public.booking_settings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_booking_subscriptions_ts BEFORE UPDATE ON public.booking_subscriptions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_booking_vendors_ts BEFORE UPDATE ON public.booking_vendors FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_booking_vendor_profiles_ts BEFORE UPDATE ON public.booking_vendor_profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_booking_services_ts BEFORE UPDATE ON public.booking_services FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_booking_service_addons_ts BEFORE UPDATE ON public.booking_service_addons FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_booking_availability_ts BEFORE UPDATE ON public.booking_availability_rules FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_booking_quote_requests_ts BEFORE UPDATE ON public.booking_quote_requests FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_booking_quotes_ts BEFORE UPDATE ON public.booking_quotes FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_booking_bookings_ts BEFORE UPDATE ON public.booking_bookings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_booking_payments_ts BEFORE UPDATE ON public.booking_payments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.booking_quotes;
ALTER PUBLICATION supabase_realtime ADD TABLE public.booking_bookings;
