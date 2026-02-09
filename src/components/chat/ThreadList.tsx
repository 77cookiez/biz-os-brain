import { useState } from 'react';
import { MessageSquare, Plus, Users, Search, MoreVertical, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
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
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <h2 className="text-sm font-semibold text-foreground tracking-tight">Chats</h2>
        <Button variant="ghost" size="icon" onClick={onNewThread} className="h-8 w-8 rounded-full hover:bg-accent">
          <Plus className="h-4 w-4" />
        </Button>
      </div>

      {/* Search */}
      <div className="px-3 py-2">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/60" />
          <input
            placeholder="Search…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className={cn(
              "w-full h-8 rounded-lg bg-muted/50 border-none px-8 text-xs",
              "placeholder:text-muted-foreground/50",
              "focus:outline-none focus:ring-1 focus:ring-ring"
            )}
          />
        </div>
      </div>

      <ScrollArea className="flex-1">
        {loading ? (
          <div className="p-6 text-center text-sm text-muted-foreground">Loading…</div>
        ) : filtered.length === 0 ? (
          <div className="p-6 text-center">
            <p className="text-sm text-muted-foreground">
              {search ? 'No matching chats.' : 'No conversations yet.'}
            </p>
            {!search && (
              <Button variant="link" size="sm" onClick={onNewThread} className="mt-1 text-xs">
                Start one →
              </Button>
            )}
          </div>
        ) : (
          <div className="flex flex-col py-1">
            {filtered.map(thread => {
              const lm = thread.last_message;
              const previewFallback = lm ? extractPreviewFallback(lm.meaning_json) : '';
              const timeStr = lm ? relativeTime(lm.created_at) : relativeTime(thread.created_at);
              const isActive = selectedThreadId === thread.id;

              return (
                <div
                  key={thread.id}
                  className={cn(
                    'flex items-center gap-3 px-3 py-2.5 mx-1.5 rounded-lg cursor-pointer group relative transition-colors',
                    isActive
                      ? 'bg-accent'
                      : 'hover:bg-accent/40'
                  )}
                  onClick={() => onSelectThread(thread.id)}
                >
                  {/* Avatar */}
                  <div className={cn(
                    "h-10 w-10 rounded-full flex items-center justify-center shrink-0",
                    isActive ? "bg-primary/20" : "bg-muted"
                  )}>
                    {thread.type === 'group' ? (
                      <Users className="h-4 w-4 text-primary" />
                    ) : (
                      <MessageSquare className="h-4 w-4 text-primary" />
                    )}
                  </div>

                  {/* Content */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <p className="text-[13px] font-medium text-foreground truncate leading-tight">
                        {thread.title || (thread.type === 'direct' ? 'Direct Message' : 'Group Chat')}
                      </p>
                      <span className="text-[10px] text-muted-foreground whitespace-nowrap shrink-0 leading-tight">
                        {timeStr}
                      </span>
                    </div>
                    {lm && (
                      <p className="text-xs text-muted-foreground truncate mt-0.5 leading-snug">
                        <span className="text-foreground/60">
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

                  {/* Admin delete */}
                  {isAdmin && onDeleteThread && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild onClick={e => e.stopPropagation()}>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 opacity-0 group-hover:opacity-100 absolute right-2 top-2 rounded-full"
                        >
                          <MoreVertical className="h-3.5 w-3.5 text-muted-foreground" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" onClick={e => e.stopPropagation()}>
                        <DropdownMenuItem
                          className="text-destructive focus:text-destructive text-xs"
                          onClick={() => onDeleteThread(thread.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5 mr-2" />
                          Delete
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
