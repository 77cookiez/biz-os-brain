import { useState } from 'react';
import { Plus, Target, AlertCircle, Calendar, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useWorkboardTasks } from '@/hooks/useWorkboardTasks';
import { TaskCard } from '@/components/workboard/TaskCard';
import { AddWorkboardTaskDialog } from '@/components/workboard/AddWorkboardTaskDialog';
import { useTranslation } from 'react-i18next';

export default function WorkboardTodayPage() {
  const { tasks, loading, createTask, updateTask } = useWorkboardTasks();
  const [showAdd, setShowAdd] = useState(false);
  const { t } = useTranslation();

  const today = new Date().toISOString().split('T')[0];
  const priorityTasks = tasks.filter(t => t.is_priority && t.status !== 'done').slice(0, 3);
  const overdueTasks = tasks.filter(t => t.due_date && t.due_date < today && t.status !== 'done');
  const todayTasks = tasks.filter(t => t.due_date === today && !t.is_priority && t.status !== 'done');
  const inProgress = tasks.filter(t => t.status === 'in_progress' && !t.is_priority);

  const handleStatusChange = (id: string, status: any) => updateTask(id, { status });
  const handleTogglePriority = (id: string, current: boolean) => updateTask(id, { is_priority: !current });

  if (loading) return <div className="flex items-center justify-center py-12 text-muted-foreground">{t('workboard.loading')}</div>;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-foreground">{t('workboard.todayPage.title')}</h1>
        <Button size="sm" onClick={() => setShowAdd(true)} className="gap-1.5">
          <Plus className="h-3.5 w-3.5" /> {t('workboard.addTask')}
        </Button>
      </div>

      {/* Top 3 Priorities */}
      {priorityTasks.length > 0 && (
        <Card className="border-border bg-card">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-2">
              <Target className="h-4 w-4 text-primary" /> {t('workboard.todayPage.topPriorities')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {priorityTasks.map(task => (
              <TaskCard key={task.id} task={task} onStatusChange={handleStatusChange} onTogglePriority={handleTogglePriority} />
            ))}
          </CardContent>
        </Card>
      )}

      {/* Overdue */}
      {overdueTasks.length > 0 && (
        <Card className="border-destructive/50 bg-card">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-destructive uppercase tracking-wider flex items-center gap-2">
              <AlertCircle className="h-4 w-4" /> {t('workboard.todayPage.overdue')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {overdueTasks.map(task => (
              <TaskCard key={task.id} task={task} onStatusChange={handleStatusChange} onTogglePriority={handleTogglePriority} />
            ))}
          </CardContent>
        </Card>
      )}

      {/* Today's Tasks */}
      {todayTasks.length > 0 && (
        <Card className="border-border bg-card">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-2">
              <Calendar className="h-4 w-4" /> {t('workboard.todayPage.todaysTasks')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {todayTasks.map(task => (
              <TaskCard key={task.id} task={task} onStatusChange={handleStatusChange} onTogglePriority={handleTogglePriority} />
            ))}
          </CardContent>
        </Card>
      )}

      {/* In Progress */}
      {inProgress.length > 0 && (
        <Card className="border-border bg-card">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">{t('workboard.todayPage.inProgress')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {inProgress.map(task => (
              <TaskCard key={task.id} task={task} onStatusChange={handleStatusChange} onTogglePriority={handleTogglePriority} />
            ))}
          </CardContent>
        </Card>
      )}

      {/* Empty */}
      {tasks.filter(t => t.status !== 'done').length === 0 && (
        <Card className="border-border bg-card">
          <CardContent className="py-12 text-center">
            <CheckCircle2 className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground">{t('workboard.todayPage.noActiveTasks')}</p>
          </CardContent>
        </Card>
      )}

      <AddWorkboardTaskDialog open={showAdd} onOpenChange={setShowAdd} onSubmit={createTask} defaultStatus="planned" defaultDate={today} />
    </div>
  );
}
