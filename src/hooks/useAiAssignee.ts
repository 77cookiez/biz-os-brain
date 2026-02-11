import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { useLanguage } from '@/contexts/LanguageContext';

interface TeamMemberInfo {
  user_id: string;
  full_name: string;
  team_role: string;
  taskCount: number;
  blockedCount: number;
}

interface SuggestionResult {
  user_id: string;
  reason: string;
}

export function useAiAssignee() {
  const [suggesting, setSuggesting] = useState(false);
  const { user } = useAuth();
  const { currentWorkspace } = useWorkspace();
  const { currentLanguage } = useLanguage();

  const suggestAssignee = async (
    taskTitle: string,
    taskDescription: string,
    teamMembers: TeamMemberInfo[]
  ): Promise<SuggestionResult | null> => {
    if (!user || !currentWorkspace || teamMembers.length === 0) return null;

    setSuggesting(true);
    try {
      const memberList = teamMembers
        .map(m => `- ${m.full_name} (user_id: ${m.user_id}, Role: ${m.team_role}, Active tasks: ${m.taskCount}, Blocked: ${m.blockedCount})`)
        .join('\n');

      const prompt = `TASK:\n- Title: ${taskTitle}\n- Description: ${taskDescription || 'No description'}\n\nTEAM MEMBERS:\n${memberList}`;

      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;
      if (!token) return null;

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/brain-chat`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify({
            messages: [{ role: 'user', content: prompt }],
            action: 'suggest_assignee',
            userLang: currentLanguage.code,
            workspaceId: currentWorkspace.id,
          }),
        }
      );

      if (!response.ok) return null;

      // Parse SSE stream
      const reader = response.body?.getReader();
      if (!reader) return null;

      let fullText = '';
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n');
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6).trim();
            if (data === '[DONE]') continue;
            try {
              const parsed = JSON.parse(data);
              const content = parsed.choices?.[0]?.delta?.content;
              if (content) fullText += content;
            } catch {
              // skip malformed chunks
            }
          }
        }
      }

      // Extract JSON from response
      const jsonMatch = fullText.match(/\{[\s\S]*"user_id"[\s\S]*"reason"[\s\S]*\}/);
      if (jsonMatch) {
        const result = JSON.parse(jsonMatch[0]) as SuggestionResult;
        if (result.user_id && result.reason) return result;
      }

      return null;
    } catch (err) {
      console.error('AI assignee suggestion failed:', err);
      return null;
    } finally {
      setSuggesting(false);
    }
  };

  return { suggestAssignee, suggesting };
}
