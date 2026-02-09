import { useState } from 'react';
import { MessageSquare, Plus, Users, Search, MoreVertical, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { ULLText } from '@/components/ull/ULLText';
import { cn } from '@/lib/utils';
import { relativeTime } from '@/lib/relativeTime';
import type { ChatThread } from '@/hooks/useChatThreads';

interface ThreadListProps {
  threads: ChatThread[];
  selectedThreadId: string | null;
  onSelectThread: (id: string) => void;
  onNewThread: () => void;
  onDeleteThread?: (id: string) => void;
  loading: boolean;
  isAdmin?: boolean;
}

function extractPreviewFallback(meaningJson?: Record<string, unknown>): string {
  if (!meaningJson) return '';
  const desc = meaningJson.description as string;
  if (desc && desc.length > 60) return desc.slice(0, 57) + '…';
  return desc || '';
}

export function ThreadList({
  threads, selectedThreadId, onSelectThread, onNewThread, onDeleteThread, loading, isAdmin,
}: ThreadListProps) {
  const [search, setSearch] = useState('');

  const filtered = search.trim()
    ? threads.filter(t => {
        const title = (t.title || '').toLowerCase();
        const preview = extractPreviewFallback(t.last_message?.meaning_json).toLowerCase();
        const q = search.toLowerCase();
        return title.includes(q) || preview.includes(q);
      })
    : threads;

  return (
    <div className="flex flex-col h-full border-r border-border bg-card">
      <div className="flex items-center justify-between p-3 border-b border-border">
        <h2 className="text-sm font-semibold text-foreground">Chats</h2>
        <Button variant="ghost" size="icon" onClick={onNewThread} className="h-8 w-8">
          <Plus className="h-4 w-4" />
        </Button>
      </div>

      {/* Search */}
      <div className="px-3 py-2 border-b border-border">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Search chats…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="h-8 pl-8 text-xs bg-background"
          />
        </div>
      </div>

      <ScrollArea className="flex-1">
        {loading ? (
          <div className="p-4 text-center text-sm text-muted-foreground">Loading…</div>
        ) : filtered.length === 0 ? (
          <div className="p-4 text-center text-sm text-muted-foreground">
            {search ? 'No matching chats.' : 'No conversations yet. Start one!'}
          </div>
        ) : (
          <div className="flex flex-col">
            {filtered.map(thread => {
              const lm = thread.last_message;
              const previewFallback = lm ? extractPreviewFallback(lm.meaning_json) : '';
              const timeStr = lm ? relativeTime(lm.created_at) : relativeTime(thread.created_at);

              return (
                <div
                  key={thread.id}
                  className={cn(
                    'flex items-start gap-3 px-3 py-3 text-left transition-colors hover:bg-accent/50 cursor-pointer group relative',
                    selectedThreadId === thread.id && 'bg-accent'
                  )}
                  onClick={() => onSelectThread(thread.id)}
                >
                  <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                    {thread.type === 'group' ? (
                      <Users className="h-4 w-4 text-primary" />
                    ) : (
                      <MessageSquare className="h-4 w-4 text-primary" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-medium text-foreground truncate">
                        {thread.title || (thread.type === 'direct' ? 'Direct Message' : 'Group Chat')}
                      </p>
                      <span className="text-[10px] text-muted-foreground whitespace-nowrap shrink-0">{timeStr}</span>
                    </div>
                    {lm && (
                      <p className="text-xs text-muted-foreground truncate mt-0.5">
                        <span className="font-medium text-foreground/70">
                          {lm.sender_name ? lm.sender_name.split(' ')[0] : 'Someone'}:
                        </span>{' '}
                        <ULLText
                          meaningId={lm.meaning_object_id}
                          fallback={previewFallback}
                          as="span"
                        />
                      </p>
                    )}
                  </div>

                  {/* Admin delete menu */}
                  {isAdmin && onDeleteThread && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild onClick={e => e.stopPropagation()}>
                        <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100 absolute right-2 top-2">
                          <MoreVertical className="h-3.5 w-3.5" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" onClick={e => e.stopPropagation()}>
                        <DropdownMenuItem
                          className="text-destructive focus:text-destructive"
                          onClick={() => onDeleteThread(thread.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5 mr-2" />
                          Delete Thread
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
