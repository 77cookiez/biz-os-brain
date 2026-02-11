import { useMemo, useState, useEffect } from 'react';
import { Brain, Target, Lightbulb, AlertTriangle, RefreshCw, XCircle, Settings, BookOpen } from 'lucide-react';
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
    const hour = new Date().getHours();

    const scored: SmartCapability[] = CAPABILITY_POOL.map(cap => {
      let priority = 0;

      switch (cap.id) {
        case 'setup':
          priority = !businessContext?.setup_completed ? 100 : -1;
          break;
        case 'risk':
          priority = deliveryRisk && deliveryRisk.score < 40 ? 90 : -1;
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
          // Slightly higher in the morning
          priority = hour < 12 ? 25 : 20;
          break;
        case 'coaching':
          // Slightly higher in the evening
          priority = hour >= 12 ? 25 : 20;
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
