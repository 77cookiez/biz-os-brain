import { useState, useEffect } from 'react';
import { Plus, CheckCircle2, Circle, AlertCircle, Clock, Filter, Users, UserPlus, Mail, MessageCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { createMeaningObject, buildMeaningFromText } from '@/lib/meaningObject';
import { guardMeaningInsert } from '@/lib/meaningGuard';
import { useTeamMembers, PREDEFINED_ROLES, type TeamRole } from '@/hooks/useTeamMembers';

type TaskStatus = 'backlog' | 'planned' | 'in_progress' | 'blocked' | 'done';

interface Task {
  id: string;
  title: string;
  description: string | null;
  definition_of_done: string | null;
  status: TaskStatus;
  blocked_reason: string | null;
  is_priority: boolean;
  due_date: string | null;
  assigned_to: string | null;
}

const statusConfig: Record<TaskStatus, { label: string; icon: React.ElementType; color: string }> = {
  backlog: { label: 'Backlog', icon: Circle, color: 'text-muted-foreground' },
  planned: { label: 'Planned', icon: Clock, color: 'text-blue-500' },
  in_progress: { label: 'In Progress', icon: Circle, color: 'text-yellow-500' },
  blocked: { label: 'Blocked', icon: AlertCircle, color: 'text-destructive' },
  done: { label: 'Done', icon: CheckCircle2, color: 'text-green-500' },
};

export default function TeamTasksPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [activeTab, setActiveTab] = useState<TaskStatus | 'all'>('all');
  const [showTaskDialog, setShowTaskDialog] = useState(false);
  const [showInviteDialog, setShowInviteDialog] = useState(false);
  const [newTask, setNewTask] = useState({
    title: '',
    description: '',
    definitionOfDone: '',
    status: 'backlog' as TaskStatus,
    dueDate: '',
    assignedTo: '',
  });
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<TeamRole>('operations');
  const [customRoleName, setCustomRoleName] = useState('');
  const [inviting, setInviting] = useState(false);
  const { currentWorkspace, businessContext } = useWorkspace();
  const { user } = useAuth();
  const { currentLanguage } = useLanguage();
  const { members, inviteMember, generateWhatsAppLink } = useTeamMembers();

  useEffect(() => {
    if (currentWorkspace) {
      fetchTasks();
    }
  }, [currentWorkspace?.id]);

  const fetchTasks = async () => {
    if (!currentWorkspace) return;
    const { data } = await supabase
      .from('tasks')
      .select('*')
      .eq('workspace_id', currentWorkspace.id)
      .order('is_priority', { ascending: false })
      .order('created_at', { ascending: false });
    setTasks((data as Task[]) || []);
  };

  const createTask = async () => {
    if (!currentWorkspace || !user) return;

    const meaningId = await createMeaningObject({
      workspaceId: currentWorkspace.id,
      createdBy: user.id,
      type: 'TASK',
      sourceLang: currentLanguage.code,
      meaningJson: buildMeaningFromText({
        type: 'TASK',
        title: newTask.title,
        description: newTask.description || undefined,
      }),
    });
    
    const insertPayload = {
      workspace_id: currentWorkspace.id,
      title: newTask.title,
      description: newTask.description || null,
      definition_of_done: newTask.definitionOfDone || null,
      status: newTask.status,
      due_date: newTask.dueDate || null,
      assigned_to: newTask.assignedTo || null,
      created_by: user.id,
      source_lang: currentLanguage.code,
      meaning_object_id: meaningId,
    };
    guardMeaningInsert('tasks', insertPayload);
    const { error } = await supabase.from('tasks').insert(insertPayload as any);

    if (error) {
      toast.error('Failed to create task');
    } else {
      toast.success('Task created!');
      setShowTaskDialog(false);
      setNewTask({
        title: '',
        description: '',
        definitionOfDone: '',
        status: 'backlog',
        dueDate: '',
        assignedTo: '',
      });
      fetchTasks();
    }
  };

  const updateTaskStatus = async (taskId: string, newStatus: TaskStatus, blockedReason?: string) => {
    const updates: any = { status: newStatus };
    if (newStatus === 'done') {
      updates.completed_at = new Date().toISOString();
    }
    if (newStatus === 'blocked' && blockedReason) {
      updates.blocked_reason = blockedReason;
    }
    
    await supabase.from('tasks').update(updates).eq('id', taskId);
    fetchTasks();
  };

  const togglePriority = async (taskId: string, currentPriority: boolean) => {
    await supabase.from('tasks').update({ is_priority: !currentPriority }).eq('id', taskId);
    fetchTasks();
  };

  const filteredTasks = activeTab === 'all' ? tasks : tasks.filter(t => t.status === activeTab);

  const taskCounts = {
    all: tasks.length,
    backlog: tasks.filter(t => t.status === 'backlog').length,
    planned: tasks.filter(t => t.status === 'planned').length,
    in_progress: tasks.filter(t => t.status === 'in_progress').length,
    blocked: tasks.filter(t => t.status === 'blocked').length,
    done: tasks.filter(t => t.status === 'done').length,
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Team Tasks</h1>
          <p className="text-muted-foreground">
            {businessContext?.has_team ? `${members.length} team members` : 'Solo mode'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {businessContext?.has_team && (
            <Dialog open={showInviteDialog} onOpenChange={setShowInviteDialog}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm">
                  <UserPlus className="h-4 w-4 mr-2" />
                  Invite
                </Button>
              </DialogTrigger>
              <DialogContent className="bg-card border-border">
                <DialogHeader>
                  <DialogTitle className="text-foreground">Invite Team Member</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 pt-4">
                  <Input
                    type="email"
                    placeholder="Email address"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    className="bg-input border-border text-foreground"
                  />
                  <Select value={inviteRole} onValueChange={(v) => setInviteRole(v as TeamRole)}>
                    <SelectTrigger className="bg-input border-border text-foreground">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-popover border-border">
                      {PREDEFINED_ROLES.filter(r => r.value !== 'owner').map(r => (
                        <SelectItem key={r.value} value={r.value}>{r.value.charAt(0).toUpperCase() + r.value.slice(1)}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {inviteRole === 'custom' && (
                    <Input
                      placeholder="Custom role name"
                      value={customRoleName}
                      onChange={(e) => setCustomRoleName(e.target.value)}
                      className="bg-input border-border text-foreground"
                    />
                  )}
                  <div className="flex gap-2">
                    <Button 
                      className="flex-1"
                      disabled={inviting || !inviteEmail.trim()}
                      onClick={async () => {
                        setInviting(true);
                        const ok = await inviteMember(inviteEmail.trim(), inviteRole, customRoleName.trim() || undefined);
                        if (ok) {
                          setInviteEmail('');
                          setCustomRoleName('');
                          setShowInviteDialog(false);
                        }
                        setInviting(false);
                      }}
                    >
                      <Mail className="h-4 w-4 mr-2" />
                      {inviting ? 'Sending...' : 'Send Invitation'}
                    </Button>
                  </div>
                  <Button 
                    variant="outline"
                    className="w-full gap-2"
                    onClick={() => {
                      if (currentWorkspace) {
                        window.open(generateWhatsAppLink(currentWorkspace.name), '_blank');
                      }
                    }}
                  >
                    <MessageCircle className="h-4 w-4" />
                    Invite via WhatsApp
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          )}

          <Dialog open={showTaskDialog} onOpenChange={setShowTaskDialog}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="h-4 w-4 mr-2" />
                Add Task
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-card border-border">
              <DialogHeader>
                <DialogTitle className="text-foreground">Create Task</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-4">
                <Input
                  placeholder="Task title"
                  value={newTask.title}
                  onChange={(e) => setNewTask({ ...newTask, title: e.target.value })}
                  className="bg-input border-border text-foreground"
                />
                <Textarea
                  placeholder="Description (optional)"
                  value={newTask.description}
                  onChange={(e) => setNewTask({ ...newTask, description: e.target.value })}
                  className="bg-input border-border text-foreground"
                />
                <Textarea
                  placeholder="Definition of Done (optional)"
                  value={newTask.definitionOfDone}
                  onChange={(e) => setNewTask({ ...newTask, definitionOfDone: e.target.value })}
                  className="bg-input border-border text-foreground"
                />
                <div className="grid grid-cols-2 gap-3">
                  <Select value={newTask.status} onValueChange={(v) => setNewTask({ ...newTask, status: v as TaskStatus })}>
                    <SelectTrigger className="bg-input border-border text-foreground">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-popover border-border">
                      {Object.entries(statusConfig).map(([key, config]) => (
                        <SelectItem key={key} value={key}>{config.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input
                    type="date"
                    value={newTask.dueDate}
                    onChange={(e) => setNewTask({ ...newTask, dueDate: e.target.value })}
                    className="bg-input border-border text-foreground"
                  />
                </div>
                {businessContext?.has_team && members.length > 0 && (
                  <Select 
                    value={newTask.assignedTo || "unassigned"} 
                    onValueChange={(v) => setNewTask({ ...newTask, assignedTo: v === "unassigned" ? "" : v })}
                  >
                    <SelectTrigger className="bg-input border-border text-foreground">
                      <SelectValue placeholder="Assign to (optional)" />
                    </SelectTrigger>
                    <SelectContent className="bg-popover border-border">
                      <SelectItem value="unassigned">Unassigned</SelectItem>
                      {members.map(member => (
                        <SelectItem key={member.id} value={member.user_id}>
                          {member.full_name} ({member.team_role})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
                <Button onClick={createTask} disabled={!newTask.title.trim()} className="w-full">
                  Create Task
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Status Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as TaskStatus | 'all')}>
        <TabsList className="bg-muted">
          <TabsTrigger value="all" className="gap-2">
            All <Badge variant="secondary" className="ml-1">{taskCounts.all}</Badge>
          </TabsTrigger>
          <TabsTrigger value="backlog" className="gap-2">
            Backlog <Badge variant="secondary" className="ml-1">{taskCounts.backlog}</Badge>
          </TabsTrigger>
          <TabsTrigger value="in_progress" className="gap-2">
            In Progress <Badge variant="secondary" className="ml-1">{taskCounts.in_progress}</Badge>
          </TabsTrigger>
          <TabsTrigger value="blocked" className="gap-2">
            Blocked <Badge variant="destructive" className="ml-1">{taskCounts.blocked}</Badge>
          </TabsTrigger>
          <TabsTrigger value="done" className="gap-2">
            Done <Badge variant="secondary" className="ml-1">{taskCounts.done}</Badge>
          </TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab} className="mt-4">
          {filteredTasks.length === 0 ? (
            <Card className="border-border bg-card">
              <CardContent className="py-12 text-center">
                <CheckCircle2 className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="font-medium text-foreground mb-2">No tasks</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  {activeTab === 'all' ? 'Create your first task to get started' : `No ${activeTab.replace('_', ' ')} tasks`}
                </p>
                <Button onClick={() => setShowTaskDialog(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Task
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {filteredTasks.map(task => {
                const StatusIcon = statusConfig[task.status].icon;
                const assignedMember = members.find(m => m.user_id === task.assigned_to);

                return (
                  <Card key={task.id} className={`border-border bg-card ${task.is_priority ? 'ring-1 ring-primary/50' : ''}`}>
                    <CardContent className="py-4">
                      <div className="flex items-start gap-3">
                        <button
                          onClick={() => {
                            if (task.status === 'done') {
                              updateTaskStatus(task.id, 'in_progress');
                            } else {
                              updateTaskStatus(task.id, 'done');
                            }
                          }}
                          className={`mt-0.5 ${statusConfig[task.status].color}`}
                        >
                          <StatusIcon className="h-5 w-5" />
                        </button>
                        
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <h3 className={`font-medium ${task.status === 'done' ? 'text-muted-foreground line-through' : 'text-foreground'}`}>
                              {task.title}
                            </h3>
                            {task.is_priority && (
                              <Badge variant="default" className="text-xs">Priority</Badge>
                            )}
                          </div>
                          
                          {task.description && (
                            <p className="text-sm text-muted-foreground mt-1">{task.description}</p>
                          )}
                          
                          {task.status === 'blocked' && task.blocked_reason && (
                            <p className="text-sm text-destructive mt-1">Blocked: {task.blocked_reason}</p>
                          )}
                          
                          <div className="flex items-center gap-3 mt-2">
                            {task.due_date && (
                              <span className="text-xs text-muted-foreground">
                                Due: {new Date(task.due_date).toLocaleDateString()}
                              </span>
                            )}
                            {assignedMember && (
                              <span className="text-xs text-muted-foreground">
                                → {assignedMember.full_name}
                              </span>
                            )}
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-1">
                          <Select
                            value={task.status}
                            onValueChange={(v) => updateTaskStatus(task.id, v as TaskStatus)}
                          >
                            <SelectTrigger className="w-[120px] h-8 text-xs bg-input border-border text-foreground">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="bg-popover border-border">
                              {Object.entries(statusConfig).map(([key, config]) => (
                                <SelectItem key={key} value={key} className="text-xs">{config.label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => togglePriority(task.id, task.is_priority)}
                          >
                            <span className={task.is_priority ? 'text-primary' : 'text-muted-foreground'}>★</span>
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
