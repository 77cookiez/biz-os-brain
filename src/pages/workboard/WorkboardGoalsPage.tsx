import { useState, useEffect } from 'react';
import { Plus, Target } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ULLText } from '@/components/ull/ULLText';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useWorkboardTasks } from '@/hooks/useWorkboardTasks';
import { createMeaningObject, buildMeaningFromText } from '@/lib/meaningObject';
import { guardMeaningInsert } from '@/lib/meaningGuard';

interface Goal {
  id: string;
  title: string;
  description: string | null;
  kpi_name: string | null;
  kpi_target: number | null;
  kpi_current: number | null;
  due_date: string | null;
  status: string;
  meaning_object_id?: string | null;
  source_lang?: string;
}

export default function WorkboardGoalsPage() {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [showDialog, setShowDialog] = useState(false);
  const [form, setForm] = useState({ title: '', description: '', kpiName: '', kpiTarget: '', dueDate: '' });
  const { currentWorkspace } = useWorkspace();
  const { user } = useAuth();
  const { currentLanguage } = useLanguage();
  const { tasks } = useWorkboardTasks();

  useEffect(() => {
    if (currentWorkspace) fetchGoals();
  }, [currentWorkspace?.id]);

  const fetchGoals = async () => {
    if (!currentWorkspace) return;
    const { data } = await supabase.from('goals').select('*').eq('workspace_id', currentWorkspace.id).order('created_at', { ascending: false });
    setGoals(data || []);
  };

  const createGoal = async () => {
    if (!currentWorkspace || !user || !form.title.trim()) return;

    const meaningId = await createMeaningObject({
      workspaceId: currentWorkspace.id,
      createdBy: user.id,
      type: 'GOAL',
      sourceLang: currentLanguage.code,
      meaningJson: buildMeaningFromText({
        type: 'GOAL',
        title: form.title,
        description: form.description || undefined,
      }),
    });

    const insertPayload = {
      workspace_id: currentWorkspace.id,
      created_by: user.id,
      title: form.title,
      description: form.description || null,
      kpi_name: form.kpiName || null,
      kpi_target: form.kpiTarget ? parseFloat(form.kpiTarget) : null,
      due_date: form.dueDate || null,
      source_lang: currentLanguage.code,
      meaning_object_id: meaningId,
    };
    guardMeaningInsert('goals', insertPayload);
    const { error } = await supabase.from('goals').insert(insertPayload as any);
    if (error) { toast.error('Failed to create goal'); return; }
    toast.success('Goal created');
    setShowDialog(false);
    setForm({ title: '', description: '', kpiName: '', kpiTarget: '', dueDate: '' });
    fetchGoals();
  };

  const getProgress = (goal: Goal) => {
    if (!goal.kpi_target || goal.kpi_target === 0) {
      const goalTasks = tasks.filter(t => t.goal_id === goal.id);
      if (goalTasks.length === 0) return 0;
      return Math.round((goalTasks.filter(t => t.status === 'done').length / goalTasks.length) * 100);
    }
    return Math.min(100, Math.round(((goal.kpi_current || 0) / goal.kpi_target) * 100));
  };

  // Summary stats
  const totalTasks = tasks.filter(t => t.status !== 'done').length;
  const completedThisWeek = tasks.filter(t => {
    if (t.status !== 'done' || !t.completed_at) return false;
    const weekAgo = new Date(Date.now() - 7 * 86400000);
    return new Date(t.completed_at) > weekAgo;
  }).length;
  const blockedCount = tasks.filter(t => t.status === 'blocked').length;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-foreground">Goals</h1>
        <Button size="sm" onClick={() => setShowDialog(true)} className="gap-1.5">
          <Plus className="h-3.5 w-3.5" /> New Goal
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <Card className="border-border bg-card">
          <CardContent className="py-4 text-center">
            <p className="text-2xl font-bold text-foreground">{completedThisWeek}</p>
            <p className="text-xs text-muted-foreground">Completed this week</p>
          </CardContent>
        </Card>
        <Card className="border-border bg-card">
          <CardContent className="py-4 text-center">
            <p className="text-2xl font-bold text-foreground">{totalTasks}</p>
            <p className="text-xs text-muted-foreground">Active tasks</p>
          </CardContent>
        </Card>
        <Card className="border-border bg-card">
          <CardContent className="py-4 text-center">
            <p className={`text-2xl font-bold ${blockedCount > 0 ? 'text-destructive' : 'text-foreground'}`}>{blockedCount}</p>
            <p className="text-xs text-muted-foreground">Blocked</p>
          </CardContent>
        </Card>
      </div>

      {/* Goals List */}
      {goals.length === 0 ? (
        <Card className="border-border bg-card">
          <CardContent className="py-12 text-center">
            <Target className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground">No goals yet. Create your first goal.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {goals.map(goal => {
            const progress = getProgress(goal);
            const goalTasks = tasks.filter(t => t.goal_id === goal.id);
            return (
              <Card key={goal.id} className="border-border bg-card">
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-foreground text-base">
                        <ULLText
                          meaningId={goal.meaning_object_id}
                          table="goals"
                          id={goal.id}
                          field="title"
                          fallback={goal.title}
                          sourceLang={goal.source_lang || 'en'}
                        />
                      </CardTitle>
                      {goal.description && (
                        <ULLText
                          meaningId={goal.meaning_object_id}
                          table="goals"
                          id={goal.id}
                          field="description"
                          fallback={goal.description}
                          sourceLang={goal.source_lang || 'en'}
                          className="text-sm text-muted-foreground mt-1"
                          as="p"
                        />
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={goal.status === 'active' ? 'default' : 'secondary'}>{goal.status}</Badge>
                      {goal.due_date && <Badge variant="outline" className="text-xs">{new Date(goal.due_date).toLocaleDateString()}</Badge>}
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between text-sm mb-1.5">
                    <span className="text-muted-foreground">{goal.kpi_name || `${goalTasks.filter(t => t.status === 'done').length}/${goalTasks.length} tasks`}</span>
                    <span className="text-foreground font-medium">{progress}%</span>
                  </div>
                  <Progress value={progress} className="h-2" />
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="bg-card border-border">
          <DialogHeader>
            <DialogTitle className="text-foreground">New Goal</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <Input placeholder="Goal title" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} className="bg-input border-border" />
            <Textarea placeholder="Description (optional)" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} className="bg-input border-border" rows={2} />
            <div className="grid grid-cols-2 gap-3">
              <Input placeholder="KPI name" value={form.kpiName} onChange={e => setForm({ ...form, kpiName: e.target.value })} className="bg-input border-border" />
              <Input placeholder="Target" type="number" value={form.kpiTarget} onChange={e => setForm({ ...form, kpiTarget: e.target.value })} className="bg-input border-border" />
            </div>
            <Input type="date" value={form.dueDate} onChange={e => setForm({ ...form, dueDate: e.target.value })} className="bg-input border-border" />
            <Button onClick={createGoal} disabled={!form.title.trim()} className="w-full">Create Goal</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
