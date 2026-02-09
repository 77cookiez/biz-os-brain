import { Circle, CheckCircle2, AlertCircle, Clock } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import type { WorkboardTask, TaskStatus } from '@/hooks/useWorkboardTasks';

const statusConfig: Record<TaskStatus, { label: string; icon: React.ElementType; color: string }> = {
  backlog: { label: 'Backlog', icon: Circle, color: 'text-muted-foreground' },
  planned: { label: 'Planned', icon: Clock, color: 'text-blue-500' },
  in_progress: { label: 'In Progress', icon: Circle, color: 'text-yellow-500' },
  blocked: { label: 'Blocked', icon: AlertCircle, color: 'text-destructive' },
  done: { label: 'Done', icon: CheckCircle2, color: 'text-green-500' },
};

interface TaskCardProps {
  task: WorkboardTask;
  onStatusChange: (taskId: string, status: TaskStatus) => void;
  onTogglePriority: (taskId: string, current: boolean) => void;
}

export function TaskCard({ task, onStatusChange, onTogglePriority }: TaskCardProps) {
  const StatusIcon = statusConfig[task.status].icon;

  return (
    <div className={`flex items-start gap-3 p-4 rounded-lg border border-border bg-card ${task.is_priority ? 'ring-1 ring-primary/50' : ''}`}>
      <button
        onClick={() => onStatusChange(task.id, task.status === 'done' ? 'in_progress' : 'done')}
        className={`mt-0.5 ${statusConfig[task.status].color}`}
      >
        <StatusIcon className="h-5 w-5" />
      </button>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className={`text-sm font-medium ${task.status === 'done' ? 'text-muted-foreground line-through' : 'text-foreground'}`}>
            {task.title}
          </span>
          {task.is_priority && <Badge variant="default" className="text-[10px] px-1.5 py-0">Priority</Badge>}
        </div>
        {task.description && <p className="text-xs text-muted-foreground mt-1 line-clamp-1">{task.description}</p>}
        {task.status === 'blocked' && task.blocked_reason && (
          <p className="text-xs text-destructive mt-1">Blocked: {task.blocked_reason}</p>
        )}
        <div className="flex items-center gap-3 mt-1.5">
          {task.due_date && (
            <span className="text-[11px] text-muted-foreground">
              {new Date(task.due_date).toLocaleDateString()}
            </span>
          )}
        </div>
      </div>

      <div className="flex items-center gap-1 shrink-0">
        <Select value={task.status} onValueChange={(v) => onStatusChange(task.id, v as TaskStatus)}>
          <SelectTrigger className="w-[110px] h-7 text-xs bg-input border-border">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-popover border-border">
            {Object.entries(statusConfig).map(([key, config]) => (
              <SelectItem key={key} value={key} className="text-xs">{config.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onTogglePriority(task.id, task.is_priority)}>
          <span className={task.is_priority ? 'text-primary' : 'text-muted-foreground'}>★</span>
        </Button>
      </div>
    </div>
  );
}

export { statusConfig };
