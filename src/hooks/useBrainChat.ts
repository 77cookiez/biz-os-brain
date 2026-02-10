import { useState, useCallback } from 'react';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { buildMeaningFromText, createMeaningObject } from '@/lib/meaningObject';
import { guardMeaningInsert } from '@/lib/meaningGuard';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/brain-chat`;

export function useBrainChat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const { businessContext, installedApps, currentWorkspace } = useWorkspace();
  const { currentLanguage } = useLanguage();
  const { user } = useAuth();

  /** Persist a single brain message to DB with a meaning object */
  const persistMessage = useCallback(async (
    role: 'user' | 'assistant',
    content: string,
  ) => {
    if (!currentWorkspace || !user) return;

    const meaningJson = buildMeaningFromText({
      type: 'BRAIN_MESSAGE',
      title: content.slice(0, 120),
      description: content.length > 120 ? content : undefined,
      createdFrom: role === 'user' ? 'user' : 'brain',
    });

    const meaningId = await createMeaningObject({
      workspaceId: currentWorkspace.id,
      createdBy: user.id,
      type: 'BRAIN_MESSAGE',
      sourceLang: currentLanguage.code,
      meaningJson,
    });

    const payload = {
      workspace_id: currentWorkspace.id,
      user_id: user.id,
      role,
      content,
      source_lang: currentLanguage.code,
      meaning_object_id: meaningId,
    };

    guardMeaningInsert('brain_messages', payload);

    const { error } = await supabase.from('brain_messages').insert(payload);
    if (error) {
      console.error('[Brain] Failed to persist message:', error.message);
    }
  }, [currentWorkspace, user, currentLanguage.code]);

  /** Fetch current tasks & goals snapshot for assistant context */
  const fetchWorkContext = useCallback(async () => {
    if (!currentWorkspace) return undefined;
    const today = new Date().toISOString().split('T')[0];

    const [tasksRes, goalsRes] = await Promise.all([
      supabase.from('tasks').select('id, title, status, is_priority, due_date, blocked_reason')
        .eq('workspace_id', currentWorkspace.id)
        .in('status', ['backlog', 'planned', 'in_progress', 'blocked'])
        .order('is_priority', { ascending: false })
        .order('due_date', { ascending: true })
        .limit(30),
      supabase.from('goals').select('id, title, status, due_date, kpi_name, kpi_current, kpi_target')
        .eq('workspace_id', currentWorkspace.id)
        .eq('status', 'active')
        .limit(10),
    ]);

    return {
      tasks: (tasksRes.data || []).map(t => ({
        id: t.id,
        title: t.title,
        status: t.status,
        isPriority: t.is_priority,
        dueDate: t.due_date,
        isOverdue: t.due_date ? t.due_date < today : false,
        blockedReason: t.blocked_reason,
      })),
      goals: (goalsRes.data || []).map(g => ({
        id: g.id,
        title: g.title,
        status: g.status,
        dueDate: g.due_date,
        kpi: g.kpi_name ? { name: g.kpi_name, current: g.kpi_current, target: g.kpi_target } : undefined,
      })),
    };
  }, [currentWorkspace?.id]);

  const sendMessage = useCallback(async (input: string, action?: string) => {
    const userMsg: Message = { role: 'user', content: input };
    setMessages(prev => [...prev, userMsg]);
    setIsLoading(true);

    // Persist user message
    persistMessage('user', input);

    // Fetch real work context
    const workContext = await fetchWorkContext();

    let assistantSoFar = '';
    
    const upsertAssistant = (nextChunk: string) => {
      assistantSoFar += nextChunk;
      setMessages(prev => {
        const last = prev[prev.length - 1];
        if (last?.role === 'assistant') {
          return prev.map((m, i) => (i === prev.length - 1 ? { ...m, content: assistantSoFar } : m));
        }
        return [...prev, { role: 'assistant', content: assistantSoFar }];
      });
    };

    try {
      const resp = await fetch(CHAT_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({
          messages: [...messages, userMsg],
          businessContext: businessContext ? {
            businessType: businessContext.business_type,
            businessDescription: businessContext.business_description,
            primaryPain: businessContext.primary_pain,
            ninetyDayFocus: businessContext.ninety_day_focus,
            teamSize: businessContext.team_size,
            hasTeam: businessContext.has_team,
          } : undefined,
          installedApps: installedApps.filter(a => a.is_active).map(a => a.app_id),
          workContext,
          action,
          userLang: currentLanguage.code,
        }),
      });

      if (!resp.ok) {
        const errorData = await resp.json().catch(() => ({}));
        if (resp.status === 429) {
          toast.error('Rate limit exceeded. Please wait a moment.');
        } else if (resp.status === 402) {
          toast.error('AI credits exhausted. Please add more credits.');
        } else {
          toast.error(errorData.error || 'Failed to get response');
        }
        setIsLoading(false);
        return;
      }

      if (!resp.body) throw new Error('No response body');

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let textBuffer = '';
      let streamDone = false;

      while (!streamDone) {
        const { done, value } = await reader.read();
        if (done) break;
        textBuffer += decoder.decode(value, { stream: true });

        let newlineIndex: number;
        while ((newlineIndex = textBuffer.indexOf('\n')) !== -1) {
          let line = textBuffer.slice(0, newlineIndex);
          textBuffer = textBuffer.slice(newlineIndex + 1);

          if (line.endsWith('\r')) line = line.slice(0, -1);
          if (line.startsWith(':') || line.trim() === '') continue;
          if (!line.startsWith('data: ')) continue;

          const jsonStr = line.slice(6).trim();
          if (jsonStr === '[DONE]') {
            streamDone = true;
            break;
          }

          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content as string | undefined;
            if (content) upsertAssistant(content);
          } catch {
            textBuffer = line + '\n' + textBuffer;
            break;
          }
        }
      }

      // Final flush
      if (textBuffer.trim()) {
        for (let raw of textBuffer.split('\n')) {
          if (!raw) continue;
          if (raw.endsWith('\r')) raw = raw.slice(0, -1);
          if (raw.startsWith(':') || raw.trim() === '') continue;
          if (!raw.startsWith('data: ')) continue;
          const jsonStr = raw.slice(6).trim();
          if (jsonStr === '[DONE]') continue;
          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content as string | undefined;
            if (content) upsertAssistant(content);
          } catch { /* ignore */ }
        }
      }

      // Persist assistant response after stream completes
      if (assistantSoFar) {
        persistMessage('assistant', assistantSoFar);
      }
    } catch (error) {
      console.error('Chat error:', error);
      toast.error('Failed to communicate with Business Brain');
    } finally {
      setIsLoading(false);
    }
  }, [messages, businessContext, installedApps, currentLanguage.code, persistMessage, fetchWorkContext]);

  const clearMessages = useCallback(() => {
    setMessages([]);
  }, []);

  return {
    messages,
    isLoading,
    sendMessage,
    clearMessages,
    setMessages,
  };
}
