import { useState, useCallback } from 'react';
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
      const resp = await fetch(BRAIN_CHAT_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
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

      // Handle both streaming and non-streaming responses
      const text = await resp.text();
      
      // Try to parse as JSON first
      try {
        const json = JSON.parse(text);
        if (json.choices?.[0]?.message?.content) {
          setNarrative(json.choices[0].message.content.trim());
        } else if (json.content) {
          setNarrative(json.content.trim());
        } else {
          // It might be a plain text response from brain-chat
          setNarrative(text.trim());
        }
      } catch {
        // Plain text response
        setNarrative(text.trim());
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
