import { useState, useEffect } from 'react';
import { Plus, Target, TrendingUp, Calendar, MoreVertical, Sparkles, ChevronDown, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
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
}

interface Plan {
  id: string;
  goal_id: string | null;
  title: string;
  description: string | null;
  plan_type: string;
  ai_generated: boolean;
}

const planTypes = ['sales', 'marketing', 'operations', 'finance', 'team', 'custom'];

export default function GoalsPage() {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [expandedGoals, setExpandedGoals] = useState<Set<string>>(new Set());
  const [showGoalDialog, setShowGoalDialog] = useState(false);
  const [showPlanDialog, setShowPlanDialog] = useState(false);
  const [selectedGoalId, setSelectedGoalId] = useState<string | null>(null);
  const [newGoal, setNewGoal] = useState({ title: '', description: '', kpiName: '', kpiTarget: '', dueDate: '' });
  const [newPlan, setNewPlan] = useState({ title: '', description: '', planType: 'custom' as string, goalId: '' });
  const { currentWorkspace } = useWorkspace();
  const { user } = useAuth();
  const { currentLanguage } = useLanguage();

  useEffect(() => {
    if (currentWorkspace) {
      fetchGoals();
      fetchPlans();
    }
  }, [currentWorkspace?.id]);

  const fetchGoals = async () => {
    if (!currentWorkspace) return;
    const { data } = await supabase
      .from('goals')
      .select('*')
      .eq('workspace_id', currentWorkspace.id)
      .order('created_at', { ascending: false });
    setGoals(data || []);
  };

  const fetchPlans = async () => {
    if (!currentWorkspace) return;
    const { data } = await supabase
      .from('plans')
      .select('*')
      .eq('workspace_id', currentWorkspace.id)
      .order('created_at', { ascending: false });
    setPlans(data || []);
  };

  const createGoal = async () => {
    if (!currentWorkspace || !user) return;

    const meaningId = await createMeaningObject({
      workspaceId: currentWorkspace.id,
      createdBy: user.id,
      type: 'GOAL',
      sourceLang: currentLanguage.code,
      meaningJson: buildMeaningFromText({
        type: 'GOAL',
        title: newGoal.title,
        description: newGoal.description || undefined,
      }),
    });
    
    const goalPayload = {
      workspace_id: currentWorkspace.id,
      title: newGoal.title,
      description: newGoal.description || null,
      kpi_name: newGoal.kpiName || null,
      kpi_target: newGoal.kpiTarget ? parseFloat(newGoal.kpiTarget) : null,
      due_date: newGoal.dueDate || null,
      created_by: user.id,
      source_lang: currentLanguage.code,
      meaning_object_id: meaningId,
    };
    guardMeaningInsert('goals', goalPayload);
    const { error } = await supabase.from('goals').insert(goalPayload as any);

    if (error) {
      toast.error('Failed to create goal');
    } else {
      toast.success('Goal created!');
      setShowGoalDialog(false);
      setNewGoal({ title: '', description: '', kpiName: '', kpiTarget: '', dueDate: '' });
      fetchGoals();
    }
  };

  const createPlan = async () => {
    if (!currentWorkspace || !user) return;

    const meaningId = await createMeaningObject({
      workspaceId: currentWorkspace.id,
      createdBy: user.id,
      type: 'GOAL',
      sourceLang: currentLanguage.code,
      meaningJson: buildMeaningFromText({
        type: 'GOAL',
        title: newPlan.title,
        description: newPlan.description || undefined,
      }),
    });
    
    const planPayload = {
      workspace_id: currentWorkspace.id,
      goal_id: newPlan.goalId || null,
      title: newPlan.title,
      description: newPlan.description || null,
      plan_type: newPlan.planType as any,
      created_by: user.id,
      source_lang: currentLanguage.code,
      meaning_object_id: meaningId,
    };
    guardMeaningInsert('plans', planPayload);
    const { error } = await supabase.from('plans').insert(planPayload as any);

    if (error) {
      toast.error('Failed to create plan');
    } else {
      toast.success('Plan created!');
      setShowPlanDialog(false);
      setNewPlan({ title: '', description: '', planType: 'custom', goalId: '' });
      fetchPlans();
    }
  };

  const toggleGoal = (goalId: string) => {
    setExpandedGoals(prev => {
      const next = new Set(prev);
      if (next.has(goalId)) {
        next.delete(goalId);
      } else {
        next.add(goalId);
      }
      return next;
    });
  };

  const getGoalProgress = (goal: Goal) => {
    if (!goal.kpi_target || goal.kpi_target === 0) return 0;
    return Math.min(100, Math.round(((goal.kpi_current || 0) / goal.kpi_target) * 100));
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Goals & Plans</h1>
          <p className="text-muted-foreground">90-day horizon planning</p>
        </div>
        <div className="flex items-center gap-2">
          <Dialog open={showPlanDialog} onOpenChange={setShowPlanDialog}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm">
                <Plus className="h-4 w-4 mr-2" />
                New Plan
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-card border-border">
              <DialogHeader>
                <DialogTitle className="text-foreground">Create Plan</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-4">
                <Input
                  placeholder="Plan title"
                  value={newPlan.title}
                  onChange={(e) => setNewPlan({ ...newPlan, title: e.target.value })}
                  className="bg-input border-border text-foreground"
                />
                <Textarea
                  placeholder="Description (optional)"
                  value={newPlan.description}
                  onChange={(e) => setNewPlan({ ...newPlan, description: e.target.value })}
                  className="bg-input border-border text-foreground"
                />
                <Select value={newPlan.planType} onValueChange={(v) => setNewPlan({ ...newPlan, planType: v })}>
                  <SelectTrigger className="bg-input border-border text-foreground">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-popover border-border">
                    {planTypes.map(type => (
                      <SelectItem key={type} value={type} className="capitalize">{type}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {goals.length > 0 && (
                  <Select value={newPlan.goalId} onValueChange={(v) => setNewPlan({ ...newPlan, goalId: v })}>
                    <SelectTrigger className="bg-input border-border text-foreground">
                      <SelectValue placeholder="Link to goal (optional)" />
                    </SelectTrigger>
                    <SelectContent className="bg-popover border-border">
                      <SelectItem value="">No goal</SelectItem>
                      {goals.map(goal => (
                        <SelectItem key={goal.id} value={goal.id}>{goal.title}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
                <Button onClick={createPlan} disabled={!newPlan.title.trim()} className="w-full">
                  Create Plan
                </Button>
              </div>
            </DialogContent>
          </Dialog>

          <Dialog open={showGoalDialog} onOpenChange={setShowGoalDialog}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Target className="h-4 w-4 mr-2" />
                New Goal
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-card border-border">
              <DialogHeader>
                <DialogTitle className="text-foreground">Create 90-Day Goal</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-4">
                <Input
                  placeholder="Goal title"
                  value={newGoal.title}
                  onChange={(e) => setNewGoal({ ...newGoal, title: e.target.value })}
                  className="bg-input border-border text-foreground"
                />
                <Textarea
                  placeholder="Description (optional)"
                  value={newGoal.description}
                  onChange={(e) => setNewGoal({ ...newGoal, description: e.target.value })}
                  className="bg-input border-border text-foreground"
                />
                <div className="grid grid-cols-2 gap-3">
                  <Input
                    placeholder="KPI name (e.g., Revenue)"
                    value={newGoal.kpiName}
                    onChange={(e) => setNewGoal({ ...newGoal, kpiName: e.target.value })}
                    className="bg-input border-border text-foreground"
                  />
                  <Input
                    placeholder="Target value"
                    type="number"
                    value={newGoal.kpiTarget}
                    onChange={(e) => setNewGoal({ ...newGoal, kpiTarget: e.target.value })}
                    className="bg-input border-border text-foreground"
                  />
                </div>
                <Input
                  type="date"
                  value={newGoal.dueDate}
                  onChange={(e) => setNewGoal({ ...newGoal, dueDate: e.target.value })}
                  className="bg-input border-border text-foreground"
                />
                <Button onClick={createGoal} disabled={!newGoal.title.trim()} className="w-full">
                  Create Goal
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Goals */}
      <div className="space-y-4">
        {goals.length === 0 ? (
          <Card className="border-border bg-card">
            <CardContent className="py-12 text-center">
              <Target className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="font-medium text-foreground mb-2">No goals yet</h3>
              <p className="text-sm text-muted-foreground mb-4">Create your first 90-day goal to get started</p>
              <Button onClick={() => setShowGoalDialog(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Create Goal
              </Button>
            </CardContent>
          </Card>
        ) : (
          goals.map(goal => {
            const isExpanded = expandedGoals.has(goal.id);
            const goalPlans = plans.filter(p => p.goal_id === goal.id);
            const progress = getGoalProgress(goal);

            return (
              <Card key={goal.id} className="border-border bg-card">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <button
                      onClick={() => toggleGoal(goal.id)}
                      className="flex items-center gap-2 text-left"
                    >
                      {isExpanded ? (
                        <ChevronDown className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      )}
                      <div>
                        <CardTitle className="text-foreground">{goal.title}</CardTitle>
                        {goal.description && (
                          <p className="text-sm text-muted-foreground mt-1">{goal.description}</p>
                        )}
                      </div>
                    </button>
                    <div className="flex items-center gap-2">
                      <Badge variant={goal.status === 'active' ? 'default' : 'secondary'}>
                        {goal.status}
                      </Badge>
                      {goal.due_date && (
                        <Badge variant="outline" className="text-xs">
                          <Calendar className="h-3 w-3 mr-1" />
                          {new Date(goal.due_date).toLocaleDateString()}
                        </Badge>
                      )}
                    </div>
                  </div>
                  
                  {goal.kpi_name && (
                    <div className="mt-3">
                      <div className="flex items-center justify-between text-sm mb-1">
                        <span className="text-muted-foreground">{goal.kpi_name}</span>
                        <span className="text-foreground font-medium">
                          {goal.kpi_current || 0} / {goal.kpi_target}
                        </span>
                      </div>
                      <Progress value={progress} className="h-2" />
                    </div>
                  )}
                </CardHeader>
                
                {isExpanded && (
                  <CardContent className="pt-0">
                    <div className="border-t border-border pt-4 mt-2">
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="text-sm font-medium text-muted-foreground">Plans</h4>
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => {
                            setNewPlan({ ...newPlan, goalId: goal.id });
                            setShowPlanDialog(true);
                          }}
                        >
                          <Plus className="h-3 w-3 mr-1" />
                          Add Plan
                        </Button>
                      </div>
                      {goalPlans.length === 0 ? (
                        <p className="text-sm text-muted-foreground">No plans linked to this goal</p>
                      ) : (
                        <div className="space-y-2">
                          {goalPlans.map(plan => (
                            <div key={plan.id} className="flex items-center justify-between p-3 rounded-lg bg-secondary/50">
                              <div className="flex items-center gap-2">
                                {plan.ai_generated && <Sparkles className="h-3 w-3 text-primary" />}
                                <span className="text-sm text-foreground">{plan.title}</span>
                              </div>
                              <Badge variant="outline" className="text-xs capitalize">{plan.plan_type}</Badge>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </CardContent>
                )}
              </Card>
            );
          })
        )}
      </div>

      {/* Unlinked Plans */}
      {plans.filter(p => !p.goal_id).length > 0 && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-foreground">Standalone Plans</h2>
          <div className="grid gap-3">
            {plans.filter(p => !p.goal_id).map(plan => (
              <Card key={plan.id} className="border-border bg-card">
                <CardContent className="py-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {plan.ai_generated && <Sparkles className="h-4 w-4 text-primary" />}
                      <span className="font-medium text-foreground">{plan.title}</span>
                    </div>
                    <Badge variant="outline" className="capitalize">{plan.plan_type}</Badge>
                  </div>
                  {plan.description && (
                    <p className="text-sm text-muted-foreground mt-2">{plan.description}</p>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
