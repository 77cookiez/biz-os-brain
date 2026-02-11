import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useOIL } from '@/hooks/useOIL';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { createMeaningObject, buildMeaningFromText } from '@/lib/meaningObject';
import { guardMeaningInsert } from '@/lib/meaningGuard';

interface AddTaskDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onTaskCreated: () => void;
}

export function AddTaskDialog({ open, onOpenChange, onTaskCreated }: AddTaskDialogProps) {
  const { t } = useTranslation();
  const { currentWorkspace } = useWorkspace();
  const { user } = useAuth();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [saving, setSaving] = useState(false);
  const { currentLanguage } = useLanguage();
  const { emitEvent } = useOIL();

  const handleSave = async () => {
    if (!title.trim() || !currentWorkspace || !user) return;
    setSaving(true);

    const meaningId = await createMeaningObject({
      workspaceId: currentWorkspace.id,
      createdBy: user.id,
      type: 'TASK',
      sourceLang: currentLanguage.code,
      meaningJson: buildMeaningFromText({
        type: 'TASK',
        title: title.trim(),
        description: description.trim() || undefined,
      }),
    });

    const insertPayload = {
      title: title.trim(),
      description: description.trim() || null,
      due_date: dueDate || null,
      workspace_id: currentWorkspace.id,
      created_by: user.id,
      status: 'planned',
      is_priority: false,
      source_lang: currentLanguage.code,
      meaning_object_id: meaningId,
    };
    guardMeaningInsert('tasks', insertPayload);
    const { error } = await supabase.from('tasks').insert(insertPayload as any);
    setSaving(false);
    if (error) {
      toast.error(t('common.error'));
    } else {
      toast.success(t('common.success'));
      emitEvent({
        event_type: 'task.created',
        object_type: 'task',
        meaning_object_id: meaningId || undefined,
        metadata: { source: 'brain' },
      });
      setTitle('');
      setDescription('');
      setDueDate('');
      onOpenChange(false);
      onTaskCreated();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t('today.addTask')}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>{t('today.taskTitle')}</Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={t('today.taskTitlePlaceholder')}
              onKeyDown={(e) => e.key === 'Enter' && handleSave()}
            />
          </div>
          <div className="space-y-2">
            <Label>{t('today.taskDescription')}</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t('today.taskDescriptionPlaceholder')}
              rows={3}
            />
          </div>
          <div className="space-y-2">
            <Label>{t('today.dueDate')}</Label>
            <Input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t('common.cancel')}
          </Button>
          <Button onClick={handleSave} disabled={!title.trim() || saving}>
            {t('common.save')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
