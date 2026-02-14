import { useMemo, useState, useEffect } from 'react';
import { Brain, Target, Lightbulb, AlertTriangle, RefreshCw, XCircle, Settings, BookOpen, FlaskConical, Stethoscope, ShieldAlert, PenTool, Compass } from 'lucide-react';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { useOILIndicators } from '@/hooks/useOILIndicators';
import { supabase } from '@/integrations/supabase/client';

export interface SmartCapability {
  id: string;
  icon: React.ElementType;
  titleKey: string;
  descKey: string;
  action: string;
  promptKey: string;
  priority: number;
  intent?: string;
}

const CAPABILITY_POOL: Omit<SmartCapability, 'priority'>[] = [
  {
    id: 'setup',
    icon: Settings,
    titleKey: 'brainPage.capability.setup',
    descKey: 'brainPage.capability.setupDesc',
    action: 'setup_business',
    promptKey: 'brainPage.capability.setupPrompt',
  },
  {
    id: 'risk',
    icon: AlertTriangle,
    titleKey: 'brainPage.capability.risk',
    descKey: 'brainPage.capability.riskDesc',
    action: 'risk_analysis',
    promptKey: 'brainPage.capability.riskPrompt',
  },
  {
    id: 'reprioritize',
    icon: RefreshCw,
    titleKey: 'brainPage.capability.reprioritize',
    descKey: 'brainPage.capability.reprioritizeDesc',
    action: 'reprioritize',
    promptKey: 'brainPage.capability.reprioritizePrompt',
  },
  {
    id: 'unblock',
    icon: XCircle,
    titleKey: 'brainPage.capability.unblock',
    descKey: 'brainPage.capability.unblockDesc',
    action: 'unblock_tasks',
    promptKey: 'brainPage.capability.unblockPrompt',
  },
  {
    id: 'goals',
    icon: Target,
    titleKey: 'brainPage.capability.goals',
    descKey: 'brainPage.capability.goalsDesc',
    action: 'set_goals',
    promptKey: 'brainPage.capability.goalsPrompt',
  },
  {
    id: 'advisor',
    icon: Brain,
    titleKey: 'brainPage.capability.advisor',
    descKey: 'brainPage.capability.advisorDesc',
    action: 'strategic_analysis',
    promptKey: 'brainPage.capability.advisorPrompt',
  },
  {
    id: 'planning',
    icon: BookOpen,
    titleKey: 'brainPage.capability.planning',
    descKey: 'brainPage.capability.planningDesc',
    action: 'business_planning',
    promptKey: 'brainPage.capability.planningPrompt',
  },
  {
    id: 'coaching',
    icon: Lightbulb,
    titleKey: 'brainPage.capability.coaching',
    descKey: 'brainPage.capability.coachingDesc',
    action: 'business_coaching',
    promptKey: 'brainPage.capability.coachingPrompt',
  },
  // ─── Phase 2: New Intent-Based Capabilities ───
  {
    id: 'simulate',
    icon: FlaskConical,
    titleKey: 'brainPage.capability.simulate',
    descKey: 'brainPage.capability.simulateDesc',
    action: 'simulate',
    promptKey: 'brainPage.capability.simulatePrompt',
    intent: 'simulate',
  },
  {
    id: 'diagnose',
    icon: Stethoscope,
    titleKey: 'brainPage.capability.diagnose',
    descKey: 'brainPage.capability.diagnoseDesc',
    action: 'diagnose',
    promptKey: 'brainPage.capability.diagnosePrompt',
    intent: 'diagnose',
  },
  {
    id: 'detect_risks',
    icon: ShieldAlert,
    titleKey: 'brainPage.capability.detectRisks',
    descKey: 'brainPage.capability.detectRisksDesc',
    action: 'detect_risk',
    promptKey: 'brainPage.capability.detectRisksPrompt',
    intent: 'detect_risk',
  },
  {
    id: 'architect',
    icon: PenTool,
    titleKey: 'brainPage.capability.architect',
    descKey: 'brainPage.capability.architectDesc',
    action: 'strategic_analysis',
    promptKey: 'brainPage.capability.architectPrompt',
    intent: 'architect',
  },
  {
    id: 'strategic_think',
    icon: Compass,
    titleKey: 'brainPage.capability.strategicThink',
    descKey: 'brainPage.capability.strategicThinkDesc',
    action: 'strategic_analysis',
    promptKey: 'brainPage.capability.strategicThinkPrompt',
    intent: 'strategic_think',
  },
];

export function useSmartCapabilities(): SmartCapability[] {
  const { businessContext, currentWorkspace } = useWorkspace();
  const { coreIndicators } = useOILIndicators();
  const [taskCounts, setTaskCounts] = useState({ overdue: 0, blocked: 0, goals: 0 });

  useEffect(() => {
    if (!currentWorkspace) return;
    const today = new Date().toISOString().split('T')[0];

    Promise.all([
      supabase.from('tasks').select('id', { count: 'exact', head: true })
        .eq('workspace_id', currentWorkspace.id)
        .in('status', ['backlog', 'planned', 'in_progress', 'blocked'])
        .lt('due_date', today).not('due_date', 'is', null),
      supabase.from('tasks').select('id', { count: 'exact', head: true })
        .eq('workspace_id', currentWorkspace.id).eq('status', 'blocked'),
      supabase.from('goals').select('id', { count: 'exact', head: true })
        .eq('workspace_id', currentWorkspace.id).eq('status', 'active'),
    ]).then(([overdue, blocked, goals]) => {
      setTaskCounts({
        overdue: overdue.count || 0,
        blocked: blocked.count || 0,
        goals: goals.count || 0,
      });
    });
  }, [currentWorkspace?.id]);

  return useMemo(() => {
    const deliveryRisk = coreIndicators.find(i => i.indicator_key === 'DeliveryRisk');
    const deliveryRiskHigh = deliveryRisk && deliveryRisk.score < 40;
    const hour = new Date().getHours();

    const scored: SmartCapability[] = CAPABILITY_POOL.map(cap => {
      let priority = 0;

      switch (cap.id) {
        case 'setup':
          priority = !businessContext?.setup_completed ? 100 : -1;
          break;
        case 'risk':
          priority = deliveryRiskHigh ? 90 : -1;
          break;
        case 'reprioritize':
          priority = taskCounts.overdue > 3 ? 85 : taskCounts.overdue > 0 ? 50 : -1;
          break;
        case 'unblock':
          priority = taskCounts.blocked > 0 ? 80 : -1;
          break;
        case 'goals':
          priority = taskCounts.goals === 0 ? 60 : -1;
          break;
        case 'advisor':
          priority = 30;
          break;
        case 'planning':
          priority = hour < 12 ? 25 : 20;
          break;
        case 'coaching':
          priority = hour >= 12 ? 25 : 20;
          break;
        // ─── Phase 2 Capabilities ───
        case 'simulate':
          priority = deliveryRiskHigh ? 70 : taskCounts.overdue > 2 ? 40 : 15;
          break;
        case 'diagnose':
          priority = taskCounts.blocked > 0 ? 75 : taskCounts.overdue > 0 ? 35 : 10;
          break;
        case 'detect_risks':
          priority = deliveryRiskHigh ? 80 : taskCounts.overdue > 3 ? 55 : 12;
          break;
        case 'architect':
          priority = 18;
          break;
        case 'strategic_think':
          priority = hour < 10 ? 22 : 14;
          break;
      }

      return { ...cap, priority };
    });

    return scored
      .filter(c => c.priority >= 0)
      .sort((a, b) => b.priority - a.priority)
      .slice(0, 3);
  }, [businessContext, coreIndicators, taskCounts]);
}
