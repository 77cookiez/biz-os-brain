import { useState, useMemo } from 'react';
import { Plus, Target, AlertCircle, Calendar, CheckCircle2, Circle, Clock, UserPlus, Mail, MessageCircle, Sparkles, Inbox } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { ULLText } from '@/components/ull/ULLText';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useWorkboardTasks, type TaskStatus } from '@/hooks/useWorkboardTasks';
import { useTeamMembers, PREDEFINED_ROLES, type TeamRole } from '@/hooks/useTeamMembers';
import { useAiAssignee } from '@/hooks/useAiAssignee';
import { TaskCard } from '@/components/workboard/TaskCard';
import { AddWorkboardTaskDialog } from '@/components/workboard/AddWorkboardTaskDialog';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { createMeaningObject, buildMeaningFromText } from '@/lib/meaningObject';
import { guardMeaningInsert } from '@/lib/meaningGuard';
import { TaskListSkeleton } from '@/components/ui/list-skeleton';

type ViewMode = 'today' | 'week' | 'all';
type AssignmentFilter = 'all' | 'mine' | 'team';
type AssignmentSource = 'ai' | 'manager' | 'self';

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

const statusConfig: Record<TaskStatus, { icon: React.ElementType; color: string }> = {
  backlog: { icon: Circle, color: 'text-muted-foreground' },
  planned: { icon: Clock, color: 'text-blue-500' },
  in_progress: { icon: Circle, color: 'text-yellow-500' },
  blocked: { icon: AlertCircle, color: 'text-destructive' },
  done: { icon: CheckCircle2, color: 'text-green-500' },
};

export default function UnifiedTasksPage() {
  const { t } = useTranslation();
  const [viewMode, setViewMode] = useState<ViewMode>('today');
  const [assignmentFilter, setAssignmentFilter] = useState<AssignmentFilter>('all');
  const [statusFilter, setStatusFilter] = useState<TaskStatus | 'all'>('all');
  const [showAdd, setShowAdd] = useState(false);
  const [showTeamTaskDialog, setShowTeamTaskDialog] = useState(false);
  const [showInviteDialog, setShowInviteDialog] = useState(false);

  // Team task creation state
  const [newTask, setNewTask] = useState({
    title: '', description: '', definitionOfDone: '',
    status: 'backlog' as TaskStatus, dueDate: '', assignedTo: '',
    assignmentSource: 'manager' as AssignmentSource,
  });
  const [aiReason, setAiReason] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<TeamRole>('operations');
  const [customRoleName, setCustomRoleName] = useState('');
  const [inviting, setInviting] = useState(false);

  const { tasks, loading, createTask, updateTask } = useWorkboardTasks();
  const { currentWorkspace, businessContext } = useWorkspace();
  const { user } = useAuth();
  const { currentLanguage } = useLanguage();
  const { members, inviteMember, generateWhatsAppLink } = useTeamMembers();
  const { suggestAssignee, suggesting } = useAiAssignee();

  const today = new Date().toISOString().split('T')[0];
  const weekDays = useMemo(getWeekDays, []);
  const hasTeam = businessContext?.has_team && members.length > 0;

  // Compute task counts per member for AI context
  const memberTaskCounts = useMemo(() => {
    const counts: Record<string, { active: number; blocked: number }> = {};
    for (const m of members) { counts[m.user_id] = { active: 0, blocked: 0 }; }
    for (const task of tasks) {
      if (task.assigned_to && counts[task.assigned_to]) {
        if (task.status !== 'done') counts[task.assigned_to].active++;
        if (task.status === 'blocked') counts[task.assigned_to].blocked++;
      }
    }
    return counts;
  }, [members, tasks]);

  // Filter by assignment
  const assignmentFiltered = useMemo(() => {
    if (assignmentFilter === 'mine') return tasks.filter(t => t.assigned_to === user?.id || t.created_by === user?.id);
    if (assignmentFilter === 'team') return tasks.filter(t => t.assigned_to && t.assigned_to !== user?.id);
    return tasks;
  }, [tasks, assignmentFilter, user?.id]);

  const handleStatusChange = (id: string, status: TaskStatus) => updateTask(id, { status });
  const handleTogglePriority = (id: string, current: boolean) => updateTask(id, { is_priority: !current });

  const handleAiSuggest = async () => {
    if (!newTask.title.trim()) return;
    const teamData = members.map(m => ({
      user_id: m.user_id, full_name: m.full_name, team_role: m.team_role,
      taskCount: memberTaskCounts[m.user_id]?.active || 0,
      blockedCount: memberTaskCounts[m.user_id]?.blocked || 0,
    }));
    const result = await suggestAssignee(newTask.title, newTask.description, teamData);
    if (result) {
      setNewTask(prev => ({ ...prev, assignedTo: result.user_id, assignmentSource: 'ai' }));
      setAiReason(result.reason);
      toast.success(t('teamTasks.aiSuggestionReason', { reason: result.reason }));
    }
  };

  const createTeamTask = async () => {
    if (!currentWorkspace || !user) return;
    const meaningId = await createMeaningObject({
      workspaceId: currentWorkspace.id, createdBy: user.id, type: 'TASK',
      sourceLang: currentLanguage.code,
      meaningJson: buildMeaningFromText({ type: 'TASK', title: newTask.title, description: newTask.description || undefined }),
    });
    const insertPayload = {
      workspace_id: currentWorkspace.id, title: newTask.title,
      description: newTask.description || null, definition_of_done: newTask.definitionOfDone || null,
      status: newTask.status, due_date: newTask.dueDate || null,
      assigned_to: newTask.assignedTo || null,
      assigned_by: newTask.assignedTo ? user.id : null,
      assignment_source: newTask.assignedTo ? newTask.assignmentSource : null,
      created_by: user.id, source_lang: currentLanguage.code, meaning_object_id: meaningId,
    };
    guardMeaningInsert('tasks', insertPayload);
    const { error } = await supabase.from('tasks').insert(insertPayload as any);
    if (error) { toast.error(t('teamTasks.taskCreateFailed')); }
    else {
      toast.success(t('teamTasks.taskCreated'));
      setShowTeamTaskDialog(false);
      setNewTask({ title: '', description: '', definitionOfDone: '', status: 'backlog', dueDate: '', assignedTo: '', assignmentSource: 'manager' });
      setAiReason('');
    }
  };

  if (loading) return <TaskListSkeleton count={6} />;

  // ========== TODAY VIEW ==========
  const renderTodayView = () => {
    const filtered = assignmentFiltered;
    const priorityTasks = filtered.filter(t => t.is_priority && t.status !== 'done').slice(0, 3);
    const overdueTasks = filtered.filter(t => t.due_date && t.due_date < today && t.status !== 'done');
    const todayTasks = filtered.filter(t => t.due_date === today && !t.is_priority && t.status !== 'done');
    const inProgress = filtered.filter(t => t.status === 'in_progress' && !t.is_priority);

    return (
      <div className="space-y-6">
        {priorityTasks.length > 0 && (
          <Card className="border-border bg-card">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                <Target className="h-4 w-4 text-primary" /> {t('workboard.todayPage.topPriorities')}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {priorityTasks.map(task => <TaskCard key={task.id} task={task} onStatusChange={handleStatusChange} onTogglePriority={handleTogglePriority} />)}
            </CardContent>
          </Card>
        )}
        {overdueTasks.length > 0 && (
          <Card className="border-destructive/50 bg-card">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-destructive uppercase tracking-wider flex items-center gap-2">
                <AlertCircle className="h-4 w-4" /> {t('workboard.todayPage.overdue')}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {overdueTasks.map(task => <TaskCard key={task.id} task={task} onStatusChange={handleStatusChange} onTogglePriority={handleTogglePriority} />)}
            </CardContent>
          </Card>
        )}
        {todayTasks.length > 0 && (
          <Card className="border-border bg-card">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                <Calendar className="h-4 w-4" /> {t('workboard.todayPage.todaysTasks')}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {todayTasks.map(task => <TaskCard key={task.id} task={task} onStatusChange={handleStatusChange} onTogglePriority={handleTogglePriority} />)}
            </CardContent>
          </Card>
        )}
        {inProgress.length > 0 && (
          <Card className="border-border bg-card">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">{t('workboard.todayPage.inProgress')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {inProgress.map(task => <TaskCard key={task.id} task={task} onStatusChange={handleStatusChange} onTogglePriority={handleTogglePriority} />)}
            </CardContent>
          </Card>
        )}
        {filtered.filter(t => t.status !== 'done').length === 0 && (
          <Card className="border-border bg-card">
            <CardContent className="py-12 text-center">
              <CheckCircle2 className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
              <p className="text-muted-foreground">{t('workboard.todayPage.noActiveTasks')}</p>
            </CardContent>
          </Card>
        )}
      </div>
    );
  };

  // ========== WEEK VIEW ==========
  const renderWeekView = () => {
    const filtered = assignmentFiltered;
    return (
      <div className="space-y-4">
        {weekDays.map(day => {
          const dayTasks = filtered.filter(t => t.due_date === day.date && t.status !== 'done');
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
                  dayTasks.map(task => <TaskCard key={task.id} task={task} onStatusChange={handleStatusChange} onTogglePriority={handleTogglePriority} />)
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    );
  };

  // ========== ALL VIEW ==========
  const renderAllView = () => {
    const filtered = assignmentFiltered;
    const statusFiltered = statusFilter === 'all' ? filtered : filtered.filter(t => t.status === statusFilter);
    const taskCounts = {
      all: filtered.length,
      backlog: filtered.filter(t => t.status === 'backlog').length,
      in_progress: filtered.filter(t => t.status === 'in_progress').length,
      blocked: filtered.filter(t => t.status === 'blocked').length,
      done: filtered.filter(t => t.status === 'done').length,
    };

    return (
      <div className="space-y-4">
        <Tabs value={statusFilter} onValueChange={(v) => setStatusFilter(v as TaskStatus | 'all')}>
          <TabsList className="bg-muted overflow-x-auto scrollbar-hide w-full justify-start">
            <TabsTrigger value="all" className="gap-1 sm:gap-2">
              {t('teamTasks.all')} <Badge variant="secondary" className="ml-1 hidden sm:inline-flex">{taskCounts.all}</Badge>
            </TabsTrigger>
            <TabsTrigger value="backlog" className="gap-1 sm:gap-2">
              {t('workboard.status.backlog')} <Badge variant="secondary" className="ml-1 hidden sm:inline-flex">{taskCounts.backlog}</Badge>
            </TabsTrigger>
            <TabsTrigger value="in_progress" className="gap-1 sm:gap-2">
              {t('workboard.status.inProgress')} <Badge variant="secondary" className="ml-1 hidden sm:inline-flex">{taskCounts.in_progress}</Badge>
            </TabsTrigger>
            <TabsTrigger value="blocked" className="gap-1 sm:gap-2">
              {t('workboard.status.blocked')} <Badge variant="destructive" className="ml-1 hidden sm:inline-flex">{taskCounts.blocked}</Badge>
            </TabsTrigger>
            <TabsTrigger value="done" className="gap-1 sm:gap-2">
              {t('workboard.status.done')} <Badge variant="secondary" className="ml-1 hidden sm:inline-flex">{taskCounts.done}</Badge>
            </TabsTrigger>
          </TabsList>
          <TabsContent value={statusFilter} className="mt-4">
            {statusFiltered.length === 0 ? (
              <Card className="border-border bg-card">
                <CardContent className="py-12 text-center">
                  <Inbox className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">{t('workboard.empty')}</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-2">
                {statusFiltered.map(task => {
                  const StatusIcon = statusConfig[task.status].icon;
                  const assignedMember = members.find(m => m.user_id === task.assigned_to);
                  return (
                    <Card key={task.id} className={`border-border bg-card ${task.is_priority ? 'ring-1 ring-primary/50' : ''}`}>
                      <CardContent className="py-4">
                        <div className="flex items-start gap-3">
                          <button onClick={() => handleStatusChange(task.id, task.status === 'done' ? 'in_progress' : 'done')} className={`mt-0.5 ${statusConfig[task.status].color}`}>
                            <StatusIcon className="h-5 w-5" />
                          </button>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <h3 className={`font-medium ${task.status === 'done' ? 'text-muted-foreground line-through' : 'text-foreground'}`}>
                                <ULLText meaningId={task.meaning_object_id} table="tasks" id={task.id} field="title" fallback={task.title} sourceLang={task.source_lang || 'en'} />
                              </h3>
                              {task.is_priority && <Badge variant="default" className="text-xs">{t('teamTasks.priority')}</Badge>}
                              {(task as any).assignment_source === 'ai' && (
                                <Badge className="text-xs bg-purple-500/20 text-purple-400 border-purple-500/30">
                                  <Sparkles className="h-3 w-3 mr-1" />{t('teamTasks.assignedByAi')}
                                </Badge>
                              )}
                              {(task as any).assignment_source === 'manager' && task.assigned_to && (
                                <Badge className="text-xs bg-blue-500/20 text-blue-400 border-blue-500/30">{t('teamTasks.assignedByManager')}</Badge>
                              )}
                            </div>
                            {task.description && (
                              <ULLText table="tasks" id={task.id} field="description" fallback={task.description} sourceLang={task.source_lang || 'en'} className="text-sm text-muted-foreground mt-1" as="p" />
                            )}
                            {task.status === 'blocked' && task.blocked_reason && (
                              <p className="text-sm text-destructive mt-1">{t('workboard.status.blocked')}: {task.blocked_reason}</p>
                            )}
                            <div className="flex items-center gap-3 mt-2">
                              {task.due_date && <span className="text-xs text-muted-foreground">{new Date(task.due_date).toLocaleDateString()}</span>}
                              {assignedMember && <span className="text-xs text-muted-foreground">→ {assignedMember.full_name}</span>}
                            </div>
                          </div>
                          <div className="flex items-center gap-1">
                            <Select value={task.status} onValueChange={(v) => handleStatusChange(task.id, v as TaskStatus)}>
                              <SelectTrigger className="w-[100px] sm:w-[120px] h-8 text-xs bg-input border-border text-foreground"><SelectValue /></SelectTrigger>
                              <SelectContent className="bg-popover border-border">
                                {(['backlog', 'planned', 'in_progress', 'blocked', 'done'] as TaskStatus[]).map(key => (
                                  <SelectItem key={key} value={key} className="text-xs">{t(`workboard.status.${key === 'in_progress' ? 'inProgress' : key}`)}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleTogglePriority(task.id, task.is_priority)}>
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
  };

  // ========== TEAM TASK CREATION DIALOG ==========
  const renderTeamTaskDialog = () => (
    <Dialog open={showTeamTaskDialog} onOpenChange={(open) => {
      setShowTeamTaskDialog(open);
      if (!open) { setAiReason(''); setNewTask(prev => ({ ...prev, assignmentSource: 'manager' })); }
    }}>
      <DialogContent className="bg-card border-border">
        <DialogHeader>
          <DialogTitle className="text-foreground">{t('teamTasks.createTaskTitle')}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-4">
          <Input placeholder={t('teamTasks.taskTitle')} value={newTask.title} onChange={(e) => setNewTask({ ...newTask, title: e.target.value })} className="bg-input border-border text-foreground" />
          <Textarea placeholder={t('teamTasks.description')} value={newTask.description} onChange={(e) => setNewTask({ ...newTask, description: e.target.value })} className="bg-input border-border text-foreground" />
          <Textarea placeholder={t('teamTasks.definitionOfDone')} value={newTask.definitionOfDone} onChange={(e) => setNewTask({ ...newTask, definitionOfDone: e.target.value })} className="bg-input border-border text-foreground" />
          <div className="grid grid-cols-2 gap-3">
            <Select value={newTask.status} onValueChange={(v) => setNewTask({ ...newTask, status: v as TaskStatus })}>
              <SelectTrigger className="bg-input border-border text-foreground"><SelectValue /></SelectTrigger>
              <SelectContent className="bg-popover border-border">
                {(['backlog', 'planned', 'in_progress', 'blocked', 'done'] as TaskStatus[]).map(key => (
                  <SelectItem key={key} value={key}>{t(`workboard.status.${key === 'in_progress' ? 'inProgress' : key}`)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input type="date" value={newTask.dueDate} onChange={(e) => setNewTask({ ...newTask, dueDate: e.target.value })} className="bg-input border-border text-foreground" />
          </div>
          {hasTeam && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Select value={newTask.assignedTo || "unassigned"} onValueChange={(v) => setNewTask({ ...newTask, assignedTo: v === "unassigned" ? "" : v, assignmentSource: 'manager' })}>
                  <SelectTrigger className="bg-input border-border text-foreground flex-1"><SelectValue placeholder={t('teamTasks.assignTo')} /></SelectTrigger>
                  <SelectContent className="bg-popover border-border">
                    <SelectItem value="unassigned">{t('teamTasks.unassigned')}</SelectItem>
                    {members.map(member => (
                      <SelectItem key={member.id} value={member.user_id}>{member.full_name} ({member.team_role})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button type="button" variant="outline" size="sm" disabled={suggesting || !newTask.title.trim()} onClick={handleAiSuggest} className="gap-1 shrink-0">
                  <Sparkles className="h-4 w-4" />{suggesting ? t('teamTasks.suggesting') : t('teamTasks.suggestAssignee')}
                </Button>
              </div>
              {aiReason && <p className="text-xs text-muted-foreground animate-fade-in">✨ {aiReason}</p>}
            </div>
          )}
          <Button onClick={createTeamTask} disabled={!newTask.title.trim()} className="w-full">{t('teamTasks.createTask')}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );

  // ========== INVITE DIALOG ==========
  const renderInviteDialog = () => (
    <Dialog open={showInviteDialog} onOpenChange={setShowInviteDialog}>
      <DialogContent className="bg-card border-border">
        <DialogHeader>
          <DialogTitle className="text-foreground">{t('teamTasks.inviteTitle')}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-4">
          <Input type="email" placeholder={t('teamTasks.emailAddress')} value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} className="bg-input border-border text-foreground" />
          <Select value={inviteRole} onValueChange={(v) => setInviteRole(v as TeamRole)}>
            <SelectTrigger className="bg-input border-border text-foreground"><SelectValue /></SelectTrigger>
            <SelectContent className="bg-popover border-border">
              {PREDEFINED_ROLES.filter(r => r.value !== 'owner').map(r => (
                <SelectItem key={r.value} value={r.value}>{r.value.charAt(0).toUpperCase() + r.value.slice(1)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {inviteRole === 'custom' && (
            <Input placeholder={t('teamTasks.customRoleName')} value={customRoleName} onChange={(e) => setCustomRoleName(e.target.value)} className="bg-input border-border text-foreground" />
          )}
          <Button className="w-full" disabled={inviting || !inviteEmail.trim()} onClick={async () => {
            setInviting(true);
            const ok = await inviteMember(inviteEmail.trim(), inviteRole, customRoleName.trim() || undefined);
            if (ok) { setInviteEmail(''); setCustomRoleName(''); setShowInviteDialog(false); }
            setInviting(false);
          }}>
            <Mail className="h-4 w-4 mr-2" />{inviting ? t('teamTasks.sending') : t('teamTasks.sendInvitation')}
          </Button>
          <Button variant="outline" className="w-full gap-2" onClick={() => { if (currentWorkspace) window.open(generateWhatsAppLink(currentWorkspace.name), '_blank'); }}>
            <MessageCircle className="h-4 w-4" />{t('teamTasks.inviteViaWhatsApp')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-foreground">{t('workboard.tabs.tasks')}</h1>
          {hasTeam && <p className="text-xs text-muted-foreground">{t('teamTasks.teamMembers', { count: members.length })}</p>}
        </div>
        <div className="flex items-center gap-2">
          {hasTeam && (
            <Button variant="outline" size="sm" onClick={() => setShowInviteDialog(true)}>
              <UserPlus className="h-4 w-4 sm:mr-1" /><span className="hidden sm:inline">{t('teamTasks.inviteTeamMember')}</span>
            </Button>
          )}
          <Button size="sm" onClick={() => hasTeam ? setShowTeamTaskDialog(true) : setShowAdd(true)} className="gap-1.5">
            <Plus className="h-3.5 w-3.5" /> <span className="hidden sm:inline">{t('workboard.addTask')}</span>
          </Button>
        </div>
      </div>

      {/* View Switcher + Assignment Filter */}
      <div className="flex items-center gap-3 flex-wrap">
        <ToggleGroup type="single" value={viewMode} onValueChange={(v) => v && setViewMode(v as ViewMode)} size="sm" variant="outline">
          <ToggleGroupItem value="today">{t('workboard.views.today')}</ToggleGroupItem>
          <ToggleGroupItem value="week">{t('workboard.views.week')}</ToggleGroupItem>
          <ToggleGroupItem value="all">{t('workboard.views.all')}</ToggleGroupItem>
        </ToggleGroup>

        {hasTeam && (
          <ToggleGroup type="single" value={assignmentFilter} onValueChange={(v) => v && setAssignmentFilter(v as AssignmentFilter)} size="sm" variant="outline">
            <ToggleGroupItem value="all">{t('workboard.filters.all')}</ToggleGroupItem>
            <ToggleGroupItem value="mine">{t('workboard.filters.myTasks')}</ToggleGroupItem>
            <ToggleGroupItem value="team">{t('workboard.filters.teamTasks')}</ToggleGroupItem>
          </ToggleGroup>
        )}
      </div>

      {/* Views */}
      {viewMode === 'today' && renderTodayView()}
      {viewMode === 'week' && renderWeekView()}
      {viewMode === 'all' && renderAllView()}

      {/* Dialogs */}
      <AddWorkboardTaskDialog open={showAdd} onOpenChange={setShowAdd} onSubmit={createTask} defaultStatus="planned" defaultDate={today} />
      {renderTeamTaskDialog()}
      {renderInviteDialog()}
    </div>
  );
}
