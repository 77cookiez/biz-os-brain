import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  CheckCircle2, ShieldAlert, MessageSquare, Target,
  TrendingUp, Sparkles, X, ArrowRight, Loader2
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';

interface DigestStats {
  tasks_created: number;
  tasks_completed: number;
  tasks_blocked: number;
  tasks_from_chat: number;
  goals_created: number;
}

interface DigestData {
  id: string;
  week_start: string;
  week_end: string;
  stats: DigestStats;
  blockers_summary: any[];
  decisions_summary: { tasks_from_chat_count: number; goals_from_chat_count: number };
  narrative_text: string | null;
  read_at: string | null;
}

export function WeeklyDigestCard() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { currentWorkspace } = useWorkspace();
  const { user } = useAuth();
  const { currentLanguage, contentLocale } = useLanguage();
  const [digest, setDigest] = useState<DigestData | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  const fetchDigest = useCallback(async () => {
    if (!currentWorkspace?.id || !user?.id) {
      setLoading(false);
      return;
    }

    // Get current week's Monday
    const now = new Date();
    const dayOfWeek = now.getDay();
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - ((dayOfWeek + 6) % 7));
    const weekStartStr = weekStart.toISOString().split('T')[0];

    const { data, error } = await supabase
      .from('weekly_digests')
      .select('*')
      .eq('user_id', user.id)
      .eq('workspace_id', currentWorkspace.id)
      .eq('week_start', weekStartStr)
      .maybeSingle();

    if (data && !error) {
      setDigest(data as any);
      // If already read, don't show
      if (data.read_at) {
        setDismissed(true);
      }
    } else if (!data) {
      // Try to generate digest on first visit
      await generateDigest();
    }

    setLoading(false);
  }, [currentWorkspace?.id, user?.id]);

  const generateDigest = useCallback(async () => {
    if (!currentWorkspace?.id || !user?.id) return;
    setGenerating(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      const targetLang = contentLocale || currentLanguage.code;

      const resp = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/weekly-digest`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify({
            workspace_id: currentWorkspace.id,
            user_id: user.id,
            content_locale: targetLang,
            send_email: false, // Don't send email on manual generation
          }),
        }
      );

      if (resp.ok) {
        const result = await resp.json();
        if (result.digest) {
          setDigest(result.digest as any);
        } else if (result.skipped && result.digest_id) {
          // Already exists, refetch
          await fetchDigest();
        }
      }
    } catch (e) {
      console.error('Failed to generate digest:', e);
    } finally {
      setGenerating(false);
    }
  }, [currentWorkspace?.id, user?.id, contentLocale, currentLanguage.code]);

  useEffect(() => {
    fetchDigest();
  }, [fetchDigest]);

  const handleDismiss = async () => {
    setDismissed(true);
    if (digest?.id) {
      await supabase
        .from('weekly_digests')
        .update({ read_at: new Date().toISOString() } as any)
        .eq('id', digest.id);
    }
  };

  const handleViewInsights = () => {
    handleDismiss();
    navigate('/insights');
  };

  if (loading || dismissed || !digest) {
    if (generating) {
      return (
        <Card className="border-border bg-card mb-4">
          <CardContent className="py-6 flex items-center justify-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin text-primary" />
            <span className="text-sm text-muted-foreground">{t('digest.generating', 'Preparing your weekly digest...')}</span>
          </CardContent>
        </Card>
      );
    }
    return null;
  }

  const stats = digest.stats;
  const isEmpty =
    stats.tasks_created === 0 &&
    stats.tasks_completed === 0 &&
    stats.tasks_blocked === 0;

  return (
    <Card className="border-primary/20 bg-card mb-4 overflow-hidden">
      <CardContent className="p-5">
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="text-base font-semibold text-foreground flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              {t('digest.title', 'Your week at a glance')}
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              {digest.week_start} — {digest.week_end}
            </p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 shrink-0"
            onClick={handleDismiss}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {isEmpty ? (
          <p className="text-sm text-muted-foreground">
            {digest.narrative_text || t('digest.empty', "Nothing major happened this week — but you're all set for the next one.")}
          </p>
        ) : (
          <>
            {/* Bullet highlights */}
            <ul className="space-y-2 mb-4">
              {stats.tasks_completed > 0 && (
                <li className="flex items-center gap-2 text-sm text-foreground">
                  <CheckCircle2 className="h-3.5 w-3.5 text-green-500 shrink-0" />
                  {t('digest.completed', 'You completed {{count}} tasks', { count: stats.tasks_completed })}
                </li>
              )}
              {stats.tasks_created > 0 && (
                <li className="flex items-center gap-2 text-sm text-foreground">
                  <TrendingUp className="h-3.5 w-3.5 text-primary shrink-0" />
                  {t('digest.created', '{{count}} new tasks created', { count: stats.tasks_created })}
                </li>
              )}
              {stats.tasks_blocked > 0 && (
                <li className="flex items-center gap-2 text-sm text-foreground">
                  <ShieldAlert className="h-3.5 w-3.5 text-orange-500 shrink-0" />
                  {t('digest.blocked', '{{count}} items are currently blocked', { count: stats.tasks_blocked })}
                </li>
              )}
              {(digest.decisions_summary?.tasks_from_chat_count > 0 ||
                digest.decisions_summary?.goals_from_chat_count > 0) && (
                <li className="flex items-center gap-2 text-sm text-foreground">
                  <MessageSquare className="h-3.5 w-3.5 text-blue-500 shrink-0" />
                  {t('digest.decisions', '{{count}} decisions emerged from conversations', {
                    count:
                      (digest.decisions_summary?.tasks_from_chat_count || 0) +
                      (digest.decisions_summary?.goals_from_chat_count || 0),
                  })}
                </li>
              )}
            </ul>

            {/* Narrative */}
            {digest.narrative_text && (
              <p className="text-sm text-muted-foreground italic border-l-2 border-primary/20 pl-3 mb-4">
                {digest.narrative_text}
              </p>
            )}
          </>
        )}

        {/* CTA */}
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5"
          onClick={handleViewInsights}
        >
          {t('digest.openInsights', 'Open Insights')}
          <ArrowRight className="h-3.5 w-3.5" />
        </Button>
      </CardContent>
    </Card>
  );
}
