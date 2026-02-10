import { Circle, CheckCircle2, AlertCircle, Clock, MessageSquare } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { TaskActions } from '@/components/workboard/TaskActions';
import { ULLText } from '@/components/ull/ULLText';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { getTaskChatSource } from '@/hooks/useChatTaskLinks';
import type { WorkboardTask, TaskStatus } from '@/hooks/useWorkboardTasks';

const statusKeys: Record<TaskStatus, string> = {
  backlog: 'workboard.status.backlog',
  planned: 'workboard.status.planned',
  in_progress: 'workboard.status.inProgress',
  blocked: 'workboard.status.blocked',
  done: 'workboard.status.done',
};

const statusIcons: Record<TaskStatus, React.ElementType> = {
  backlog: Circle,
  planned: Clock,
  in_progress: Circle,
  blocked: AlertCircle,
  done: CheckCircle2,
};

const statusColors: Record<TaskStatus, string> = {
  backlog: 'text-muted-foreground',
  planned: 'text-blue-500',
  in_progress: 'text-yellow-500',
  blocked: 'text-destructive',
  done: 'text-green-500',
};

interface TaskCardProps {
  task: WorkboardTask;
  onStatusChange: (taskId: string, status: TaskStatus) => void;
  onTogglePriority: (taskId: string, current: boolean) => void;
}

export function TaskCard({ task, onStatusChange, onTogglePriority }: TaskCardProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const StatusIcon = statusIcons[task.status];
  const chatSource = getTaskChatSource(task.meaning_json);

  return (
    <div className={`flex items-start gap-3 p-4 rounded-lg border border-border bg-card ${task.is_priority ? 'ring-1 ring-primary/50' : ''}`}>
      <button
        onClick={() => onStatusChange(task.id, task.status === 'done' ? 'in_progress' : 'done')}
        className={`mt-0.5 ${statusColors[task.status]}`}
      >
        <StatusIcon className="h-5 w-5" />
      </button>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <ULLText
            meaningId={(task as any).meaning_object_id}
            table="tasks"
            id={task.id}
            field="title"
            fallback={task.title}
            sourceLang={(task as any).source_lang || 'en'}
            className={`text-sm font-medium ${task.status === 'done' ? 'text-muted-foreground line-through' : 'text-foreground'}`}
          />
          {task.is_priority && <Badge variant="default" className="text-[10px] px-1.5 py-0">{t('workboard.priority')}</Badge>}
        </div>
        {task.description && (
          <ULLText
            meaningId={(task as any).meaning_object_id}
            table="tasks"
            id={task.id}
            field="description"
            fallback={task.description}
            sourceLang={(task as any).source_lang || 'en'}
            className="text-xs text-muted-foreground mt-1 line-clamp-1"
            as="p"
          />
        )}
        {task.status === 'blocked' && task.blocked_reason && (
          <p className="text-xs text-destructive mt-1">{t('workboard.status.blocked')}: {task.blocked_reason}</p>
        )}
        <div className="flex items-center gap-3 mt-1.5">
          {task.due_date && (
            <span className="text-[11px] text-muted-foreground">
              {new Date(task.due_date).toLocaleDateString()}
            </span>
          )}
          {chatSource && (
            <button
              onClick={() => navigate(`/apps/chat?thread=${chatSource.sourceThreadId}&msg=${chatSource.sourceMessageId}`)}
              className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
            >
              <MessageSquare className="h-3 w-3" />
              <span>Discussed in TeamChat</span>
            </button>
          )}
        </div>
      </div>

      <div className="flex items-center gap-1 shrink-0">
        <Select value={task.status} onValueChange={(v) => onStatusChange(task.id, v as TaskStatus)}>
          <SelectTrigger className="w-[110px] h-7 text-xs bg-input border-border">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-popover border-border">
            {(Object.keys(statusKeys) as TaskStatus[]).map((key) => (
              <SelectItem key={key} value={key} className="text-xs">{t(statusKeys[key])}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onTogglePriority(task.id, task.is_priority)}>
          <span className={task.is_priority ? 'text-primary' : 'text-muted-foreground'}>★</span>
        </Button>
        <TaskActions title={task.title} description={task.description} id={task.id} type="task" />
      </div>
    </div>
  );
}

// Export for backward compatibility
const statusConfig: Record<TaskStatus, { label: string; icon: React.ElementType; color: string }> = {
  backlog: { label: 'Backlog', icon: Circle, color: 'text-muted-foreground' },
  planned: { label: 'Planned', icon: Clock, color: 'text-blue-500' },
  in_progress: { label: 'In Progress', icon: Circle, color: 'text-yellow-500' },
  blocked: { label: 'Blocked', icon: AlertCircle, color: 'text-destructive' },
  done: { label: 'Done', icon: CheckCircle2, color: 'text-green-500' },
};
export { statusConfig };
