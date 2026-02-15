
-- ══════════════════════════════════════════════════════════
-- Platform Owner System: Tables, RLS, Helper Functions
-- ══════════════════════════════════════════════════════════

-- 1. Platform Settings (bootstrap lock)
CREATE TABLE public.platform_settings (
  key text PRIMARY KEY,
  value jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;

INSERT INTO platform_settings (key, value) VALUES ('bootstrap_locked', 'false'::jsonb);

-- 2. Platform Users
CREATE TABLE public.platform_users (
  user_id uuid PRIMARY KEY,
  role text NOT NULL CHECK (role IN ('owner', 'admin', 'billing', 'support', 'auditor')),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.platform_users ENABLE ROW LEVEL SECURITY;

-- 3. Platform Audit Log (append-only)
CREATE TABLE public.platform_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id uuid NOT NULL,
  action_type text NOT NULL,
  target_type text,
  target_id text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.platform_audit_log ENABLE ROW LEVEL SECURITY;

-- Prevent UPDATE/DELETE on platform_audit_log
CREATE OR REPLACE FUNCTION public.prevent_audit_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'platform_audit_log is append-only; updates and deletes are forbidden'
    USING ERRCODE = '42501';
  RETURN NULL;
END;
$$;

CREATE TRIGGER trg_prevent_audit_update
  BEFORE UPDATE ON public.platform_audit_log
  FOR EACH ROW EXECUTE FUNCTION public.prevent_audit_mutation();

CREATE TRIGGER trg_prevent_audit_delete
  BEFORE DELETE ON public.platform_audit_log
  FOR EACH ROW EXECUTE FUNCTION public.prevent_audit_mutation();

-- 4. Platform Grants
CREATE TABLE public.platform_grants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scope text NOT NULL CHECK (scope IN ('workspace', 'user')),
  scope_id uuid NOT NULL,
  grant_type text NOT NULL CHECK (grant_type IN ('full_access', 'os_plan_override', 'app_plan_override', 'feature_flag')),
  value_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  starts_at timestamptz NOT NULL DEFAULT now(),
  ends_at timestamptz,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid NOT NULL,
  reason text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.platform_grants ENABLE ROW LEVEL SECURITY;

-- ══════════════════════════════════════════════════════════
-- Helper: get platform role (SECURITY DEFINER, no RLS recursion)
-- ══════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.get_platform_role(_user_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM platform_users
  WHERE user_id = _user_id AND is_active = true
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.is_platform_user(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM platform_users
    WHERE user_id = _user_id AND is_active = true
  );
$$;

-- ══════════════════════════════════════════════════════════
-- RLS Policies
-- ══════════════════════════════════════════════════════════

-- platform_settings: only platform users can read
CREATE POLICY "Platform users can read settings"
  ON public.platform_settings FOR SELECT
  USING (is_platform_user(auth.uid()));

-- platform_users: only platform users can read; owner/admin can write
CREATE POLICY "Platform users can view"
  ON public.platform_users FOR SELECT
  USING (is_platform_user(auth.uid()));

CREATE POLICY "Platform owner/admin can insert"
  ON public.platform_users FOR INSERT
  WITH CHECK (get_platform_role(auth.uid()) IN ('owner', 'admin'));

CREATE POLICY "Platform owner/admin can update"
  ON public.platform_users FOR UPDATE
  USING (get_platform_role(auth.uid()) IN ('owner', 'admin'));

-- platform_audit_log: platform users can read; platform users can insert
CREATE POLICY "Platform users can read audit"
  ON public.platform_audit_log FOR SELECT
  USING (is_platform_user(auth.uid()));

CREATE POLICY "Platform users can insert audit"
  ON public.platform_audit_log FOR INSERT
  WITH CHECK (is_platform_user(auth.uid()));

-- platform_grants: platform users can read; owner/admin can write
CREATE POLICY "Platform users can read grants"
  ON public.platform_grants FOR SELECT
  USING (is_platform_user(auth.uid()));

CREATE POLICY "Platform owner/admin can insert grants"
  ON public.platform_grants FOR INSERT
  WITH CHECK (get_platform_role(auth.uid()) IN ('owner', 'admin'));

CREATE POLICY "Platform owner/admin can update grants"
  ON public.platform_grants FOR UPDATE
  USING (get_platform_role(auth.uid()) IN ('owner', 'admin'));

-- platform_settings: only owner can update
CREATE POLICY "Platform owner can update settings"
  ON public.platform_settings FOR UPDATE
  USING (get_platform_role(auth.uid()) = 'owner');
