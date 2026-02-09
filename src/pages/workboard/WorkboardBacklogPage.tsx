import { useState } from 'react';
import { Plus, Inbox } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { useWorkboardTasks } from '@/hooks/useWorkboardTasks';
import { TaskCard } from '@/components/workboard/TaskCard';
import { AddWorkboardTaskDialog } from '@/components/workboard/AddWorkboardTaskDialog';

export default function WorkboardBacklogPage() {
  const { tasks, loading, createTask, updateTask } = useWorkboardTasks();
  const [showAdd, setShowAdd] = useState(false);
  const [tab, setTab] = useState('backlog');

  const handleStatusChange = (id: string, status: any) => updateTask(id, { status });
  const handleTogglePriority = (id: string, current: boolean) => updateTask(id, { is_priority: !current });

  const backlogTasks = tasks.filter(t => t.status === 'backlog');
  const plannedTasks = tasks.filter(t => t.status === 'planned');
  const blockedTasks = tasks.filter(t => t.status === 'blocked');

  if (loading) return <div className="flex items-center justify-center py-12 text-muted-foreground">Loading...</div>;

  const renderList = (items: typeof tasks) =>
    items.length === 0 ? (
      <Card className="border-border bg-card">
        <CardContent className="py-8 text-center">
          <Inbox className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">Empty</p>
        </CardContent>
      </Card>
    ) : (
      <div className="space-y-2">
        {items.map(task => (
          <TaskCard key={task.id} task={task} onStatusChange={handleStatusChange} onTogglePriority={handleTogglePriority} />
        ))}
      </div>
    );

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-foreground">Backlog</h1>
        <Button size="sm" onClick={() => setShowAdd(true)} className="gap-1.5">
          <Plus className="h-3.5 w-3.5" /> Add Task
        </Button>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="bg-muted">
          <TabsTrigger value="backlog">Backlog <Badge variant="secondary" className="ml-1.5">{backlogTasks.length}</Badge></TabsTrigger>
          <TabsTrigger value="planned">Planned <Badge variant="secondary" className="ml-1.5">{plannedTasks.length}</Badge></TabsTrigger>
          <TabsTrigger value="blocked">Blocked <Badge variant="destructive" className="ml-1.5">{blockedTasks.length}</Badge></TabsTrigger>
        </TabsList>
        <TabsContent value="backlog" className="mt-4">{renderList(backlogTasks)}</TabsContent>
        <TabsContent value="planned" className="mt-4">{renderList(plannedTasks)}</TabsContent>
        <TabsContent value="blocked" className="mt-4">{renderList(blockedTasks)}</TabsContent>
      </Tabs>

      <AddWorkboardTaskDialog open={showAdd} onOpenChange={setShowAdd} onSubmit={createTask} />
    </div>
  );
}
