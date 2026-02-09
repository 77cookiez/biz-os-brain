import { useState, useEffect } from 'react';
import { Target, Sparkles, Calendar, AlertCircle, CheckCircle2, ArrowRight, TrendingUp, ShieldAlert, BarChart3 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { useAuth } from '@/contexts/AuthContext';
import { useBrainCommand } from '@/contexts/BrainCommandContext';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

interface Task {
  id: string;
  title: string;
  status: string;
  due_date: string | null;
  is_priority: boolean;
}

interface Insights {
  overdueCount: number;
  blockedCount: number;
  completedThisWeek: number;
  totalThisWeek: number;
}

export default function TodayPage() {
  const { t } = useTranslation();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [insights, setInsights] = useState<Insights>({ overdueCount: 0, blockedCount: 0, completedThisWeek: 0, totalThisWeek: 0 });
  const { currentWorkspace, businessContext } = useWorkspace();
  const { user } = useAuth();
  const { prefillAndFocus } = useBrainCommand();
  const navigate = useNavigate();

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return t('greeting.morning');
    if (hour < 18) return t('greeting.afternoon');
    return t('greeting.evening');
  };

  const displayName = user?.user_metadata?.full_name || user?.email?.split('@')[0] || '';

  useEffect(() => {
    if (currentWorkspace) {
      fetchTasks();
      fetchInsights();
    }
  }, [currentWorkspace?.id]);

  useEffect(() => {
    if (currentWorkspace && businessContext !== null && !businessContext?.setup_completed) {
      navigate('/brain/setup');
    }
  }, [businessContext, currentWorkspace]);

  const fetchTasks = async () => {
    if (!currentWorkspace) return;
    const weekFromNow = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const { data } = await supabase
      .from('tasks')
      .select('id, title, status, due_date, is_priority')
      .eq('workspace_id', currentWorkspace.id)
      .in('status', ['backlog', 'planned', 'in_progress', 'blocked'])
      .or(`is_priority.eq.true,due_date.lte.${weekFromNow}`)
      .order('is_priority', { ascending: false })
      .order('due_date')
      .limit(10);
    setTasks(data || []);
  };

  const fetchInsights = async () => {
    if (!currentWorkspace) return;
    const today = new Date().toISOString().split('T')[0];
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    const [overdueRes, blockedRes, completedRes, totalRes] = await Promise.all([
      supabase.from('tasks').select('id', { count: 'exact', head: true })
        .eq('workspace_id', currentWorkspace.id)
        .in('status', ['backlog', 'planned', 'in_progress', 'blocked'])
        .lt('due_date', today)
        .not('due_date', 'is', null),
      supabase.from('tasks').select('id', { count: 'exact', head: true })
        .eq('workspace_id', currentWorkspace.id)
        .eq('status', 'blocked'),
      supabase.from('tasks').select('id', { count: 'exact', head: true })
        .eq('workspace_id', currentWorkspace.id)
        .eq('status', 'done')
        .gte('completed_at', weekAgo),
      supabase.from('tasks').select('id', { count: 'exact', head: true })
        .eq('workspace_id', currentWorkspace.id)
        .gte('created_at', weekAgo),
    ]);

    setInsights({
      overdueCount: overdueRes.count || 0,
      blockedCount: blockedRes.count || 0,
      completedThisWeek: completedRes.count || 0,
      totalThisWeek: totalRes.count || 0,
    });
  };

  const suggestions = [
    { text: t('today.setGoals') },
    { text: t('today.reviewPerformance') },
    { text: t('today.marketingPlan') },
    { text: t('today.activateApps') },
  ];

  const priorityTasks = tasks.filter(t => t.is_priority).slice(0, 3);
  const today = new Date().toISOString().split('T')[0];
  const overdueTasks = tasks.filter(t => t.due_date && t.due_date < today && t.status !== 'done');
  const upcomingTasks = tasks.filter(t => !t.is_priority && (!t.due_date || new Date(t.due_date) >= new Date())).slice(0, 5);

  const completionRate = insights.totalThisWeek > 0
    ? Math.round((insights.completedThisWeek / insights.totalThisWeek) * 100)
    : 0;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      {/* Header */}
      <div className="pt-2">
        <h1 className="text-xl font-bold text-foreground">
          {getGreeting()}{displayName ? `, ${displayName}` : ''}
        </h1>
      </div>

      {/* Read-Only Insights */}
      {(insights.overdueCount > 0 || insights.blockedCount > 0 || insights.totalThisWeek > 0) && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Card className={`border-border bg-card ${insights.overdueCount > 0 ? 'border-destructive/50' : ''}`}>
            <CardContent className="p-4 flex items-center gap-3">
              <div className={`h-9 w-9 rounded-lg flex items-center justify-center shrink-0 ${insights.overdueCount > 0 ? 'bg-destructive/10' : 'bg-muted'}`}>
                <AlertCircle className={`h-4 w-4 ${insights.overdueCount > 0 ? 'text-destructive' : 'text-muted-foreground'}`} />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{insights.overdueCount}</p>
                <p className="text-xs text-muted-foreground">{t('today.insightsOverdue')}</p>
              </div>
            </CardContent>
          </Card>
          <Card className={`border-border bg-card ${insights.blockedCount > 0 ? 'border-orange-500/50' : ''}`}>
            <CardContent className="p-4 flex items-center gap-3">
              <div className={`h-9 w-9 rounded-lg flex items-center justify-center shrink-0 ${insights.blockedCount > 0 ? 'bg-orange-500/10' : 'bg-muted'}`}>
                <ShieldAlert className={`h-4 w-4 ${insights.blockedCount > 0 ? 'text-orange-500' : 'text-muted-foreground'}`} />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{insights.blockedCount}</p>
                <p className="text-xs text-muted-foreground">{t('today.insightsBlocked')}</p>
              </div>
            </CardContent>
          </Card>
          <Card className="border-border bg-card">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                <BarChart3 className="h-4 w-4 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{completionRate}%</p>
                <p className="text-xs text-muted-foreground">{t('today.insightsCompletedThisWeek')}</p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Priority Tasks */}
      {priorityTasks.length > 0 && (
        <Card className="border-border bg-card">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-2">
              <Target className="h-4 w-4 text-primary" />
              {t('today.priorityTasks')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {priorityTasks.map(task => (
              <div key={task.id} className="flex items-center justify-between p-3 rounded-lg bg-secondary/50">
                <span className="text-sm text-foreground">{task.title}</span>
                <Badge variant="outline" className="text-xs">
                  {task.status.replace('_', ' ')}
                </Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Overdue Tasks */}
      {overdueTasks.length > 0 && (
        <Card className="border-destructive/50 bg-card">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-destructive uppercase tracking-wider flex items-center gap-2">
              <AlertCircle className="h-4 w-4" />
              {t('today.overdue')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {overdueTasks.map(task => (
              <div key={task.id} className="flex items-center justify-between p-3 rounded-lg bg-destructive/10">
                <span className="text-sm text-foreground">{task.title}</span>
                <span className="text-xs text-destructive">
                  {task.due_date && new Date(task.due_date).toLocaleDateString()}
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Upcoming Tasks */}
      {upcomingTasks.length > 0 && (
        <Card className="border-border bg-card">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              {t('today.thisWeek')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {upcomingTasks.map(task => (
              <div key={task.id} className="flex items-center justify-between p-3 rounded-lg hover:bg-secondary/50 transition-colors">
                <span className="text-sm text-foreground">{task.title}</span>
                {task.due_date && (
                  <span className="text-xs text-muted-foreground">
                    {new Date(task.due_date).toLocaleDateString()}
                  </span>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Empty State */}
      {tasks.length === 0 && (
        <Card className="border-border bg-card">
          <CardContent className="py-8 text-center">
            <CheckCircle2 className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground">{t('today.noTasks')}</p>
          </CardContent>
        </Card>
      )}

      {/* Quick Actions */}
      <div className="space-y-3">
        <h2 className="text-xs font-medium text-muted-foreground uppercase tracking-wider px-1">
          {t('today.quickActions')}
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {suggestions.map((s, i) => (
            <button
              key={i}
              onClick={() => prefillAndFocus(s.text)}
              className="flex items-center gap-3 rounded-xl border border-border bg-card p-4 text-left text-sm transition-all hover:bg-secondary hover:border-primary/30 group"
            >
              <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                <Sparkles className="h-4 w-4 text-primary" />
              </div>
              <span className="text-secondary-foreground flex-1">{s.text}</span>
              <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
