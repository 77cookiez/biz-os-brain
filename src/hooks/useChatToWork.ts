import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { createMeaningObject } from '@/lib/meaningObject';
import { guardMeaningInsert } from '@/lib/meaningGuard';
import { toast } from 'sonner';
import type { MeaningJsonV1 } from '@/lib/meaningObject';
import type { ChatMessage } from '@/hooks/useChatMessages';

/**
 * Hook for turning chat messages into tasks and conversations into goals.
 * Creates NEW meaning objects — never reuses the chat message's meaning_object_id.
 */
export function useChatToWork() {
  const { currentWorkspace } = useWorkspace();
  const { user } = useAuth();
  const { currentLanguage } = useLanguage();

  /**
   * Create a Task from a single chat message.
   * Creates a new meaning object of type TASK derived from the message meaning.
   */
  const createTaskFromMessage = useCallback(async (message: ChatMessage): Promise<boolean> => {
    if (!currentWorkspace || !user) return false;

    const sourceMeaning = message.meaning_json;
    const subject = (sourceMeaning?.subject as string) || (sourceMeaning?.description as string) || 'Task from chat';
    const description = (sourceMeaning?.description as string) || '';

    // Create a NEW meaning object for the task
    const taskMeaning: MeaningJsonV1 = {
      version: 'v1',
      type: 'TASK',
      intent: 'create',
      subject,
      description,
      metadata: {
        created_from: 'user',
        source: 'chat',
        source_message_id: message.id,
        source_thread_id: message.thread_id,
      },
    };

    const meaningId = await createMeaningObject({
      workspaceId: currentWorkspace.id,
      createdBy: user.id,
      type: 'TASK',
      sourceLang: message.source_lang || currentLanguage.code,
      meaningJson: taskMeaning,
    });

    if (!meaningId) {
      toast.error('Failed to create task');
      return false;
    }

    // Insert the task
    const insertPayload = {
      workspace_id: currentWorkspace.id,
      created_by: user.id,
      title: subject,
      description: description || null,
      status: 'backlog' as const,
      is_priority: false,
      source_lang: message.source_lang || currentLanguage.code,
      meaning_object_id: meaningId,
    };

    guardMeaningInsert('tasks', insertPayload);

    const { error } = await supabase.from('tasks').insert(insertPayload as any);

    if (error) {
      console.error('[ChatToWork] Failed to create task:', error.message);
      toast.error('Failed to create task');
      return false;
    }

    toast.success('Task created in Workboard');
    return true;
  }, [currentWorkspace?.id, user?.id, currentLanguage.code]);

  /**
   * Create a Goal from a thread conversation.
   * Collects recent messages and creates a meaning object of type GOAL.
   */
  const createGoalFromThread = useCallback(async (threadId: string): Promise<boolean> => {
    if (!currentWorkspace || !user) return false;

    // Fetch recent messages from the thread
    const { data: messages } = await supabase
      .from('chat_messages')
      .select('*, meaning_objects(meaning_json)')
      .eq('thread_id', threadId)
      .order('created_at', { ascending: false })
      .limit(20);

    if (!messages || messages.length === 0) {
      toast.error('No messages to create a goal from');
      return false;
    }

    // Derive a goal subject from the conversation
    // Use the first few message descriptions as context
    const descriptions = messages
      .map((m: any) => (m.meaning_objects?.meaning_json?.description as string) || '')
      .filter(Boolean)
      .reverse() // oldest first
      .slice(0, 5);

    const goalSubject = descriptions[0] || 'Goal from conversation';
    const goalDescription = descriptions.length > 1
      ? descriptions.join(' → ')
      : goalSubject;

    const goalMeaning: MeaningJsonV1 = {
      version: 'v1',
      type: 'GOAL',
      intent: 'plan',
      subject: goalSubject,
      description: goalDescription,
      metadata: {
        created_from: 'user',
        source: 'chat',
      },
    };

    const meaningId = await createMeaningObject({
      workspaceId: currentWorkspace.id,
      createdBy: user.id,
      type: 'GOAL',
      sourceLang: currentLanguage.code,
      meaningJson: goalMeaning,
    });

    if (!meaningId) {
      toast.error('Failed to create goal');
      return false;
    }

    const { error } = await supabase.from('goals').insert({
      workspace_id: currentWorkspace.id,
      created_by: user.id,
      title: goalSubject,
      description: goalDescription || null,
      status: 'active',
      source_lang: currentLanguage.code,
      meaning_object_id: meaningId,
    });

    if (error) {
      console.error('[ChatToWork] Failed to create goal:', error.message);
      toast.error('Failed to create goal');
      return false;
    }

    toast.success('Goal created in Workboard');
    return true;
  }, [currentWorkspace?.id, user?.id, currentLanguage.code]);

  return { createTaskFromMessage, createGoalFromThread };
}
