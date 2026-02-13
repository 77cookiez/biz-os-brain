import { useState } from 'react';
import { cn } from '@/lib/utils';
import { SmilePlus } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import type { ReactionGroup } from '@/hooks/useChatReactions';

const QUICK_EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '🙏', '🔥', '👏', '🎉', '💯'];

interface MessageReactionsProps {
  reactions: ReactionGroup[];
  onToggle: (emoji: string) => void;
  isOwn: boolean;
}

export function MessageReactions({ reactions, onToggle, isOwn }: MessageReactionsProps) {
  if (reactions.length === 0) return null;

  return (
    <div className={cn(
      "flex flex-wrap gap-1 mt-1",
      isOwn ? "justify-end" : "justify-start"
    )}>
      {reactions.map((r) => (
        <button
          key={r.emoji}
          onClick={() => onToggle(r.emoji)}
          className={cn(
            "inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-xs transition-colors border",
            r.hasOwn
              ? "bg-primary/15 border-primary/30 text-foreground"
              : "bg-muted/60 border-border/50 text-muted-foreground hover:bg-muted"
          )}
        >
          <span className="text-sm leading-none">{r.emoji}</span>
          {r.count > 1 && (
            <span className="text-[10px] font-medium tabular-nums">{r.count}</span>
          )}
        </button>
      ))}
    </div>
  );
}

interface ReactionPickerProps {
  onSelect: (emoji: string) => void;
  isOwn: boolean;
}

export function ReactionPicker({ onSelect, isOwn }: ReactionPickerProps) {
  const [open, setOpen] = useState(false);

  const handleSelect = (emoji: string) => {
    onSelect(emoji);
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          className={cn(
            "h-6 w-6 rounded-full flex items-center justify-center",
            "opacity-0 group-hover:opacity-100 transition-opacity",
            "text-muted-foreground hover:text-foreground hover:bg-muted",
            "absolute top-1",
            isOwn ? "-left-14" : "-right-14"
          )}
        >
          <SmilePlus className="h-3.5 w-3.5" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        side={isOwn ? "left" : "right"}
        align="start"
        className="w-auto p-1.5 rounded-xl shadow-lg"
      >
        <div className="flex gap-0.5">
          {QUICK_EMOJIS.map((emoji) => (
            <button
              key={emoji}
              onClick={() => handleSelect(emoji)}
              className="h-8 w-8 flex items-center justify-center rounded-lg hover:bg-muted transition-colors text-lg"
            >
              {emoji}
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
