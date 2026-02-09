import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { useTranslation } from 'react-i18next';
import type { TaskStatus } from '@/hooks/useWorkboardTasks';

interface AddWorkboardTaskDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (task: { title: string; description?: string; status?: TaskStatus; due_date?: string; is_priority?: boolean }) => void;
  defaultStatus?: TaskStatus;
  defaultDate?: string;
}

export function AddWorkboardTaskDialog({ open, onOpenChange, onSubmit, defaultStatus = 'backlog', defaultDate }: AddWorkboardTaskDialogProps) {
  const { t } = useTranslation();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<TaskStatus>(defaultStatus);
  const [dueDate, setDueDate] = useState(defaultDate || '');
  const [isPriority, setIsPriority] = useState(false);

  const handleSubmit = () => {
    if (!title.trim()) return;
    onSubmit({ title, description: description || undefined, status, due_date: dueDate || undefined, is_priority: isPriority });
    setTitle('');
    setDescription('');
    setStatus(defaultStatus);
    setDueDate(defaultDate || '');
    setIsPriority(false);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-border">
        <DialogHeader>
          <DialogTitle className="text-foreground">{t('workboard.newTask')}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <Input placeholder={t('workboard.taskTitle')} value={title} onChange={e => setTitle(e.target.value)} className="bg-input border-border" />
          <Textarea placeholder={t('workboard.description')} value={description} onChange={e => setDescription(e.target.value)} className="bg-input border-border" rows={2} />
          <div className="grid grid-cols-2 gap-3">
            <Select value={status} onValueChange={v => setStatus(v as TaskStatus)}>
              <SelectTrigger className="bg-input border-border"><SelectValue /></SelectTrigger>
              <SelectContent className="bg-popover border-border">
                <SelectItem value="backlog">{t('workboard.status.backlog')}</SelectItem>
                <SelectItem value="planned">{t('workboard.status.planned')}</SelectItem>
                <SelectItem value="in_progress">{t('workboard.status.inProgress')}</SelectItem>
              </SelectContent>
            </Select>
            <Input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} className="bg-input border-border" />
          </div>
          <div className="flex items-center gap-2">
            <Checkbox id="priority" checked={isPriority} onCheckedChange={v => setIsPriority(!!v)} />
            <label htmlFor="priority" className="text-sm text-foreground">{t('workboard.markAsPriority')}</label>
          </div>
          <Button onClick={handleSubmit} disabled={!title.trim()} className="w-full">{t('workboard.createTask')}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
