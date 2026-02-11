import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useTranslation } from 'react-i18next';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Sparkles, Loader2, RefreshCw } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { InsightsServerResponse } from '@/hooks/useInsights';

const BRAIN_CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/brain-chat`;

interface InsightsNarrativeProps {
  data: InsightsServerResponse;
  weekStart: string;
  weekEnd: string;
}

export function InsightsNarrative({ data, weekStart, weekEnd }: InsightsNarrativeProps) {
  const { t } = useTranslation();
  const { currentLanguage, contentLocale } = useLanguage();
  const [narrative, setNarrative] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const targetLang = contentLocale || currentLanguage.code;

  const generateNarrative = useCallback(async () => {
    setLoading(true);
    setError(null);

    const { weekly, blockers } = data;
    const totalBlockers = blockers.blocked_tasks.length + blockers.stale_tasks.length;

    // Build a factual summary prompt from insights data only
    const factSheet = [
      `Week: ${weekStart} to ${weekEnd}`,
      `Tasks created: ${weekly.tasks_created}`,
      `Tasks completed: ${weekly.tasks_completed}`,
      `Tasks blocked: ${weekly.tasks_blocked}`,
      `Tasks from chat: ${weekly.tasks_from_chat}`,
      `Goals created: ${weekly.goals_created}`,
      `Total blockers needing attention: ${totalBlockers}`,
    ].join('\n');

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const accessToken = session?.access_token;
      if (!accessToken) {
        setError('Please sign in first');
        return;
      }

      const resp = await fetch(BRAIN_CHAT_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          messages: [
            {
              role: 'system',
              content: `You are a concise business insights narrator. Given ONLY the factual data below, write a single short paragraph (2-3 sentences max) summarizing the week's activity. 
Rules:
- Do NOT invent facts or numbers not in the data
- Do NOT add advice, recommendations, or action items
- Do NOT add greetings or sign-offs
- Do NOT include any code blocks, JSON, or structured data in your response
- Write in ${targetLang}
- Keep it neutral and factual
- This is a summary, not analysis

Data:
${factSheet}`,
            },
            {
              role: 'user',
              content: 'Summarize this week in a brief paragraph.',
            },
          ],
          stream: false,
        }),
      });

      if (!resp.ok) {
        setError(t('insights.narrativeError', 'Could not generate summary'));
        return;
      }

      // brain-chat always returns SSE stream — parse it
      const reader = resp.body?.getReader();
      if (!reader) {
        setError(t('insights.narrativeError', 'Could not generate summary'));
        return;
      }

      const decoder = new TextDecoder();
      let fullText = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const data = line.slice(6).trim();
          if (data === '[DONE]') continue;

          try {
            const parsed = JSON.parse(data);
            const delta = parsed.choices?.[0]?.delta?.content;
            if (delta) fullText += delta;
          } catch {
            // skip malformed lines
          }
        }
      }

      // Strip any ULL_MEANING_V1 blocks the AI may have included
      const cleaned = fullText.replace(/```ULL_MEANING_V1[\s\S]*?```/g, '').trim();

      if (cleaned) {
        setNarrative(cleaned);
      } else {
        setError(t('insights.narrativeError', 'Could not generate summary'));
      }
    } catch {
      setError(t('insights.narrativeError', 'Could not generate summary'));
    } finally {
      setLoading(false);
    }
  }, [data, weekStart, weekEnd, targetLang, t]);

  return (
    <Card className="border-border bg-card overflow-hidden">
      <CardContent className="p-4">
        {narrative ? (
          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <Sparkles className="h-4 w-4 text-primary mt-0.5 shrink-0" />
              <p className="text-sm text-foreground leading-relaxed">{narrative}</p>
            </div>
            <div className="flex justify-end">
              <Button
                variant="ghost"
                size="sm"
                onClick={generateNarrative}
                disabled={loading}
                className="text-xs text-muted-foreground gap-1"
              >
                <RefreshCw className={`h-3 w-3 ${loading ? 'animate-spin' : ''}`} />
                {t('insights.regenerate', 'Regenerate')}
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              <span className="text-sm text-muted-foreground">
                {t('insights.narrativePrompt', 'Get a quick AI summary of your week')}
              </span>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={generateNarrative}
              disabled={loading}
              className="gap-1.5"
            >
              {loading ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Sparkles className="h-3.5 w-3.5" />
              )}
              {t('insights.summarize', 'Summarize')}
            </Button>
          </div>
        )}
        {error && (
          <p className="text-xs text-destructive mt-2">{error}</p>
        )}
      </CardContent>
    </Card>
  );
}
