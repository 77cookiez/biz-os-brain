import { useState, useMemo } from 'react';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useWorkboardTasks } from '@/hooks/useWorkboardTasks';
import { TaskCard } from '@/components/workboard/TaskCard';
import { AddWorkboardTaskDialog } from '@/components/workboard/AddWorkboardTaskDialog';
import { useTranslation } from 'react-i18next';

function getWeekDays(): { label: string; date: string }[] {
  const now = new Date();
  const dayOfWeek = now.getDay();
  const startOfWeek = new Date(now);
  startOfWeek.setDate(now.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));

  const days: { label: string; date: string }[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(startOfWeek);
    d.setDate(startOfWeek.getDate() + i);
    days.push({
      label: d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' }),
      date: d.toISOString().split('T')[0],
    });
  }
  return days;
}

export default function WorkboardWeekPage() {
  const { tasks, loading, createTask, updateTask } = useWorkboardTasks();
  const [showAdd, setShowAdd] = useState(false);
  const weekDays = useMemo(getWeekDays, []);
  const { t } = useTranslation();

  const handleStatusChange = (id: string, status: any) => updateTask(id, { status });
  const handleTogglePriority = (id: string, current: boolean) => updateTask(id, { is_priority: !current });

  if (loading) return <div className="flex items-center justify-center py-12 text-muted-foreground">{t('workboard.loading')}</div>;

  const today = new Date().toISOString().split('T')[0];

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-foreground">{t('workboard.weekPage.title')}</h1>
        <Button size="sm" onClick={() => setShowAdd(true)} className="gap-1.5">
          <Plus className="h-3.5 w-3.5" /> {t('workboard.addTask')}
        </Button>
      </div>

      {weekDays.map(day => {
        const dayTasks = tasks.filter(t => t.due_date === day.date && t.status !== 'done');
        const isToday = day.date === today;

        return (
          <Card key={day.date} className={`border-border bg-card ${isToday ? 'ring-1 ring-primary/40' : ''}`}>
            <CardHeader className="pb-2">
              <CardTitle className={`text-sm font-medium ${isToday ? 'text-primary' : 'text-muted-foreground'}`}>
                {day.label} {isToday && `• ${t('workboard.weekPage.todayLabel')}`}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {dayTasks.length === 0 ? (
                <p className="text-xs text-muted-foreground py-1">{t('workboard.noTasks')}</p>
              ) : (
                dayTasks.map(task => (
                  <TaskCard key={task.id} task={task} onStatusChange={handleStatusChange} onTogglePriority={handleTogglePriority} />
                ))
              )}
            </CardContent>
          </Card>
        );
      })}

      <AddWorkboardTaskDialog open={showAdd} onOpenChange={setShowAdd} onSubmit={createTask} defaultStatus="planned" />
    </div>
  );
}
