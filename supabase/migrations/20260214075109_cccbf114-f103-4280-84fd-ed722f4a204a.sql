
-- ============================================================
-- BookEvo SaaS Billing Module
-- ============================================================

-- 1. Billing Plans
CREATE TABLE public.billing_plans (
  id text PRIMARY KEY,
  name text NOT NULL,
  display_order integer NOT NULL DEFAULT 0,
  billing_cycles text[] NOT NULL DEFAULT ARRAY['monthly', 'yearly'],
  price_monthly numeric NOT NULL DEFAULT 0,
  price_yearly numeric NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'USD',
  vendors_limit integer,
  services_limit integer,
  quotes_limit integer,
  bookings_limit integer,
  seats_limit integer,
  modules text[] NOT NULL DEFAULT '{}',
  features jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.billing_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active plans"
  ON public.billing_plans FOR SELECT
  USING (is_active = true);

-- Seed default plans
INSERT INTO public.billing_plans (id, name, display_order, price_monthly, price_yearly, vendors_limit, services_limit, quotes_limit, bookings_limit, seats_limit, modules, features) VALUES
('free', 'Free', 0, 0, 0, 1, 3, 10, 10, 1, ARRAY['booking_core'], '{"branding": false, "multi_branch": false, "advanced_reports": false, "api_access": false, "sso": false, "priority_support": false}'::jsonb),
('professional', 'Professional', 1, 49, 468, 10, 50, 500, 500, 5, ARRAY['booking_core', 'booking_analytics', 'booking_branding'], '{"branding": true, "multi_branch": false, "advanced_reports": true, "api_access": false, "sso": false, "priority_support": false}'::jsonb),
('enterprise', 'Enterprise', 2, 149, 1428, NULL, NULL, NULL, NULL, NULL, ARRAY['booking_core', 'booking_analytics', 'booking_branding', 'booking_api', 'booking_sso'], '{"branding": true, "multi_branch": true, "advanced_reports": true, "api_access": true, "sso": true, "priority_support": true}'::jsonb);

-- 2. Billing Subscriptions (replaces simple booking_subscriptions for billing)
CREATE TABLE public.billing_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id),
  plan_id text NOT NULL REFERENCES public.billing_plans(id) DEFAULT 'free',
  status text NOT NULL DEFAULT 'active',
  billing_cycle text NOT NULL DEFAULT 'monthly',
  billing_provider text NOT NULL DEFAULT 'offline_invoice',
  current_period_start timestamptz NOT NULL DEFAULT now(),
  current_period_end timestamptz,
  cancelled_at timestamptz,
  external_subscription_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(workspace_id)
);

ALTER TABLE public.billing_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage billing subscriptions"
  ON public.billing_subscriptions FOR ALL
  USING (
    has_company_role(auth.uid(), get_workspace_company(workspace_id), 'owner'::app_role)
    OR has_company_role(auth.uid(), get_workspace_company(workspace_id), 'admin'::app_role)
  );

CREATE POLICY "Members view billing subscriptions"
  ON public.billing_subscriptions FOR SELECT
  USING (is_workspace_member(auth.uid(), workspace_id));

CREATE TRIGGER update_billing_subscriptions_updated_at
  BEFORE UPDATE ON public.billing_subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3. Billing Invoices (offline invoice tracking)
CREATE TABLE public.billing_invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id),
  subscription_id uuid NOT NULL REFERENCES public.billing_subscriptions(id),
  amount numeric NOT NULL,
  currency text NOT NULL DEFAULT 'USD',
  status text NOT NULL DEFAULT 'draft',
  invoice_number text,
  period_start timestamptz NOT NULL,
  period_end timestamptz NOT NULL,
  paid_at timestamptz,
  payment_method text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.billing_invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage billing invoices"
  ON public.billing_invoices FOR ALL
  USING (
    has_company_role(auth.uid(), get_workspace_company(workspace_id), 'owner'::app_role)
    OR has_company_role(auth.uid(), get_workspace_company(workspace_id), 'admin'::app_role)
  );

CREATE POLICY "Members view billing invoices"
  ON public.billing_invoices FOR SELECT
  USING (is_workspace_member(auth.uid(), workspace_id));

CREATE TRIGGER update_billing_invoices_updated_at
  BEFORE UPDATE ON public.billing_invoices
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 4. Commission Ledger (analytics/reporting only)
CREATE TABLE public.booking_commission_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id),
  booking_id uuid NOT NULL REFERENCES public.booking_bookings(id),
  booking_amount numeric NOT NULL,
  commission_rate numeric NOT NULL DEFAULT 0,
  commission_amount numeric NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'AED',
  status text NOT NULL DEFAULT 'pending',
  invoice_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.booking_commission_ledger ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage commission ledger"
  ON public.booking_commission_ledger FOR ALL
  USING (
    has_company_role(auth.uid(), get_workspace_company(workspace_id), 'owner'::app_role)
    OR has_company_role(auth.uid(), get_workspace_company(workspace_id), 'admin'::app_role)
  );

CREATE POLICY "Members view commission ledger"
  ON public.booking_commission_ledger FOR SELECT
  USING (is_workspace_member(auth.uid(), workspace_id));

-- Members can insert commission ledger entries (for booking creation flow)
CREATE POLICY "Members insert commission ledger"
  ON public.booking_commission_ledger FOR INSERT
  WITH CHECK (is_workspace_member(auth.uid(), workspace_id));
