import { useState, useEffect } from 'react';
import { Brain, Sparkles, Target, TrendingUp, Lightbulb, ArrowRight, Send, Plus, Calendar, AlertCircle, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { useAuth } from '@/contexts/AuthContext';
import { useBrainChat } from '@/hooks/useBrainChat';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { ChatPanel } from '@/components/brain/ChatPanel';
import { toast } from 'sonner';
import ReactMarkdown from 'react-markdown';
import { useTranslation } from 'react-i18next';

interface Task {
  id: string;
  title: string;
  status: string;
  due_date: string | null;
  is_priority: boolean;
}

export default function TodayPage() {
  const { t } = useTranslation();
  const [input, setInput] = useState('');
  const [tasks, setTasks] = useState<Task[]>([]);
  const [showChat, setShowChat] = useState(false);
  const { currentWorkspace, businessContext } = useWorkspace();
  const { user } = useAuth();
  const { messages, isLoading, sendMessage, clearMessages } = useBrainChat();
  const navigate = useNavigate();

  const suggestions = [
    { icon: Target, text: t('today.setGoals'), action: "create_plan" },
    { icon: TrendingUp, text: t('today.reviewPerformance'), action: "weekly_checkin" },
    { icon: Lightbulb, text: t('today.marketingPlan'), action: "create_plan" },
    { icon: Sparkles, text: t('today.activateApps'), action: undefined },
  ];

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return t('greeting.morning');
    if (hour < 18) return t('greeting.afternoon');
    return t('greeting.evening');
  };

  useEffect(() => {
    if (currentWorkspace) {
      fetchTasks();
    }
  }, [currentWorkspace?.id]);

  useEffect(() => {
    // If business setup not completed, redirect
    if (currentWorkspace && businessContext !== null && !businessContext?.setup_completed) {
      navigate('/brain/setup');
    }
  }, [businessContext, currentWorkspace]);

  const fetchTasks = async () => {
    if (!currentWorkspace) return;
    
    const today = new Date().toISOString().split('T')[0];
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

  const handleSend = async () => {
    if (!input.trim()) return;
    setShowChat(true);
    await sendMessage(input);
    setInput('');
  };

  const handleSuggestion = async (text: string, action?: string) => {
    setShowChat(true);
    await sendMessage(text, action);
  };

  const priorityTasks = tasks.filter(t => t.is_priority).slice(0, 3);
  const overdueTasks = tasks.filter(t => t.due_date && new Date(t.due_date) < new Date() && t.status !== 'done');
  const upcomingTasks = tasks.filter(t => !t.is_priority && (!t.due_date || new Date(t.due_date) >= new Date())).slice(0, 5);

  if (showChat) {
    return (
      <div className="mx-auto max-w-4xl h-full flex flex-col">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-xl font-bold text-foreground">AI Brain</h1>
          <Button variant="ghost" size="sm" onClick={() => { setShowChat(false); clearMessages(); }}>
            Back to Today
          </Button>
        </div>
        <ChatPanel 
          messages={messages} 
          isLoading={isLoading} 
          onSendMessage={sendMessage}
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      {/* Hero */}
      <div className="text-center space-y-2 pt-4">
        <div className="inline-flex items-center justify-center h-14 w-14 rounded-2xl bg-primary/10 brain-glow mb-3">
          <Brain className="h-7 w-7 text-primary" />
        </div>
        <h1 className="text-2xl font-bold text-foreground tracking-tight">
          {getGreeting()}
        </h1>
        <p className="text-muted-foreground">
          {t('today.whatToWorkOn')}
        </p>
      </div>

      {/* Main AI Input */}
      <div className="relative">
        <div className="rounded-xl border border-border bg-card p-1 card-shadow focus-within:ring-1 focus-within:ring-primary/50 transition-shadow">
          <div className="flex items-center gap-3 px-4 py-3">
            <Sparkles className="h-5 w-5 text-primary shrink-0" />
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
              placeholder={t('today.askAnything')}
              className="flex-1 bg-transparent border-0 text-foreground placeholder:text-muted-foreground focus-visible:ring-0"
            />
            <Button size="icon" className="h-8 w-8 shrink-0" onClick={handleSend} disabled={isLoading}>
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Suggestion Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {suggestions.map((s, i) => (
          <button
            key={i}
            onClick={() => handleSuggestion(s.text, s.action)}
            className="flex items-center gap-3 rounded-xl border border-border bg-card p-4 text-left text-sm transition-all hover:bg-secondary hover:border-primary/30 group"
          >
            <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <s.icon className="h-4 w-4 text-primary" />
            </div>
            <span className="text-secondary-foreground flex-1">{s.text}</span>
            <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
          </button>
        ))}
      </div>

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
              Overdue
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
              This Week
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
    </div>
  );
}
