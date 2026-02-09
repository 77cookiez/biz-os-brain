import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export type TaskStatus = 'backlog' | 'planned' | 'in_progress' | 'blocked' | 'done';

export interface WorkboardTask {
  id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  is_priority: boolean;
  due_date: string | null;
  blocked_reason: string | null;
  assigned_to: string | null;
  goal_id: string | null;
  completed_at: string | null;
  created_at: string;
  created_by: string;
}

export function useWorkboardTasks() {
  const [tasks, setTasks] = useState<WorkboardTask[]>([]);
  const [loading, setLoading] = useState(true);
  const { currentWorkspace } = useWorkspace();
  const { user } = useAuth();

  const fetchTasks = useCallback(async () => {
    if (!currentWorkspace) return;
    setLoading(true);
    const { data } = await supabase
      .from('tasks')
      .select('*')
      .eq('workspace_id', currentWorkspace.id)
      .order('is_priority', { ascending: false })
      .order('created_at', { ascending: false });
    setTasks((data as WorkboardTask[]) || []);
    setLoading(false);
  }, [currentWorkspace?.id]);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  const createTask = async (task: {
    title: string;
    description?: string;
    status?: TaskStatus;
    due_date?: string;
    is_priority?: boolean;
    goal_id?: string;
  }) => {
    if (!currentWorkspace || !user) return;
    const { error } = await supabase.from('tasks').insert({
      workspace_id: currentWorkspace.id,
      created_by: user.id,
      title: task.title,
      description: task.description || null,
      status: task.status || 'backlog',
      due_date: task.due_date || null,
      is_priority: task.is_priority || false,
      goal_id: task.goal_id || null,
    });
    if (error) {
      toast.error('Failed to create task');
    } else {
      toast.success('Task created');
      fetchTasks();
    }
  };

  const updateTask = async (taskId: string, updates: Partial<WorkboardTask>) => {
    if (updates.status === 'done') {
      updates.completed_at = new Date().toISOString();
    }
    await supabase.from('tasks').update(updates as any).eq('id', taskId);
    fetchTasks();
  };

  const deleteTask = async (taskId: string) => {
    await supabase.from('tasks').delete().eq('id', taskId);
    fetchTasks();
  };

  return { tasks, loading, fetchTasks, createTask, updateTask, deleteTask };
}
