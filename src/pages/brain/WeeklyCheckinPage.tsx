import { useState, useEffect } from 'react';
import { Calendar, CheckCircle2, AlertTriangle, Target, ArrowRight, Sparkles, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { useAuth } from '@/contexts/AuthContext';
import { useBrainChat } from '@/hooks/useBrainChat';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import ReactMarkdown from 'react-markdown';

interface Task {
  id: string;
  title: string;
  status: string;
}

interface CheckinData {
  completedItems: string[];
  blockedItems: { task: string; reason: string }[];
  nextPriorities: string[];
  risksDecisions: string[];
}

export default function WeeklyCheckinPage() {
  const [step, setStep] = useState(1);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [checkinData, setCheckinData] = useState<CheckinData>({
    completedItems: [],
    blockedItems: [],
    nextPriorities: ['', '', ''],
    risksDecisions: [],
  });
  const [newBlockedTask, setNewBlockedTask] = useState('');
  const [newBlockedReason, setNewBlockedReason] = useState('');
  const [newRisk, setNewRisk] = useState('');
  const [aiSummary, setAiSummary] = useState('');
  const [generating, setGenerating] = useState(false);
  const { currentWorkspace } = useWorkspace();
  const { user } = useAuth();
  const { sendMessage, messages, isLoading } = useBrainChat();

  const weekStart = new Date();
  weekStart.setDate(weekStart.getDate() - weekStart.getDay());
  const weekLabel = weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

  useEffect(() => {
    if (currentWorkspace) {
      fetchCompletedTasks();
    }
  }, [currentWorkspace?.id]);

  const fetchCompletedTasks = async () => {
    if (!currentWorkspace) return;
    
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    
    const { data } = await supabase
      .from('tasks')
      .select('id, title, status')
      .eq('workspace_id', currentWorkspace.id)
      .eq('status', 'done')
      .gte('completed_at', weekAgo);
    
    setTasks(data || []);
    if (data) {
      setCheckinData(prev => ({
        ...prev,
        completedItems: data.map(t => t.title)
      }));
    }
  };

  const addBlockedItem = () => {
    if (newBlockedTask.trim() && newBlockedReason.trim()) {
      setCheckinData(prev => ({
        ...prev,
        blockedItems: [...prev.blockedItems, { task: newBlockedTask, reason: newBlockedReason }]
      }));
      setNewBlockedTask('');
      setNewBlockedReason('');
    }
  };

  const addRisk = () => {
    if (newRisk.trim()) {
      setCheckinData(prev => ({
        ...prev,
        risksDecisions: [...prev.risksDecisions, newRisk]
      }));
      setNewRisk('');
    }
  };

  const generateSummary = async () => {
    setGenerating(true);
    
    const prompt = `Generate a weekly check-in summary for a business owner. Here's the data:

COMPLETED THIS WEEK:
${checkinData.completedItems.length > 0 ? checkinData.completedItems.map(i => `- ${i}`).join('\n') : 'No items marked as complete'}

BLOCKED ITEMS:
${checkinData.blockedItems.length > 0 ? checkinData.blockedItems.map(i => `- ${i.task}: ${i.reason}`).join('\n') : 'No blockers reported'}

NEXT WEEK PRIORITIES:
${checkinData.nextPriorities.filter(p => p.trim()).map(p => `- ${p}`).join('\n') || 'Not specified'}

RISKS & DECISIONS NEEDED:
${checkinData.risksDecisions.length > 0 ? checkinData.risksDecisions.map(r => `- ${r}`).join('\n') : 'None reported'}

Please provide:
1. A brief summary of the week (2-3 sentences)
2. Key observations
3. Recommended actions for next week
4. Any concerns or suggestions`;

    await sendMessage(prompt, 'weekly_checkin');
    setGenerating(false);
  };

  const saveCheckin = async () => {
    if (!currentWorkspace || !user) return;

    const lastMessage = messages[messages.length - 1];
    const summary = lastMessage?.role === 'assistant' ? lastMessage.content : '';

    const { error } = await supabase.from('weekly_checkins').insert({
      workspace_id: currentWorkspace.id,
      week_start: weekStart.toISOString().split('T')[0],
      completed_items: checkinData.completedItems,
      blocked_items: checkinData.blockedItems,
      next_week_priorities: checkinData.nextPriorities.filter(p => p.trim()),
      risks_and_decisions: checkinData.risksDecisions,
      ai_summary: summary,
      completed_by: user.id,
    });

    if (error) {
      toast.error('Failed to save check-in');
    } else {
      toast.success('Weekly check-in saved!');
    }
  };

  const lastAssistantMessage = messages.filter(m => m.role === 'assistant').pop();

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      {/* Header */}
      <div className="text-center space-y-2">
        <div className="inline-flex items-center justify-center h-14 w-14 rounded-2xl bg-primary/10 mb-3">
          <Calendar className="h-7 w-7 text-primary" />
        </div>
        <h1 className="text-2xl font-bold text-foreground">Weekly Check-in</h1>
        <p className="text-muted-foreground">Week of {weekLabel} • ~15 minutes</p>
      </div>

      {/* Progress */}
      <div className="flex items-center justify-center gap-2">
        {[1, 2, 3, 4, 5].map(s => (
          <div
            key={s}
            className={`h-2 w-12 rounded-full transition-colors ${
              s <= step ? 'bg-primary' : 'bg-muted'
            }`}
          />
        ))}
      </div>

      {/* Step 1: Completed */}
      {step === 1 && (
        <Card className="border-border bg-card">
          <CardHeader>
            <CardTitle className="text-foreground flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-500" />
              What was completed this week?
            </CardTitle>
            <CardDescription>Tasks marked as done in the last 7 days</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {checkinData.completedItems.length === 0 ? (
              <p className="text-muted-foreground text-sm">No tasks were completed this week.</p>
            ) : (
              checkinData.completedItems.map((item, i) => (
                <div key={i} className="flex items-center gap-2 p-3 rounded-lg bg-green-500/10">
                  <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
                  <span className="text-sm text-foreground">{item}</span>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      )}

      {/* Step 2: Blocked */}
      {step === 2 && (
        <Card className="border-border bg-card">
          <CardHeader>
            <CardTitle className="text-foreground flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-yellow-500" />
              What's blocked and why?
            </CardTitle>
            <CardDescription>Identify blockers so we can address them</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {checkinData.blockedItems.map((item, i) => (
              <div key={i} className="p-3 rounded-lg bg-yellow-500/10 space-y-1">
                <p className="text-sm font-medium text-foreground">{item.task}</p>
                <p className="text-xs text-muted-foreground">Reason: {item.reason}</p>
              </div>
            ))}
            <div className="space-y-2">
              <Textarea
                placeholder="What task is blocked?"
                value={newBlockedTask}
                onChange={(e) => setNewBlockedTask(e.target.value)}
                className="bg-input border-border text-foreground min-h-[60px]"
              />
              <Textarea
                placeholder="Why is it blocked?"
                value={newBlockedReason}
                onChange={(e) => setNewBlockedReason(e.target.value)}
                className="bg-input border-border text-foreground min-h-[60px]"
              />
              <Button variant="outline" size="sm" onClick={addBlockedItem}>
                Add Blocker
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 3: Priorities */}
      {step === 3 && (
        <Card className="border-border bg-card">
          <CardHeader>
            <CardTitle className="text-foreground flex items-center gap-2">
              <Target className="h-5 w-5 text-primary" />
              Top 3 priorities for next week
            </CardTitle>
            <CardDescription>Focus on what matters most</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {checkinData.nextPriorities.map((priority, i) => (
              <div key={i} className="flex items-center gap-3">
                <span className="text-lg font-bold text-primary">{i + 1}</span>
                <Textarea
                  value={priority}
                  onChange={(e) => {
                    const newPriorities = [...checkinData.nextPriorities];
                    newPriorities[i] = e.target.value;
                    setCheckinData(prev => ({ ...prev, nextPriorities: newPriorities }));
                  }}
                  placeholder={i === 0 ? "Most important priority" : "Optional priority"}
                  className="bg-input border-border text-foreground min-h-[60px]"
                />
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Step 4: Risks */}
      {step === 4 && (
        <Card className="border-border bg-card">
          <CardHeader>
            <CardTitle className="text-foreground flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Risks & Decisions Needed
            </CardTitle>
            <CardDescription>Flag anything that needs attention</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {checkinData.risksDecisions.map((risk, i) => (
              <div key={i} className="p-3 rounded-lg bg-destructive/10">
                <p className="text-sm text-foreground">{risk}</p>
              </div>
            ))}
            <div className="space-y-2">
              <Textarea
                placeholder="Any risks or decisions that need to be made?"
                value={newRisk}
                onChange={(e) => setNewRisk(e.target.value)}
                className="bg-input border-border text-foreground min-h-[80px]"
              />
              <Button variant="outline" size="sm" onClick={addRisk}>
                Add Risk/Decision
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 5: AI Summary */}
      {step === 5 && (
        <Card className="border-border bg-card">
          <CardHeader>
            <CardTitle className="text-foreground flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              AI Brain Summary
            </CardTitle>
            <CardDescription>Get insights and recommendations</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {!lastAssistantMessage && !isLoading && (
              <Button onClick={generateSummary} disabled={generating} className="w-full">
                {generating ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Sparkles className="h-4 w-4 mr-2" />
                )}
                Generate Summary
              </Button>
            )}
            
            {isLoading && (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            )}
            
            {lastAssistantMessage && (
              <div className="prose prose-sm prose-invert max-w-none">
                <ReactMarkdown>{lastAssistantMessage.content}</ReactMarkdown>
              </div>
            )}

            {lastAssistantMessage && (
              <Button onClick={saveCheckin} className="w-full">
                <CheckCircle2 className="h-4 w-4 mr-2" />
                Save Check-in
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {/* Navigation */}
      <div className="flex items-center justify-between">
        <Button
          variant="ghost"
          onClick={() => setStep(s => Math.max(1, s - 1))}
          disabled={step === 1}
        >
          Back
        </Button>
        <Button
          onClick={() => setStep(s => Math.min(5, s + 1))}
          disabled={step === 5}
        >
          Next
          <ArrowRight className="h-4 w-4 ml-2" />
        </Button>
      </div>
    </div>
  );
}
