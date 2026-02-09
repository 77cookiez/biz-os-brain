import { useState, useEffect } from 'react';
import { Plus, Lightbulb, ArrowRight, Sparkles, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useWorkboardTasks } from '@/hooks/useWorkboardTasks';

interface Idea {
  id: string;
  title: string;
  description: string | null;
  source: string;
  status: string;
  created_at: string;
}

export default function WorkboardBrainstormPage() {
  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [aiInput, setAiInput] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const { currentWorkspace } = useWorkspace();
  const { user } = useAuth();
  const { createTask } = useWorkboardTasks();

  useEffect(() => {
    if (currentWorkspace) fetchIdeas();
  }, [currentWorkspace?.id]);

  const fetchIdeas = async () => {
    if (!currentWorkspace) return;
    const { data } = await supabase
      .from('ideas')
      .select('*')
      .eq('workspace_id', currentWorkspace.id)
      .order('created_at', { ascending: false });
    setIdeas((data as Idea[]) || []);
  };

  const addIdea = async () => {
    if (!currentWorkspace || !user || !title.trim()) return;
    const { error } = await supabase.from('ideas').insert({
      workspace_id: currentWorkspace.id,
      created_by: user.id,
      title,
      description: description || null,
      source: 'manual',
    });
    if (error) { toast.error('Failed to save idea'); return; }
    toast.success('Idea saved');
    setTitle('');
    setDescription('');
    setShowAdd(false);
    fetchIdeas();
  };

  const convertToTask = async (idea: Idea) => {
    await createTask({ title: idea.title, description: idea.description || undefined, status: 'backlog' });
    await supabase.from('ideas').update({ status: 'converted_to_task' } as any).eq('id', idea.id);
    fetchIdeas();
  };

  const handleAiBrainstorm = async () => {
    if (!aiInput.trim() || !currentWorkspace || !user) return;
    setAiLoading(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;
      if (!accessToken) throw new Error('Not authenticated');

      const response = await supabase.functions.invoke('brain-chat', {
        body: {
          message: `Analyze this brainstorm and extract structured items. Return a JSON array of objects with "type" (idea/task/risk/opportunity), "title", and "description". Input: "${aiInput}"`,
          workspaceId: currentWorkspace.id,
        },
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (response.error) throw response.error;

      // Try to parse AI response for items
      const content = typeof response.data === 'string' ? response.data : response.data?.content || '';
      const jsonMatch = content.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        const items = JSON.parse(jsonMatch[0]);
        for (const item of items) {
          await supabase.from('ideas').insert({
            workspace_id: currentWorkspace.id,
            created_by: user.id,
            title: item.title,
            description: `[${item.type}] ${item.description || ''}`,
            source: 'brainstorm',
          });
        }
        toast.success(`${items.length} items captured from brainstorm`);
        fetchIdeas();
      } else {
        // Save as single idea
        await supabase.from('ideas').insert({
          workspace_id: currentWorkspace.id,
          created_by: user.id,
          title: aiInput.slice(0, 100),
          description: content,
          source: 'brainstorm',
        });
        toast.success('Brainstorm captured');
        fetchIdeas();
      }
      setAiInput('');
    } catch (err) {
      toast.error('Brainstorm failed. Try again.');
    } finally {
      setAiLoading(false);
    }
  };

  const activeIdeas = ideas.filter(i => i.status === 'idea');
  const convertedIdeas = ideas.filter(i => i.status !== 'idea');

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-foreground">Brainstorm</h1>
        <Button size="sm" onClick={() => setShowAdd(true)} className="gap-1.5">
          <Plus className="h-3.5 w-3.5" /> Add Idea
        </Button>
      </div>

      {/* AI Brainstorm */}
      <Card className="border-primary/30 bg-card">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2 text-foreground">
            <Sparkles className="h-4 w-4 text-primary" /> Brainstorm with AI
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Textarea
            placeholder="Write freely... paste ideas, thoughts, problems. AI will organize them into Ideas, Tasks, Risks, and Opportunities."
            value={aiInput}
            onChange={e => setAiInput(e.target.value)}
            className="bg-input border-border min-h-[100px]"
          />
          <Button onClick={handleAiBrainstorm} disabled={!aiInput.trim() || aiLoading} className="gap-1.5">
            {aiLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            Organize with AI
          </Button>
        </CardContent>
      </Card>

      {/* Active Ideas */}
      {activeIdeas.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider px-1">Ideas ({activeIdeas.length})</h2>
          {activeIdeas.map(idea => (
            <Card key={idea.id} className="border-border bg-card">
              <CardContent className="py-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <Lightbulb className="h-4 w-4 text-yellow-500 shrink-0" />
                      <span className="text-sm font-medium text-foreground">{idea.title}</span>
                      {idea.source === 'brainstorm' && <Badge variant="outline" className="text-[10px]">AI</Badge>}
                    </div>
                    {idea.description && <p className="text-xs text-muted-foreground mt-1 ml-6">{idea.description}</p>}
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => convertToTask(idea)} className="shrink-0 gap-1 text-xs">
                    <ArrowRight className="h-3 w-3" /> To Task
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Converted */}
      {convertedIdeas.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider px-1">Converted ({convertedIdeas.length})</h2>
          {convertedIdeas.map(idea => (
            <Card key={idea.id} className="border-border bg-card opacity-60">
              <CardContent className="py-3">
                <div className="flex items-center gap-2">
                  <Lightbulb className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground line-through">{idea.title}</span>
                  <Badge variant="secondary" className="text-[10px]">Converted</Badge>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Empty */}
      {ideas.length === 0 && (
        <Card className="border-border bg-card">
          <CardContent className="py-12 text-center">
            <Lightbulb className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground">No ideas yet. Start brainstorming!</p>
          </CardContent>
        </Card>
      )}

      {/* Manual Add Dialog */}
      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent className="bg-card border-border">
          <DialogHeader>
            <DialogTitle className="text-foreground">New Idea</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <Input placeholder="Idea title" value={title} onChange={e => setTitle(e.target.value)} className="bg-input border-border" />
            <Textarea placeholder="Details (optional)" value={description} onChange={e => setDescription(e.target.value)} className="bg-input border-border" rows={3} />
            <Button onClick={addIdea} disabled={!title.trim()} className="w-full">Save Idea</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
