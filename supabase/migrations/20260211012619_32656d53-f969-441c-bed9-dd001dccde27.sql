
-- OIL Settings: workspace-level configuration for Organizational Intelligence Layer
CREATE TABLE public.oil_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  
  -- 9.1 Visibility & Timing
  insights_visibility TEXT NOT NULL DEFAULT 'minimal',  -- minimal | balanced | proactive
  show_in_brain_only BOOLEAN NOT NULL DEFAULT true,
  show_indicator_strip BOOLEAN NOT NULL DEFAULT false,
  
  -- 9.2 Guidance Style
  guidance_style TEXT NOT NULL DEFAULT 'advisory',  -- conservative | advisory | challenging
  
  -- 9.3 Leadership Support Level
  leadership_guidance_enabled BOOLEAN NOT NULL DEFAULT true,
  show_best_practice_comparisons BOOLEAN NOT NULL DEFAULT true,
  always_explain_why BOOLEAN NOT NULL DEFAULT true,
  auto_surface_blind_spots BOOLEAN NOT NULL DEFAULT true,
  
  -- 9.4 Knowledge & Trends Awareness
  external_knowledge TEXT NOT NULL DEFAULT 'conditional',  -- off | conditional | on_demand
  include_industry_benchmarks BOOLEAN NOT NULL DEFAULT false,
  include_operational_best_practices BOOLEAN NOT NULL DEFAULT true,
  exclude_market_news BOOLEAN NOT NULL DEFAULT true,
  
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  
  CONSTRAINT oil_settings_workspace_unique UNIQUE (workspace_id),
  CONSTRAINT oil_settings_visibility_check CHECK (insights_visibility IN ('minimal', 'balanced', 'proactive')),
  CONSTRAINT oil_settings_guidance_check CHECK (guidance_style IN ('conservative', 'advisory', 'challenging')),
  CONSTRAINT oil_settings_knowledge_check CHECK (external_knowledge IN ('off', 'conditional', 'on_demand'))
);

-- Enable RLS
ALTER TABLE public.oil_settings ENABLE ROW LEVEL SECURITY;

-- Only workspace members can view
CREATE POLICY "Workspace members can view OIL settings"
  ON public.oil_settings FOR SELECT
  USING (is_workspace_member(auth.uid(), workspace_id));

-- Only owners/admins can manage
CREATE POLICY "Admins can manage OIL settings"
  ON public.oil_settings FOR ALL
  USING (
    has_company_role(auth.uid(), get_workspace_company(workspace_id), 'owner'::app_role)
    OR has_company_role(auth.uid(), get_workspace_company(workspace_id), 'admin'::app_role)
  );

-- Trigger for updated_at
CREATE TRIGGER update_oil_settings_updated_at
  BEFORE UPDATE ON public.oil_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
