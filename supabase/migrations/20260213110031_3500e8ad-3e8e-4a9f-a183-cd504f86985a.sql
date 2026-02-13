
-- Phase 1: Risk Data Model

-- Risk level enum
CREATE TYPE public.risk_level AS ENUM ('low', 'moderate', 'elevated', 'high', 'critical');

-- Enterprise risk scores (current computed state per workspace)
CREATE TABLE public.enterprise_risk_scores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id),
  risk_type text NOT NULL,
  risk_score integer NOT NULL DEFAULT 50 CHECK (risk_score >= 0 AND risk_score <= 100),
  risk_level public.risk_level NOT NULL DEFAULT 'moderate',
  drivers jsonb NOT NULL DEFAULT '[]'::jsonb,
  computed_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(workspace_id, risk_type)
);

-- Risk snapshots (historical daily snapshots for trend analysis)
CREATE TABLE public.risk_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id),
  risk_type text NOT NULL,
  risk_score integer NOT NULL CHECK (risk_score >= 0 AND risk_score <= 100),
  risk_level public.risk_level NOT NULL,
  snapshot_date date NOT NULL DEFAULT CURRENT_DATE,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(workspace_id, risk_type, snapshot_date)
);

-- Risk forecasts (30-day predicted scores)
CREATE TABLE public.risk_forecasts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id),
  risk_type text NOT NULL,
  forecast_date date NOT NULL,
  predicted_score integer NOT NULL CHECK (predicted_score >= 0 AND predicted_score <= 100),
  confidence numeric NOT NULL DEFAULT 0.5,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(workspace_id, risk_type, forecast_date)
);

-- RLS
ALTER TABLE public.enterprise_risk_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.risk_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.risk_forecasts ENABLE ROW LEVEL SECURITY;

-- Owner/admin full access
CREATE POLICY "Admins can manage risk scores"
ON public.enterprise_risk_scores FOR ALL
USING (
  has_company_role(auth.uid(), get_workspace_company(workspace_id), 'owner'::app_role)
  OR has_company_role(auth.uid(), get_workspace_company(workspace_id), 'admin'::app_role)
);

-- Members can view only
CREATE POLICY "Members can view risk scores"
ON public.enterprise_risk_scores FOR SELECT
USING (is_workspace_member(auth.uid(), workspace_id));

CREATE POLICY "Admins can manage risk snapshots"
ON public.risk_snapshots FOR ALL
USING (
  has_company_role(auth.uid(), get_workspace_company(workspace_id), 'owner'::app_role)
  OR has_company_role(auth.uid(), get_workspace_company(workspace_id), 'admin'::app_role)
);

CREATE POLICY "Members can view risk snapshots"
ON public.risk_snapshots FOR SELECT
USING (is_workspace_member(auth.uid(), workspace_id));

CREATE POLICY "Admins can manage risk forecasts"
ON public.risk_forecasts FOR ALL
USING (
  has_company_role(auth.uid(), get_workspace_company(workspace_id), 'owner'::app_role)
  OR has_company_role(auth.uid(), get_workspace_company(workspace_id), 'admin'::app_role)
);

CREATE POLICY "Members can view risk forecasts"
ON public.risk_forecasts FOR SELECT
USING (is_workspace_member(auth.uid(), workspace_id));

-- Indexes
CREATE INDEX idx_risk_scores_workspace ON public.enterprise_risk_scores(workspace_id);
CREATE INDEX idx_risk_snapshots_workspace_date ON public.risk_snapshots(workspace_id, snapshot_date DESC);
CREATE INDEX idx_risk_forecasts_workspace_date ON public.risk_forecasts(workspace_id, forecast_date);
