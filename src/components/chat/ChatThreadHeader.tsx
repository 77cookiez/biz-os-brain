import { Target } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';

interface ChatThreadHeaderProps {
  threadTitle: string;
  onCreateGoal?: () => void;
  creatingGoal?: boolean;
}

export function ChatThreadHeader({ threadTitle, onCreateGoal, creatingGoal }: ChatThreadHeaderProps) {
  return (
    <div className="flex items-center justify-between px-4 py-2.5 border-b border-border bg-card/50">
      <h3 className="text-sm font-semibold text-foreground truncate">
        {threadTitle}
      </h3>
      {onCreateGoal && (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 rounded-full hover:bg-accent"
                onClick={onCreateGoal}
                disabled={creatingGoal}
              >
                <Target className="h-3.5 w-3.5 text-muted-foreground" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              <p className="text-xs">Create Goal from conversation</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}
    </div>
  );
}
