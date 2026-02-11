
-- ═══════════════════════════════════════════════════════
-- OIL: Organizational Intelligence Layer — Core Tables
-- ═══════════════════════════════════════════════════════

-- 1. org_events: Raw organizational events consumed by OIL
CREATE TABLE public.org_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id),
  event_type TEXT NOT NULL,
  object_type TEXT NOT NULL,
  meaning_object_id UUID REFERENCES public.meaning_objects(id),
  severity_hint TEXT NOT NULL DEFAULT 'info',
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Index for efficient querying by workspace and time
CREATE INDEX idx_org_events_workspace_time ON public.org_events(workspace_id, created_at DESC);
CREATE INDEX idx_org_events_type ON public.org_events(workspace_id, event_type);

ALTER TABLE public.org_events ENABLE ROW LEVEL SECURITY;

-- Only service role inserts events (apps emit via edge function)
-- Workspace members can read events
CREATE POLICY "Workspace members can view org events"
  ON public.org_events FOR SELECT
  USING (is_workspace_member(auth.uid(), workspace_id));

CREATE POLICY "Workspace members can insert org events"
  ON public.org_events FOR INSERT
  WITH CHECK (is_workspace_member(auth.uid(), workspace_id));

-- 2. org_indicators: Computed organizational health indicators
CREATE TABLE public.org_indicators (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id),
  indicator_key TEXT NOT NULL,
  score INTEGER NOT NULL DEFAULT 50 CHECK (score >= 0 AND score <= 100),
  trend TEXT NOT NULL DEFAULT 'stable' CHECK (trend IN ('up', 'down', 'stable')),
  drivers JSONB NOT NULL DEFAULT '[]'::jsonb,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(workspace_id, indicator_key)
);

ALTER TABLE public.org_indicators ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Workspace members can view indicators"
  ON public.org_indicators FOR SELECT
  USING (is_workspace_member(auth.uid(), workspace_id));

CREATE POLICY "Workspace members can insert indicators"
  ON public.org_indicators FOR INSERT
  WITH CHECK (is_workspace_member(auth.uid(), workspace_id));

CREATE POLICY "Workspace members can update indicators"
  ON public.org_indicators FOR UPDATE
  USING (is_workspace_member(auth.uid(), workspace_id));

-- 3. company_memory: Abstracted organizational memory
CREATE TABLE public.company_memory (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id),
  memory_type TEXT NOT NULL CHECK (memory_type IN ('PROCESS', 'RISK', 'FINANCE', 'OPERATIONS', 'CULTURE')),
  statement TEXT NOT NULL,
  evidence_refs JSONB NOT NULL DEFAULT '[]'::jsonb,
  confidence NUMERIC(3,2) NOT NULL DEFAULT 0.5 CHECK (confidence >= 0 AND confidence <= 1),
  last_seen_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_company_memory_workspace ON public.company_memory(workspace_id, status);
CREATE INDEX idx_company_memory_type ON public.company_memory(workspace_id, memory_type);

ALTER TABLE public.company_memory ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Workspace members can view company memory"
  ON public.company_memory FOR SELECT
  USING (is_workspace_member(auth.uid(), workspace_id));

CREATE POLICY "Workspace members can insert company memory"
  ON public.company_memory FOR INSERT
  WITH CHECK (is_workspace_member(auth.uid(), workspace_id));

CREATE POLICY "Workspace members can update company memory"
  ON public.company_memory FOR UPDATE
  USING (is_workspace_member(auth.uid(), workspace_id));

-- 4. Register OIL in app_registry as System App
INSERT INTO public.app_registry (id, name, description, icon, pricing, status, capabilities, actions)
VALUES (
  'oil',
  'Organizational Intelligence Layer',
  'System-level intelligence service that continuously learns from organizational behavior to provide early risk signals, operational indicators, and contextual guidance.',
  'Brain',
  'free',
  'active',
  ARRAY['risk_detection', 'pattern_mining', 'org_memory', 'indicator_tracking'],
  '{"consume_events": {"description": "Ingest organizational events from all apps"}, "compute_indicators": {"description": "Compute health indicators from event patterns"}, "query_memory": {"description": "Read organizational memory insights"}}'::jsonb
);
