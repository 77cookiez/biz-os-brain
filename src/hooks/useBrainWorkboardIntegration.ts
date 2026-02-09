import { useCallback } from 'react';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { useWorkboardTasks } from '@/hooks/useWorkboardTasks';
import { toast } from 'sonner';

export interface PlanItem {
  type: 'task' | 'goal';
  title: string;
  description?: string;
  status?: 'backlog' | 'planned' | 'in_progress';
  due_date?: string;
  is_priority?: boolean;
}

export function useBrainWorkboardIntegration() {
  const { installedApps, activateApp, refreshInstalledApps } = useWorkspace();
  const { createTask } = useWorkboardTasks();

  const isWorkboardInstalled = installedApps.some(
    (a) => a.app_id === 'workboard' && a.is_active
  );

  const installWorkboard = useCallback(async () => {
    await activateApp('workboard');
    await refreshInstalledApps();
    toast.success('Workboard installed successfully!');
  }, [activateApp, refreshInstalledApps]);

  const createTasksFromPlan = useCallback(
    async (items: PlanItem[]) => {
      let created = 0;
      for (const item of items) {
        if (item.type === 'task') {
          await createTask({
            title: item.title,
            description: item.description,
            status: item.status || 'planned',
            due_date: item.due_date,
            is_priority: item.is_priority,
          });
          created++;
        }
      }
      if (created > 0) {
        toast.success(`${created} task${created > 1 ? 's' : ''} created in Workboard`);
      }
      return created;
    },
    [createTask]
  );

  return {
    isWorkboardInstalled,
    installWorkboard,
    createTasksFromPlan,
  };
}
