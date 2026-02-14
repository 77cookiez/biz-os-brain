import { useState, useCallback } from 'react';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { buildMeaningFromText, createMeaningObject } from '@/lib/meaningObject';
import { guardMeaningInsert } from '@/lib/meaningGuard';
import type { BrainProposal } from '@/hooks/useBrainExecute';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface BrainMeta {
  intent: string;
  confidence: number;
  risk_level: string;
  modules_consulted: string[];
  simulation_used: boolean;
}

interface BrainArtifacts {
  cleanText: string;
  meta: BrainMeta | null;
  proposals: BrainProposal[];
}

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/brain-chat`;

const BRAIN_META_REGEX = /```BRAIN_META\s*\n([\s\S]*?)```/;
const BRAIN_PROPOSALS_REGEX = /```BRAIN_PROPOSALS\s*\n([\s\S]*?)```/;

/** Strip BRAIN_META and BRAIN_PROPOSALS blocks from visible text; parse both */
function extractBrainArtifacts(text: string): BrainArtifacts {
  let cleanText = text;
  let meta: BrainMeta | null = null;
  let proposals: BrainProposal[] = [];

  // Extract BRAIN_META
  const metaMatch = cleanText.match(BRAIN_META_REGEX);
  if (metaMatch) {
    cleanText = cleanText.replace(BRAIN_META_REGEX, '');
    try { meta = JSON.parse(metaMatch[1].trim()); } catch { /* ignore */ }
  }

  // Extract BRAIN_PROPOSALS
  const proposalsMatch = cleanText.match(BRAIN_PROPOSALS_REGEX);
  if (proposalsMatch) {
    cleanText = cleanText.replace(BRAIN_PROPOSALS_REGEX, '');
    try { proposals = JSON.parse(proposalsMatch[1].trim()); } catch { /* ignore */ }
  }

  return { cleanText: cleanText.trimEnd(), meta, proposals };
}

export function useBrainChat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [lastMeta, setLastMeta] = useState<BrainMeta | null>(null);
  const [lastProposals, setLastProposals] = useState<BrainProposal[]>([]);
  const { businessContext, installedApps, currentWorkspace } = useWorkspace();
  const { currentLanguage, contentLocale } = useLanguage();
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

  /**
   * Log BRAIN_META to org_events for OIL ingestion.
   * Schema contract: event_type='brain_meta', object_type='brain_message', metadata=BrainMeta.
   * NOTE: object_id (brain_message_id) is not available here because message persistence is async.
   * When message persistence returns an ID in the future, it can be added here.
   */
  const logBrainMeta = useCallback(async (meta: BrainMeta) => {
    if (!currentWorkspace || !user) return;
    try {
      await supabase.from('org_events').insert({
        workspace_id: currentWorkspace.id,
        event_type: 'brain_meta',
        object_type: 'brain_message',
        metadata: meta as any,
      });
    } catch (e) {
      console.warn('[Brain] Failed to log meta to org_events:', e);
    }
  }, [currentWorkspace, user]);

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

  /** Build lightweight system context for the edge function */
  const buildSystemContext = useCallback(() => {
    if (!currentWorkspace) return undefined;

    const activeApps = installedApps.filter(a => a.is_active).map(a => a.app_id);

    return {
      user_role: 'member' as string, // Server will verify actual role
      installed_modules: activeApps.map(appId => ({
        id: appId,
        name: appId,
        actions: [] as { key: string; title: string; description: string }[], // Server builds full actions
      })),
    };
  }, [currentWorkspace, installedApps]);

  const sendMessage = useCallback(async (input: string, action?: string, intentOverride?: string) => {
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
      // Strip BRAIN_META and BRAIN_PROPOSALS from display in real-time
      const { cleanText } = extractBrainArtifacts(assistantSoFar);
      setMessages(prev => {
        const last = prev[prev.length - 1];
        if (last?.role === 'assistant') {
          return prev.map((m, i) => (i === prev.length - 1 ? { ...m, content: cleanText } : m));
        }
        return [...prev, { role: 'assistant', content: cleanText }];
      });
    };

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const accessToken = session?.access_token;
      if (!accessToken) {
        toast.error('Please sign in to use Brain');
        setIsLoading(false);
        return;
      }

      const systemCtx = buildSystemContext();

      const resp = await fetch(CHAT_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
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
          // installedApps still sent for backwards compat but server ignores it (Fix A)
          installedApps: installedApps.filter(a => a.is_active).map(a => a.app_id),
          systemContext: systemCtx,
          workContext,
          action,
          intentOverride,
          userLang: contentLocale || currentLanguage.code,
          workspaceId: currentWorkspace?.id,
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

      // ─── PART B: Robust SSE parser using \n\n event boundaries ───
      // SSE spec: events separated by \n\n. Each event may have multiple data: lines.
      // This handles gateways that split JSON across chunks or send multi-line data.
      const processEvent = (eventBlock: string): boolean => {
        if (!eventBlock.trim()) return false;
        const dataLines: string[] = [];
        for (const line of eventBlock.split('\n')) {
          const trimmed = line.endsWith('\r') ? line.slice(0, -1) : line;
          if (trimmed.startsWith(':') || trimmed.trim() === '') continue;
          if (trimmed.startsWith('data: ')) dataLines.push(trimmed.slice(6));
        }
        if (dataLines.length === 0) return false;
        const jsonStr = dataLines.join('').trim();
        if (jsonStr === '[DONE]') return true; // signal done
        try {
          const parsed = JSON.parse(jsonStr);
          const content = parsed.choices?.[0]?.delta?.content as string | undefined;
          if (content) upsertAssistant(content);
        } catch { /* incomplete — ignored at boundary level */ }
        return false;
      };

      while (!streamDone) {
        const { done, value } = await reader.read();
        if (done) break;
        textBuffer += decoder.decode(value, { stream: true });

        let boundaryIndex: number;
        while ((boundaryIndex = textBuffer.indexOf('\n\n')) !== -1) {
          const eventBlock = textBuffer.slice(0, boundaryIndex);
          textBuffer = textBuffer.slice(boundaryIndex + 2);
          if (processEvent(eventBlock)) { streamDone = true; break; }
        }
      }

      // Final flush: process remaining data (may lack trailing \n\n)
      if (textBuffer.trim()) {
        for (const eventBlock of textBuffer.split('\n\n')) {
          processEvent(eventBlock);
        }
      }

      // Extract BRAIN_META + BRAIN_PROPOSALS, clean display, log to OIL
      if (assistantSoFar) {
        const { cleanText, meta, proposals } = extractBrainArtifacts(assistantSoFar);

        // Ensure final message is clean (no artifacts)
        setMessages(prev => {
          const last = prev[prev.length - 1];
          if (last?.role === 'assistant') {
            return prev.map((m, i) => (i === prev.length - 1 ? { ...m, content: cleanText } : m));
          }
          return prev;
        });

        // Store meta internally
        if (meta) {
          setLastMeta(meta);
          logBrainMeta(meta);
        }

        // Store proposals for downstream use (ProposalCard, sign/execute flow)
        setLastProposals(proposals);

        // Persist clean assistant response
        persistMessage('assistant', cleanText);
      }
    } catch (error) {
      console.error('Chat error:', error);
      toast.error('Failed to communicate with Business Brain');
    } finally {
      setIsLoading(false);
    }
  }, [messages, businessContext, installedApps, currentLanguage.code, contentLocale, persistMessage, fetchWorkContext, buildSystemContext, logBrainMeta]);

  const clearMessages = useCallback(() => {
    setMessages([]);
    setLastMeta(null);
    setLastProposals([]);
  }, []);

  return {
    messages,
    isLoading,
    sendMessage,
    clearMessages,
    setMessages,
    lastMeta,
    lastProposals,
  };
}
