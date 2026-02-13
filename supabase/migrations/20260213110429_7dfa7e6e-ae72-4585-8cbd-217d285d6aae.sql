
-- V0.4.0 — Company-Level Enterprise Risk Model (retry)

-- Drop old workspace-only risk tables
DROP TABLE IF EXISTS public.risk_forecasts CASCADE;
DROP TABLE IF EXISTS public.risk_snapshots CASCADE;
DROP TABLE IF EXISTS public.enterprise_risk_scores CASCADE;

-- A1) Company-level risk scores
CREATE TABLE public.company_risk_scores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id),
  risk_type text NOT NULL,
  risk_score integer NOT NULL DEFAULT 50 CHECK (risk_score >= 0 AND risk_score <= 100),
  risk_level public.risk_level NOT NULL DEFAULT 'moderate',
  computed_at timestamptz NOT NULL DEFAULT now(),
  window_days integer NOT NULL DEFAULT 7,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(company_id, risk_type)
);

-- A2) Per-workspace risk scores
CREATE TABLE public.workspace_risk_scores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id),
  risk_type text NOT NULL,
  risk_score integer NOT NULL DEFAULT 50 CHECK (risk_score >= 0 AND risk_score <= 100),
  risk_level public.risk_level NOT NULL DEFAULT 'moderate',
  computed_at timestamptz NOT NULL DEFAULT now(),
  window_days integer NOT NULL DEFAULT 7,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(workspace_id, risk_type)
);

-- A3) Risk snapshots (daily)
CREATE TABLE public.risk_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id),
  workspace_id uuid REFERENCES public.workspaces(id),
  snapshot_date date NOT NULL DEFAULT CURRENT_DATE,
  metrics jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
-- Partial unique indexes for nullable workspace_id
CREATE UNIQUE INDEX uq_risk_snap_company ON public.risk_snapshots(company_id, snapshot_date) WHERE workspace_id IS NULL;
CREATE UNIQUE INDEX uq_risk_snap_workspace ON public.risk_snapshots(company_id, workspace_id, snapshot_date) WHERE workspace_id IS NOT NULL;

-- A4) Risk forecasts
CREATE TABLE public.risk_forecasts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id),
  workspace_id uuid REFERENCES public.workspaces(id),
  risk_type text NOT NULL,
  horizon_days integer NOT NULL DEFAULT 30,
  forecast jsonb NOT NULL DEFAULT '[]'::jsonb,
  model_meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  computed_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX uq_risk_forecast_company ON public.risk_forecasts(company_id, risk_type) WHERE workspace_id IS NULL;
CREATE UNIQUE INDEX uq_risk_forecast_workspace ON public.risk_forecasts(company_id, workspace_id, risk_type) WHERE workspace_id IS NOT NULL;

-- INDEXES
CREATE INDEX idx_company_risk_scores_company ON public.company_risk_scores(company_id, computed_at DESC);
CREATE INDEX idx_company_risk_scores_type ON public.company_risk_scores(company_id, risk_type, computed_at DESC);
CREATE INDEX idx_workspace_risk_scores_ws ON public.workspace_risk_scores(workspace_id, computed_at DESC);
CREATE INDEX idx_workspace_risk_scores_company ON public.workspace_risk_scores(company_id, computed_at DESC);
CREATE INDEX idx_risk_snapshots_company ON public.risk_snapshots(company_id, snapshot_date DESC);
CREATE INDEX idx_risk_snapshots_ws ON public.risk_snapshots(workspace_id, snapshot_date DESC);
CREATE INDEX idx_risk_forecasts_company ON public.risk_forecasts(company_id, risk_type, computed_at DESC);
CREATE INDEX idx_risk_forecasts_ws ON public.risk_forecasts(workspace_id, risk_type, computed_at DESC);

-- RLS
ALTER TABLE public.company_risk_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_risk_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.risk_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.risk_forecasts ENABLE ROW LEVEL SECURITY;

-- Company risk: only owner/admin
CREATE POLICY "Company admins can view company risk scores"
ON public.company_risk_scores FOR SELECT
USING (
  has_company_role(auth.uid(), company_id, 'owner'::app_role)
  OR has_company_role(auth.uid(), company_id, 'admin'::app_role)
);

-- Workspace risk: admin sees all, members see own workspace
CREATE POLICY "Admins view all workspace risk scores"
ON public.workspace_risk_scores FOR SELECT
USING (
  has_company_role(auth.uid(), company_id, 'owner'::app_role)
  OR has_company_role(auth.uid(), company_id, 'admin'::app_role)
);

CREATE POLICY "Members view own workspace risk scores"
ON public.workspace_risk_scores FOR SELECT
USING (is_workspace_member(auth.uid(), workspace_id));

-- Snapshots
CREATE POLICY "Admins view all risk snapshots"
ON public.risk_snapshots FOR SELECT
USING (
  has_company_role(auth.uid(), company_id, 'owner'::app_role)
  OR has_company_role(auth.uid(), company_id, 'admin'::app_role)
);

CREATE POLICY "Members view workspace risk snapshots"
ON public.risk_snapshots FOR SELECT
USING (workspace_id IS NOT NULL AND is_workspace_member(auth.uid(), workspace_id));

-- Forecasts
CREATE POLICY "Admins view all risk forecasts"
ON public.risk_forecasts FOR SELECT
USING (
  has_company_role(auth.uid(), company_id, 'owner'::app_role)
  OR has_company_role(auth.uid(), company_id, 'admin'::app_role)
);

CREATE POLICY "Members view workspace risk forecasts"
ON public.risk_forecasts FOR SELECT
USING (workspace_id IS NOT NULL AND is_workspace_member(auth.uid(), workspace_id));
