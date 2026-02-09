import { useState, useMemo } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useWorkboardTasks } from '@/hooks/useWorkboardTasks';
import { cn } from '@/lib/utils';

export default function WorkboardCalendarPage() {
  const { tasks, loading } = useWorkboardTasks();
  const [currentMonth, setCurrentMonth] = useState(new Date());

  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();

  const calendarDays = useMemo(() => {
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startPad = (firstDay.getDay() + 6) % 7; // Monday start

    const days: { date: Date; isCurrentMonth: boolean }[] = [];
    for (let i = startPad - 1; i >= 0; i--) {
      const d = new Date(year, month, -i);
      days.push({ date: d, isCurrentMonth: false });
    }
    for (let i = 1; i <= lastDay.getDate(); i++) {
      days.push({ date: new Date(year, month, i), isCurrentMonth: true });
    }
    const remaining = 7 - (days.length % 7);
    if (remaining < 7) {
      for (let i = 1; i <= remaining; i++) {
        days.push({ date: new Date(year, month + 1, i), isCurrentMonth: false });
      }
    }
    return days;
  }, [year, month]);

  const todayStr = new Date().toISOString().split('T')[0];

  const tasksByDate = useMemo(() => {
    const map: Record<string, typeof tasks> = {};
    tasks.forEach(t => {
      if (t.due_date) {
        if (!map[t.due_date]) map[t.due_date] = [];
        map[t.due_date].push(t);
      }
    });
    return map;
  }, [tasks]);

  if (loading) return <div className="flex items-center justify-center py-12 text-muted-foreground">Loading...</div>;

  const statusColors: Record<string, string> = {
    backlog: 'bg-muted-foreground',
    planned: 'bg-blue-500',
    in_progress: 'bg-yellow-500',
    blocked: 'bg-destructive',
    done: 'bg-green-500',
  };

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-foreground">Calendar</h1>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={() => setCurrentMonth(new Date(year, month - 1))}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm font-medium text-foreground min-w-[140px] text-center">
            {currentMonth.toLocaleDateString('en', { month: 'long', year: 'numeric' })}
          </span>
          <Button variant="ghost" size="icon" onClick={() => setCurrentMonth(new Date(year, month + 1))}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={() => setCurrentMonth(new Date())}>Today</Button>
        </div>
      </div>

      <div className="border border-border rounded-lg overflow-hidden">
        <div className="grid grid-cols-7 bg-muted">
          {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(d => (
            <div key={d} className="text-xs font-medium text-muted-foreground text-center py-2">{d}</div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {calendarDays.map((day, i) => {
            const dateStr = day.date.toISOString().split('T')[0];
            const dayTasks = tasksByDate[dateStr] || [];
            const isToday = dateStr === todayStr;

            return (
              <div
                key={i}
                className={cn(
                  'min-h-[80px] border-t border-r border-border p-1.5 last:border-r-0',
                  !day.isCurrentMonth && 'bg-muted/50',
                  isToday && 'bg-primary/5'
                )}
              >
                <span className={cn(
                  'text-xs font-medium',
                  isToday ? 'text-primary' : day.isCurrentMonth ? 'text-foreground' : 'text-muted-foreground'
                )}>
                  {day.date.getDate()}
                </span>
                <div className="mt-1 space-y-0.5">
                  {dayTasks.slice(0, 3).map(t => (
                    <div key={t.id} className="flex items-center gap-1">
                      <div className={cn('h-1.5 w-1.5 rounded-full shrink-0', statusColors[t.status])} />
                      <span className="text-[10px] text-foreground truncate">{t.title}</span>
                    </div>
                  ))}
                  {dayTasks.length > 3 && (
                    <span className="text-[10px] text-muted-foreground">+{dayTasks.length - 3} more</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
