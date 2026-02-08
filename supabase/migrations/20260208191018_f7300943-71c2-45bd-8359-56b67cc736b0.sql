-- ===========================================
-- AI BUSINESS BRAIN - DATABASE SCHEMA
-- ===========================================

-- 1. App Role Enum for RBAC
CREATE TYPE public.app_role AS ENUM ('owner', 'admin', 'member');

-- 2. Team Role Enum (operational roles)
CREATE TYPE public.team_role AS ENUM ('owner', 'operations', 'sales', 'marketing', 'finance', 'custom');

-- 3. Business Type Enum
CREATE TYPE public.business_type AS ENUM ('trade', 'services', 'factory', 'online', 'retail', 'consulting', 'other');

-- 4. Task Status Enum
CREATE TYPE public.task_status AS ENUM ('backlog', 'planned', 'in_progress', 'blocked', 'done');

-- 5. Plan Type Enum
CREATE TYPE public.plan_type AS ENUM ('sales', 'marketing', 'operations', 'finance', 'team', 'custom');

-- 6. App Pricing Model Enum
CREATE TYPE public.app_pricing AS ENUM ('free', 'paid', 'subscription');

-- 7. App Status Enum
CREATE TYPE public.app_status AS ENUM ('active', 'available', 'coming_soon');

-- ===========================================
-- CORE TABLES
-- ===========================================

-- Companies table
CREATE TABLE public.companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Workspaces table (belongs to company)
CREATE TABLE public.workspaces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  default_locale TEXT NOT NULL DEFAULT 'en',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- User Roles table (RBAC - links users to companies with roles)
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  role app_role NOT NULL DEFAULT 'member',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, company_id)
);

-- Workspace Members table (links users to workspaces with team roles)
CREATE TABLE public.workspace_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  team_role team_role NOT NULL DEFAULT 'owner',
  custom_role_name TEXT,
  invited_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  joined_at TIMESTAMPTZ,
  invite_status TEXT NOT NULL DEFAULT 'pending',
  UNIQUE (workspace_id, user_id)
);

-- Profiles table (stores additional user info)
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE,
  full_name TEXT,
  avatar_url TEXT,
  preferred_locale TEXT DEFAULT 'en',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ===========================================
-- BUSINESS CONTEXT (Workspace-scoped)
-- ===========================================

CREATE TABLE public.business_contexts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE UNIQUE,
  business_type business_type,
  business_description TEXT,
  primary_pain TEXT,
  secondary_pains TEXT[],
  team_size TEXT,
  has_team BOOLEAN DEFAULT false,
  ninety_day_focus TEXT[],
  setup_completed BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ===========================================
-- GOALS (90-Day Horizon, Workspace-scoped)
-- ===========================================

CREATE TABLE public.goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  kpi_name TEXT,
  kpi_target NUMERIC,
  kpi_current NUMERIC DEFAULT 0,
  due_date DATE,
  status TEXT NOT NULL DEFAULT 'active',
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ===========================================
-- PLANS (Workspace-scoped)
-- ===========================================

CREATE TABLE public.plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  goal_id UUID REFERENCES public.goals(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT,
  plan_type plan_type NOT NULL DEFAULT 'custom',
  weekly_breakdown JSONB,
  ai_generated BOOLEAN DEFAULT false,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ===========================================
-- TASKS (Workspace-scoped)
-- ===========================================

CREATE TABLE public.tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  plan_id UUID REFERENCES public.plans(id) ON DELETE SET NULL,
  goal_id UUID REFERENCES public.goals(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT,
  definition_of_done TEXT,
  status task_status NOT NULL DEFAULT 'backlog',
  blocked_reason TEXT,
  priority INTEGER DEFAULT 0,
  is_priority BOOLEAN DEFAULT false,
  due_date DATE,
  week_bucket TEXT,
  assigned_to UUID,
  created_by UUID NOT NULL,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ===========================================
-- WEEKLY CHECK-INS (Workspace-scoped)
-- ===========================================

CREATE TABLE public.weekly_checkins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  week_start DATE NOT NULL,
  completed_items TEXT[],
  blocked_items JSONB,
  next_week_priorities TEXT[],
  risks_and_decisions TEXT[],
  ai_summary TEXT,
  ai_recommendations JSONB,
  completed_by UUID NOT NULL,
  completed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ===========================================
-- APP REGISTRY (System-wide)
-- ===========================================

CREATE TABLE public.app_registry (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  icon TEXT,
  pricing app_pricing NOT NULL DEFAULT 'free',
  status app_status NOT NULL DEFAULT 'available',
  capabilities TEXT[],
  actions JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Workspace App Installs
CREATE TABLE public.workspace_apps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  app_id TEXT NOT NULL REFERENCES public.app_registry(id) ON DELETE CASCADE,
  is_active BOOLEAN NOT NULL DEFAULT false,
  installed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  installed_by UUID NOT NULL,
  UNIQUE (workspace_id, app_id)
);

-- ===========================================
-- AI ACTION LOGS
-- ===========================================

CREATE TABLE public.ai_action_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  action_type TEXT NOT NULL,
  action_input JSONB,
  action_output JSONB,
  status TEXT NOT NULL DEFAULT 'pending',
  confirmed_at TIMESTAMPTZ,
  executed_at TIMESTAMPTZ,
  user_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ===========================================
-- CHAT MESSAGES (Brain conversations)
-- ===========================================

CREATE TABLE public.brain_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  metadata JSONB,
  user_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ===========================================
-- TRIGGERS FOR updated_at
-- ===========================================

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_companies_updated_at BEFORE UPDATE ON public.companies FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_workspaces_updated_at BEFORE UPDATE ON public.workspaces FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_business_contexts_updated_at BEFORE UPDATE ON public.business_contexts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_goals_updated_at BEFORE UPDATE ON public.goals FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_plans_updated_at BEFORE UPDATE ON public.plans FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_tasks_updated_at BEFORE UPDATE ON public.tasks FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ===========================================
-- SECURITY DEFINER FUNCTIONS FOR RLS
-- ===========================================

-- Check if user has role in company
CREATE OR REPLACE FUNCTION public.has_company_role(_user_id UUID, _company_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND company_id = _company_id AND role = _role
  )
$$;

-- Check if user is member of company
CREATE OR REPLACE FUNCTION public.is_company_member(_user_id UUID, _company_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND company_id = _company_id
  )
$$;

-- Check if user is member of workspace
CREATE OR REPLACE FUNCTION public.is_workspace_member(_user_id UUID, _workspace_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.workspace_members WHERE user_id = _user_id AND workspace_id = _workspace_id
  )
$$;

-- Get workspace's company_id
CREATE OR REPLACE FUNCTION public.get_workspace_company(_workspace_id UUID)
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT company_id FROM public.workspaces WHERE id = _workspace_id
$$;

-- ===========================================
-- ROW LEVEL SECURITY
-- ===========================================

ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.business_contexts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.weekly_checkins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_registry ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_apps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_action_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.brain_messages ENABLE ROW LEVEL SECURITY;

-- Companies policies
CREATE POLICY "Users can view companies they belong to" ON public.companies
  FOR SELECT USING (public.is_company_member(auth.uid(), id));

CREATE POLICY "Users can create companies" ON public.companies
  FOR INSERT WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Owners can update companies" ON public.companies
  FOR UPDATE USING (public.has_company_role(auth.uid(), id, 'owner'));

-- Workspaces policies
CREATE POLICY "Users can view workspaces in their companies" ON public.workspaces
  FOR SELECT USING (public.is_company_member(auth.uid(), company_id));

CREATE POLICY "Owners/admins can create workspaces" ON public.workspaces
  FOR INSERT WITH CHECK (
    public.has_company_role(auth.uid(), company_id, 'owner') OR 
    public.has_company_role(auth.uid(), company_id, 'admin')
  );

CREATE POLICY "Owners/admins can update workspaces" ON public.workspaces
  FOR UPDATE USING (
    public.has_company_role(auth.uid(), company_id, 'owner') OR 
    public.has_company_role(auth.uid(), company_id, 'admin')
  );

-- User roles policies
CREATE POLICY "Users can view roles in their companies" ON public.user_roles
  FOR SELECT USING (public.is_company_member(auth.uid(), company_id));

CREATE POLICY "Owners can manage roles" ON public.user_roles
  FOR ALL USING (public.has_company_role(auth.uid(), company_id, 'owner'));

-- Workspace members policies
CREATE POLICY "Users can view workspace members" ON public.workspace_members
  FOR SELECT USING (public.is_workspace_member(auth.uid(), workspace_id));

CREATE POLICY "Workspace owners can manage members" ON public.workspace_members
  FOR ALL USING (
    public.is_company_member(auth.uid(), public.get_workspace_company(workspace_id))
  );

-- Profiles policies
CREATE POLICY "Users can view all profiles" ON public.profiles
  FOR SELECT USING (true);

CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own profile" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Business contexts policies
CREATE POLICY "Workspace members can view context" ON public.business_contexts
  FOR SELECT USING (public.is_workspace_member(auth.uid(), workspace_id));

CREATE POLICY "Workspace members can manage context" ON public.business_contexts
  FOR ALL USING (public.is_workspace_member(auth.uid(), workspace_id));

-- Goals policies
CREATE POLICY "Workspace members can view goals" ON public.goals
  FOR SELECT USING (public.is_workspace_member(auth.uid(), workspace_id));

CREATE POLICY "Workspace members can manage goals" ON public.goals
  FOR ALL USING (public.is_workspace_member(auth.uid(), workspace_id));

-- Plans policies
CREATE POLICY "Workspace members can view plans" ON public.plans
  FOR SELECT USING (public.is_workspace_member(auth.uid(), workspace_id));

CREATE POLICY "Workspace members can manage plans" ON public.plans
  FOR ALL USING (public.is_workspace_member(auth.uid(), workspace_id));

-- Tasks policies
CREATE POLICY "Workspace members can view tasks" ON public.tasks
  FOR SELECT USING (public.is_workspace_member(auth.uid(), workspace_id));

CREATE POLICY "Workspace members can manage tasks" ON public.tasks
  FOR ALL USING (public.is_workspace_member(auth.uid(), workspace_id));

-- Weekly checkins policies
CREATE POLICY "Workspace members can view checkins" ON public.weekly_checkins
  FOR SELECT USING (public.is_workspace_member(auth.uid(), workspace_id));

CREATE POLICY "Workspace members can create checkins" ON public.weekly_checkins
  FOR INSERT WITH CHECK (public.is_workspace_member(auth.uid(), workspace_id));

-- App registry policies (public read)
CREATE POLICY "Anyone can view app registry" ON public.app_registry
  FOR SELECT USING (true);

-- Workspace apps policies
CREATE POLICY "Workspace members can view installed apps" ON public.workspace_apps
  FOR SELECT USING (public.is_workspace_member(auth.uid(), workspace_id));

CREATE POLICY "Workspace members can manage apps" ON public.workspace_apps
  FOR ALL USING (public.is_workspace_member(auth.uid(), workspace_id));

-- AI action logs policies
CREATE POLICY "Workspace members can view logs" ON public.ai_action_logs
  FOR SELECT USING (public.is_workspace_member(auth.uid(), workspace_id));

CREATE POLICY "Workspace members can create logs" ON public.ai_action_logs
  FOR INSERT WITH CHECK (public.is_workspace_member(auth.uid(), workspace_id));

-- Brain messages policies
CREATE POLICY "Workspace members can view messages" ON public.brain_messages
  FOR SELECT USING (public.is_workspace_member(auth.uid(), workspace_id));

CREATE POLICY "Workspace members can create messages" ON public.brain_messages
  FOR INSERT WITH CHECK (public.is_workspace_member(auth.uid(), workspace_id));

-- ===========================================
-- SEED DATA: APP REGISTRY
-- ===========================================

INSERT INTO public.app_registry (id, name, description, icon, pricing, status, capabilities) VALUES
  ('brain', 'AI Business Brain', 'The thinking and planning layer for your business', 'Brain', 'free', 'active', ARRAY['brain.planning', 'brain.goals', 'brain.tasks', 'brain.checkin']),
  ('docs', 'Docs', 'Create invoices, quotations, and business documents', 'FileText', 'free', 'available', ARRAY['docs.invoices', 'docs.quotations', 'docs.contracts']),
  ('crm', 'CRM', 'Manage customers, leads, and sales pipeline', 'Users', 'paid', 'available', ARRAY['crm.contacts', 'crm.leads', 'crm.pipeline', 'crm.deals']),
  ('accounting', 'Accounting', 'Track finances, expenses, and reports', 'BarChart3', 'subscription', 'available', ARRAY['accounting.transactions', 'accounting.reports', 'accounting.tax']),
  ('inventory', 'Inventory', 'Manage products, stock, and warehouses', 'Package', 'paid', 'available', ARRAY['inventory.products', 'inventory.stock', 'inventory.warehouses']),
  ('ecommerce', 'E-commerce', 'Sell products online with a complete storefront', 'ShoppingCart', 'subscription', 'available', ARRAY['ecommerce.store', 'ecommerce.orders', 'ecommerce.payments']),
  ('marketing', 'Marketing', 'Email campaigns, automation, and analytics', 'Mail', 'subscription', 'coming_soon', ARRAY['marketing.email', 'marketing.automation', 'marketing.analytics']),
  ('social', 'Social Planner', 'Schedule and manage social media posts', 'Share2', 'paid', 'coming_soon', ARRAY['social.scheduling', 'social.analytics']),
  ('seo', 'SEO Manager', 'Optimize your website for search engines', 'Search', 'subscription', 'coming_soon', ARRAY['seo.audit', 'seo.keywords', 'seo.tracking']),
  ('ads', 'Ads Manager', 'Manage Google Ads and paid campaigns', 'Target', 'subscription', 'coming_soon', ARRAY['ads.google', 'ads.facebook', 'ads.campaigns']),
  ('hr', 'HR & Payroll', 'Manage employees, payroll, and attendance', 'UserCheck', 'subscription', 'coming_soon', ARRAY['hr.employees', 'hr.payroll', 'hr.attendance']),
  ('projects', 'Projects', 'Project management with timelines and milestones', 'Kanban', 'free', 'coming_soon', ARRAY['projects.boards', 'projects.timelines', 'projects.milestones']);