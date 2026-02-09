import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { toast } from 'sonner';
import { createMeaningObject, updateMeaningObject, buildMeaningFromText } from '@/lib/meaningObject';
import { guardMeaningInsert } from '@/lib/meaningGuard';

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
  const { currentLanguage } = useLanguage();

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
    meaning_object_id?: string; // allow pre-created meaning (e.g. from Brain)
  }) => {
    if (!currentWorkspace || !user) return;

    // Meaning-first: create meaning object before task
    let meaningId = task.meaning_object_id || null;
    if (!meaningId) {
      meaningId = await createMeaningObject({
        workspaceId: currentWorkspace.id,
        createdBy: user.id,
        type: 'TASK',
        sourceLang: currentLanguage.code,
        meaningJson: buildMeaningFromText({
          type: 'TASK',
          title: task.title,
          description: task.description,
          createdFrom: 'user',
        }),
      });
    }

    const insertPayload = {
      workspace_id: currentWorkspace.id,
      created_by: user.id,
      title: task.title,
      description: task.description || null,
      status: task.status || 'backlog',
      due_date: task.due_date || null,
      is_priority: task.is_priority || false,
      goal_id: task.goal_id || null,
      source_lang: currentLanguage.code,
      meaning_object_id: meaningId,
    };
    guardMeaningInsert('tasks', insertPayload);
    const { error } = await supabase.from('tasks').insert(insertPayload as any);
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

    // Lazy migration: if task has no meaning_object_id and title/description changed, create one
    if (updates.title || updates.description) {
      const existingTask = tasks.find(t => t.id === taskId);
      if (existingTask && !(existingTask as any).meaning_object_id && currentWorkspace && user) {
        const meaningId = await createMeaningObject({
          workspaceId: currentWorkspace.id,
          createdBy: user.id,
          type: 'TASK',
          sourceLang: currentLanguage.code,
          meaningJson: buildMeaningFromText({
            type: 'TASK',
            title: updates.title || existingTask.title,
            description: updates.description || existingTask.description || undefined,
          }),
        });
        if (meaningId) {
          (updates as any).meaning_object_id = meaningId;
        }
      } else if (existingTask && (existingTask as any).meaning_object_id) {
        // Update existing meaning object
        await updateMeaningObject({
          meaningObjectId: (existingTask as any).meaning_object_id,
          meaningJson: buildMeaningFromText({
            type: 'TASK',
            title: updates.title || existingTask.title,
            description: updates.description || existingTask.description || undefined,
          }),
        });
      }
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
