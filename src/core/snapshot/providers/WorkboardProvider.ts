import { supabase } from '@/integrations/supabase/client';
import type { SnapshotProvider, ProviderFragment } from '../types';

async function deleteWorkspaceWorkboardData(workspaceId: string) {
  // Order matters — delete in safe dependency order
  for (const table of ['tasks', 'goals', 'plans', 'ideas']) {
    const { error } = await (supabase as any)
      .from(table)
      .delete()
      .eq('workspace_id', workspaceId);
    if (error) throw new Error(`Failed to clear ${table}: ${error.message}`);
  }
}

async function insertAll(table: string, rows: any[]) {
  if (!rows || rows.length === 0) return;
  const { error } = await (supabase as any).from(table).insert(rows);
  if (error) throw new Error(`Failed to insert into ${table}: ${error.message}`);
}

export const WorkboardProvider: SnapshotProvider = {
  id: 'workboard',
  version: 1,

  async capture(workspaceId: string): Promise<ProviderFragment> {
    const [tasks, goals, plans, ideas] = await Promise.all([
      (supabase as any).from('tasks').select('*').eq('workspace_id', workspaceId),
      (supabase as any).from('goals').select('*').eq('workspace_id', workspaceId),
      (supabase as any).from('plans').select('*').eq('workspace_id', workspaceId),
      (supabase as any).from('ideas').select('*').eq('workspace_id', workspaceId),
    ]);

    const t = tasks.data || [];
    const g = goals.data || [];
    const p = plans.data || [];
    const i = ideas.data || [];

    return {
      provider_id: 'workboard',
      version: 1,
      data: { tasks: t, goals: g, plans: p, ideas: i },
      metadata: {
        entity_count: t.length + g.length + p.length + i.length,
      },
    };
  },

  async restore(workspaceId: string, fragment: ProviderFragment): Promise<void> {
    const { tasks, goals, plans, ideas } = fragment.data as {
      tasks: any[];
      goals: any[];
      plans: any[];
      ideas: any[];
    };

    await deleteWorkspaceWorkboardData(workspaceId);

    await insertAll('tasks', tasks);
    await insertAll('goals', goals);
    await insertAll('plans', plans);
    await insertAll('ideas', ideas);
  },

  describe() {
    return {
      name: 'Workboard',
      description: 'Tasks, goals, plans, ideas',
      critical: true,
    };
  },
};
