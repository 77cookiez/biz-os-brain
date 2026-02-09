import { MessageSquare, Plus, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import type { ChatThread } from '@/hooks/useChatThreads';

interface ThreadListProps {
  threads: ChatThread[];
  selectedThreadId: string | null;
  onSelectThread: (id: string) => void;
  onNewThread: () => void;
  loading: boolean;
}

export function ThreadList({ threads, selectedThreadId, onSelectThread, onNewThread, loading }: ThreadListProps) {
  return (
    <div className="flex flex-col h-full border-r border-border bg-card">
      <div className="flex items-center justify-between p-3 border-b border-border">
        <h2 className="text-sm font-semibold text-foreground">Threads</h2>
        <Button variant="ghost" size="icon" onClick={onNewThread} className="h-8 w-8">
          <Plus className="h-4 w-4" />
        </Button>
      </div>
      <ScrollArea className="flex-1">
        {loading ? (
          <div className="p-4 text-center text-sm text-muted-foreground">Loading…</div>
        ) : threads.length === 0 ? (
          <div className="p-4 text-center text-sm text-muted-foreground">
            No conversations yet. Start one!
          </div>
        ) : (
          <div className="flex flex-col">
            {threads.map(thread => (
              <button
                key={thread.id}
                onClick={() => onSelectThread(thread.id)}
                className={cn(
                  'flex items-center gap-3 px-3 py-3 text-left transition-colors hover:bg-accent/50',
                  selectedThreadId === thread.id && 'bg-accent'
                )}
              >
                <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  {thread.type === 'group' ? (
                    <Users className="h-4 w-4 text-primary" />
                  ) : (
                    <MessageSquare className="h-4 w-4 text-primary" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-foreground truncate">
                    {thread.title || (thread.type === 'direct' ? 'Direct Message' : 'Group Chat')}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
                    {new Date(thread.created_at).toLocaleDateString()}
                  </p>
                </div>
              </button>
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
