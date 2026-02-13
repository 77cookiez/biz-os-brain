import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { useAuth } from '@/contexts/AuthContext';
import { Loader2 } from 'lucide-react';

interface WorkspaceMember {
  user_id: string;
  profile?: { full_name: string | null };
}

interface NewThreadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (threadId: string) => void;
  createThread: (params: { type: 'direct' | 'group'; title?: string; memberUserIds: string[] }) => Promise<string | null>;
}

export function NewThreadDialog({ open, onOpenChange, onCreated, createThread }: NewThreadDialogProps) {
  const { currentWorkspace } = useWorkspace();
  const { user } = useAuth();
  const [members, setMembers] = useState<WorkspaceMember[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [title, setTitle] = useState('');
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (!open || !currentWorkspace) return;
    // Fetch workspace members with profile names
    (async () => {
      const { data: memberData } = await supabase
        .from('workspace_members')
        .select('user_id')
        .eq('workspace_id', currentWorkspace.id);

      const memberIds = (memberData || [])
        .map(m => m.user_id)
        .filter(id => id !== user?.id);

      if (memberIds.length === 0) { setMembers([]); return; }

      const { data: profileData } = await supabase
        .from('profiles')
        .select('user_id, full_name')
        .in('user_id', memberIds);

      const list = memberIds.map(uid => ({
        user_id: uid,
        profile: profileData?.find(p => p.user_id === uid) || null,
      }));
      setMembers(list);
    })();
  }, [open, currentWorkspace?.id, user?.id]);

  const handleCreate = async () => {
    if (selectedIds.length === 0) return;
    setCreating(true);
    const type = selectedIds.length === 1 ? 'direct' : 'group';
    const threadId = await createThread({
      type,
      title: type === 'group' ? title || undefined : undefined,
      memberUserIds: selectedIds,
    });
    setCreating(false);
    if (threadId) {
      setSelectedIds([]);
      setTitle('');
      onCreated(threadId);
    }
  };

  const toggleMember = (uid: string) => {
    setSelectedIds(prev =>
      prev.includes(uid) ? prev.filter(id => id !== uid) : [...prev, uid]
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-border">
        <DialogHeader>
          <DialogTitle>New Conversation</DialogTitle>
          <DialogDescription>Select members to start a chat.</DialogDescription>
        </DialogHeader>

        {selectedIds.length > 1 && (
          <div className="space-y-1.5">
            <Label>Group Name (optional)</Label>
            <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Marketing Team" />
          </div>
        )}

        <ScrollArea className="max-h-[200px]">
          <div className="space-y-2">
            {members.length === 0 ? (
              <p className="text-sm text-muted-foreground p-2">No other workspace members found.</p>
            ) : (
              members.map(m => (
                <label
                  key={m.user_id}
                  className="flex items-center gap-3 px-2 py-2 rounded-md hover:bg-accent/50 cursor-pointer"
                >
                  <Checkbox
                    checked={selectedIds.includes(m.user_id)}
                    onCheckedChange={() => toggleMember(m.user_id)}
                  />
                  <span className="text-sm text-foreground">
                    {m.profile?.full_name || m.user_id.slice(0, 8)}
                  </span>
                </label>
              ))
            )}
          </div>
        </ScrollArea>

        <Button onClick={handleCreate} disabled={selectedIds.length === 0 || creating} className="w-full">
          {creating && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          Start Chat
        </Button>
      </DialogContent>
    </Dialog>
  );
}
