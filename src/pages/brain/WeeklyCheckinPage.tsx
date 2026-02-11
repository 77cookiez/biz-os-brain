import { useState, useEffect, useCallback } from 'react';
import { Calendar, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { useAuth } from '@/contexts/AuthContext';
import { useBrainChat } from '@/hooks/useBrainChat';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { useOILIndicators } from '@/hooks/useOILIndicators';
import StepWeekGlance from '@/components/checkin/StepWeekGlance';
import StepGoalReview, { type GoalReview } from '@/components/checkin/StepGoalReview';
import StepCompleted from '@/components/checkin/StepCompleted';
import StepIDS, { type IssueItem } from '@/components/checkin/StepIDS';
import StepPriorities, { type SuggestedPriority } from '@/components/checkin/StepPriorities';
import StepSummaryActions, { type ActionItem } from '@/components/checkin/StepSummaryActions';

const TOTAL_STEPS = 6;

export default function WeeklyCheckinPage() {
  const [step, setStep] = useState(1);
  const [completedItems, setCompletedItems] = useState<string[]>([]);
  const [goalReviews, setGoalReviews] = useState<GoalReview[]>([]);
  const [issues, setIssues] = useState<IssueItem[]>([]);
  const [suggestedPriorities, setSuggestedPriorities] = useState<SuggestedPriority[]>([]);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const [manualPriorities, setManualPriorities] = useState(['', '', '']);
  const [manualSuggestionsLoading, setManualSuggestionsLoading] = useState(false);
  const [actionItems, setActionItems] = useState<ActionItem[]>([]);
  const [summary, setSummary] = useState<string | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [taskStats, setTaskStats] = useState({ completed: 0, total: 0, blocked: 0, overdue: 0 });

  const { currentWorkspace } = useWorkspace();
  const { user } = useAuth();
  const { sendMessage, messages, isLoading } = useBrainChat();
  const { coreIndicators } = useOILIndicators();
  const { t } = useTranslation();

  const weekStart = new Date();
  weekStart.setDate(weekStart.getDate() - weekStart.getDay());
  const weekLabel = weekStart.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

  // Fetch data on mount
  useEffect(() => {
    if (currentWorkspace) {
      fetchAllData();
    }
  }, [currentWorkspace?.id]);

  const fetchAllData = async () => {
    if (!currentWorkspace) return;
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const today = new Date().toISOString();

    const [completedRes, blockedRes, allTasksRes, goalsRes] = await Promise.all([
      supabase.from('tasks').select('id, title, status')
        .eq('workspace_id', currentWorkspace.id).eq('status', 'done').gte('completed_at', weekAgo),
      supabase.from('tasks').select('id, title, status, blocked_reason')
        .eq('workspace_id', currentWorkspace.id).eq('status', 'blocked'),
      supabase.from('tasks').select('id, title, status, due_date')
        .eq('workspace_id', currentWorkspace.id).neq('status', 'done'),
      supabase.from('goals').select('id, title, status, kpi_current, kpi_target, kpi_name')
        .eq('workspace_id', currentWorkspace.id).eq('status', 'active'),
    ]);

    const completed = completedRes.data || [];
    const blocked = blockedRes.data || [];
    const allTasks = allTasksRes.data || [];
    const goals = goalsRes.data || [];

    setCompletedItems(completed.map(t => t.title));

    const overdue = allTasks.filter(t => t.due_date && new Date(t.due_date) < new Date());
    setTaskStats({ completed: completed.length, total: allTasks.length, blocked: blocked.length, overdue: overdue.length });

    // Goal reviews
    setGoalReviews(goals.map(g => ({
      goalId: g.id,
      title: g.title,
      status: 'pending' as const,
      kpiCurrent: g.kpi_current,
      kpiTarget: g.kpi_target,
      kpiName: g.kpi_name,
    })));

    // IDS: blocked tasks become issues
    const blockedIssues: IssueItem[] = blocked.map(t => ({
      id: `blocked-${t.id}`,
      issue: `${t.title}${t.blocked_reason ? ` — ${t.blocked_reason}` : ''}`,
      source: 'blocked' as const,
    }));
    setIssues(blockedIssues);
  };

  // When goals are marked off-track, add to issues
  const handleGoalStatusUpdate = (goalId: string, status: 'on_track' | 'off_track') => {
    setGoalReviews(prev => prev.map(g => g.goalId === goalId ? { ...g, status } : g));
    if (status === 'off_track') {
      const goal = goalReviews.find(g => g.goalId === goalId);
      if (goal && !issues.some(i => i.id === `goal-${goalId}`)) {
        setIssues(prev => [...prev, {
          id: `goal-${goalId}`,
          issue: goal.title,
          source: 'off_track',
        }]);
      }
    } else {
      setIssues(prev => prev.filter(i => i.id !== `goal-${goalId}`));
    }
  };

  // IDS: request AI solution for an issue
  const handleRequestSolution = async (issueId: string) => {
    setIssues(prev => prev.map(i => i.id === issueId ? { ...i, loading: true } : i));
    const issue = issues.find(i => i.id === issueId);
    if (!issue) return;

    const prompt = `You are helping with a weekly business review (IDS — Identify, Discuss, Solve).

The issue is: "${issue.issue}"
Source: ${issue.source === 'blocked' ? 'This is a blocked task' : 'This is an off-track goal'}

Suggest ONE practical, actionable solution in 2-3 lines maximum. Be specific, not generic. Respond in the user's language.`;

    await sendMessage(prompt, 'weekly_checkin_ids');

    // Get the AI response
    setTimeout(() => {
      const lastMsg = messages.filter(m => m.role === 'assistant').pop();
      setIssues(prev => prev.map(i =>
        i.id === issueId ? { ...i, loading: false, resolution: lastMsg?.content || '' } : i
      ));
    }, 500);
  };

  // Watch for new AI messages to update IDS resolutions
  useEffect(() => {
    const loadingIssue = issues.find(i => i.loading);
    if (!isLoading && loadingIssue) {
      const lastMsg = messages.filter(m => m.role === 'assistant').pop();
      if (lastMsg) {
        setIssues(prev => prev.map(i =>
          i.loading ? { ...i, loading: false, resolution: lastMsg.content } : i
        ));
      }
    }
  }, [isLoading, messages]);

  const handleAcceptResolution = (issueId: string) => {
    setIssues(prev => prev.map(i => i.id === issueId ? { ...i, accepted: true } : i));
    const issue = issues.find(i => i.id === issueId);
    if (issue?.resolution) {
      setActionItems(prev => [...prev, { title: issue.resolution!, type: 'task', applied: false }]);
    }
  };

  const handleSkipResolution = (issueId: string) => {
    setIssues(prev => prev.map(i => i.id === issueId ? { ...i, accepted: false } : i));
  };

  const handleEditResolution = (issueId: string, newText: string) => {
    setIssues(prev => prev.map(i => i.id === issueId ? { ...i, resolution: newText } : i));
  };

  // Priorities: request AI suggestions (top card)
  const handleRequestPriorities = async () => {
    setSuggestionsLoading(true);
    const prompt = `Based on the current business context, suggest exactly 3 priorities for next week. 
Each priority should be a specific, actionable task title (one line each).
Format: Return each priority on a separate line, numbered 1-3. No explanations needed.`;

    await sendMessage(prompt, 'weekly_checkin_priorities');
    setSuggestionsLoading(false);
  };

  // Priorities: AI suggest for manual fields (context-rich)
  const handleSuggestManualPriorities = async () => {
    setManualSuggestionsLoading(true);

    // Build rich context
    const oilContext = coreIndicators.map(ind =>
      `- ${ind.indicator_key}: ${ind.score}/100 (trend: ${ind.trend})`
    ).join('\n');

    const offTrackGoals = goalReviews
      .filter(g => g.status === 'off_track')
      .map(g => g.title);

    const idsDecisions = issues
      .filter(i => i.accepted && i.resolution)
      .map(i => i.resolution!);

    const prompt = `You are a business strategy advisor. Based on the following workspace data, suggest exactly 3 priorities for next week.

OIL INDICATORS:
${oilContext || '- No indicators available yet'}

THIS WEEK:
- Completed: ${taskStats.completed} tasks
- Overdue: ${taskStats.overdue} tasks
- Blocked: ${taskStats.blocked} tasks
- Off-track goals: ${offTrackGoals.length > 0 ? offTrackGoals.join(', ') : 'None'}
- IDS decisions taken: ${idsDecisions.length > 0 ? idsDecisions.join('; ') : 'None'}

Rules:
- Return ONLY 3 numbered lines (1. 2. 3.)
- Each line is a specific, actionable task title
- No explanations, no bullets, no markdown
- Respond in the user's language`;

    await sendMessage(prompt, 'weekly_checkin_priorities');
    setManualSuggestionsLoading(false);
  };

  // Watch for manual suggestion results
  useEffect(() => {
    if (!manualSuggestionsLoading && step === 5) {
      // Only fill manual if they are all empty (fresh suggestion)
      const lastMsg = messages.filter(m => m.role === 'assistant').pop();
      if (lastMsg?.content && manualPriorities.every(p => p === '')) {
        const lines = lastMsg.content.split('\n').filter(l => l.trim()).slice(0, 3);
        const parsed = lines.map(line => line.replace(/^\d+[\.\)]\s*/, '').trim());
        if (parsed.length > 0 && parsed[0]) {
          const updated = ['', '', ''];
          parsed.forEach((p, i) => { if (i < 3) updated[i] = p; });
          setManualPriorities(updated);
        }
      }
    }
  }, [isLoading, messages]);

  useEffect(() => {
    if (!suggestionsLoading && suggestedPriorities.length === 0) {
      const lastMsg = messages.filter(m => m.role === 'assistant').pop();
      if (lastMsg?.content && step === 5) {
        const lines = lastMsg.content.split('\n').filter(l => l.trim()).slice(0, 3);
        const parsed = lines.map((line, i) => ({
          id: `sp-${i}`,
          title: line.replace(/^\d+[\.\)]\s*/, '').trim(),
          accepted: undefined as boolean | undefined,
        }));
        if (parsed.length > 0 && parsed[0].title) {
          setSuggestedPriorities(parsed);
        }
      }
    }
  }, [isLoading, messages, step]);

  const handleAcceptPriority = (id: string) => {
    setSuggestedPriorities(prev => prev.map(p => p.id === id ? { ...p, accepted: true } : p));
    const p = suggestedPriorities.find(x => x.id === id);
    if (p) {
      setActionItems(prev => [...prev, { title: p.title, type: 'task', applied: false }]);
    }
  };

  const handleRejectPriority = (id: string) => {
    setSuggestedPriorities(prev => prev.map(p => p.id === id ? { ...p, accepted: false } : p));
  };

  const handleEditPriority = (id: string, newTitle: string) => {
    setSuggestedPriorities(prev => prev.map(p => p.id === id ? { ...p, title: newTitle } : p));
  };

  // Step 6: Generate summary
  const handleGenerateSummary = async () => {
    setSummaryLoading(true);

    // Collect all manual priorities that have text
    const manualItems = manualPriorities.filter(p => p.trim());
    manualItems.forEach(p => {
      if (!actionItems.some(a => a.title === p)) {
        setActionItems(prev => [...prev, { title: p, type: 'task', applied: false }]);
      }
    });

    const prompt = `Generate a concise weekly check-in summary (3-4 lines maximum).

WEEK DATA:
- Completed: ${completedItems.length} tasks
- Goals reviewed: ${goalReviews.filter(g => g.status !== 'pending').length} (on-track: ${goalReviews.filter(g => g.status === 'on_track').length}, off-track: ${goalReviews.filter(g => g.status === 'off_track').length})
- Issues addressed: ${issues.filter(i => i.accepted !== undefined).length}
- Action items agreed: ${actionItems.length}

Keep it brief and actionable. Focus on decisions made, not data collected.`;

    await sendMessage(prompt, 'weekly_checkin');
    setSummaryLoading(false);
  };

  useEffect(() => {
    if (!summaryLoading && !summary && step === 6) {
      const lastMsg = messages.filter(m => m.role === 'assistant').pop();
      if (lastMsg?.content) {
        setSummary(lastMsg.content);
      }
    }
  }, [isLoading, messages, step]);

  // Save & Apply
  const handleSaveAndApply = async () => {
    if (!currentWorkspace || !user) return;
    setSaving(true);

    // Create tasks from accepted action items
    const tasksToCreate = actionItems.filter(a => a.type === 'task' && !a.applied);
    for (const item of tasksToCreate) {
      await supabase.from('tasks').insert({
        title: item.title,
        workspace_id: currentWorkspace.id,
        created_by: user.id,
        status: 'planned',
        week_bucket: weekStart.toISOString().split('T')[0],
      });
    }
    setActionItems(prev => prev.map(a => ({ ...a, applied: true })));

    // Build OIL snapshot
    const oilSnapshot: Record<string, any> = {};
    coreIndicators.forEach(ind => {
      oilSnapshot[ind.indicator_key] = { score: ind.score, trend: ind.trend };
    });

    // Save checkin
    const { error } = await supabase.from('weekly_checkins').insert({
      workspace_id: currentWorkspace.id,
      week_start: weekStart.toISOString().split('T')[0],
      completed_items: completedItems,
      blocked_items: issues.filter(i => i.source === 'blocked').map(i => ({ task: i.issue, resolution: i.resolution, accepted: i.accepted })),
      next_week_priorities: [
        ...suggestedPriorities.filter(p => p.accepted).map(p => p.title),
        ...manualPriorities.filter(p => p.trim()),
      ],
      risks_and_decisions: issues.filter(i => i.source === 'off_track').map(i => i.issue),
      ai_summary: summary || '',
      completed_by: user.id,
      goal_reviews: goalReviews.filter(g => g.status !== 'pending').map(g => ({ goalId: g.goalId, title: g.title, status: g.status })),
      action_items: actionItems.map(a => ({ title: a.title, type: a.type })),
      oil_snapshot: oilSnapshot,
    } as any);

    setSaving(false);
    if (error) {
      toast.error(t('workboard.checkinPage.checkinFailed'));
    } else {
      toast.success(t('workboard.checkinPage.checkinSaved'));
    }
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      {/* Header */}
      <div className="text-center space-y-2">
        <div className="inline-flex items-center justify-center h-14 w-14 rounded-2xl bg-primary/10 mb-3">
          <Calendar className="h-7 w-7 text-primary" />
        </div>
        <h1 className="text-2xl font-bold text-foreground">{t('workboard.checkinPage.title')}</h1>
        <p className="text-muted-foreground">{t('workboard.checkinPage.weekOf', { week: weekLabel })}</p>
      </div>

      {/* Progress */}
      <div className="flex items-center justify-center gap-2">
        {Array.from({ length: TOTAL_STEPS }, (_, i) => i + 1).map(s => (
          <div
            key={s}
            className={`h-2 w-12 rounded-full transition-colors ${
              s <= step ? 'bg-primary' : 'bg-muted'
            }`}
          />
        ))}
      </div>

      {/* Steps */}
      {step === 1 && <StepWeekGlance stats={taskStats} />}
      {step === 2 && <StepGoalReview goalReviews={goalReviews} onUpdateStatus={handleGoalStatusUpdate} />}
      {step === 3 && <StepCompleted completedItems={completedItems} />}
      {step === 4 && (
        <StepIDS
          issues={issues}
          onRequestSolution={handleRequestSolution}
          onAcceptResolution={handleAcceptResolution}
          onSkipResolution={handleSkipResolution}
          onEditResolution={handleEditResolution}
        />
      )}
      {step === 5 && (
        <StepPriorities
          priorities={suggestedPriorities}
          suggestionsLoading={suggestionsLoading}
          onRequestSuggestions={handleRequestPriorities}
          onAccept={handleAcceptPriority}
          onReject={handleRejectPriority}
          onEdit={handleEditPriority}
          manualPriorities={manualPriorities}
          onManualChange={(i, v) => {
            const updated = [...manualPriorities];
            updated[i] = v;
            setManualPriorities(updated);
          }}
          onSuggestManual={handleSuggestManualPriorities}
          manualSuggestionsLoading={manualSuggestionsLoading}
        />
      )}
      {step === 6 && (
        <StepSummaryActions
          summary={summary}
          summaryLoading={summaryLoading || isLoading}
          actionItems={actionItems}
          onGenerateSummary={handleGenerateSummary}
          onSaveAndApply={handleSaveAndApply}
          saving={saving}
        />
      )}

      {/* Navigation */}
      <div className="flex items-center justify-between">
        <Button
          variant="ghost"
          onClick={() => setStep(s => Math.max(1, s - 1))}
          disabled={step === 1}
        >
          {t('workboard.checkinPage.back')}
        </Button>
        <Button
          onClick={() => setStep(s => Math.min(TOTAL_STEPS, s + 1))}
          disabled={step === TOTAL_STEPS}
        >
          {t('workboard.checkinPage.next')}
          <ArrowRight className="h-4 w-4 ml-2" />
        </Button>
      </div>
    </div>
  );
}
