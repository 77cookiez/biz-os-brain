import { Link, Copy, Users, Megaphone, Receipt, MoreHorizontal } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger, DropdownMenuLabel } from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';

interface TaskActionsProps {
  title: string;
  description?: string | null;
  id: string;
  type: 'task' | 'idea';
}

export function TaskActions({ title, description, id, type }: TaskActionsProps) {
  const navigate = useNavigate();

  const handleShare = () => {
    const url = `${window.location.origin}/apps/workboard?${type}=${id}`;
    navigator.clipboard.writeText(url);
    toast.success('Link copied to clipboard');
  };

  const handleCopySummary = () => {
    const summary = `${type === 'task' ? '📋 Task' : '💡 Idea'}: ${title}${description ? `\n${description}` : ''}`;
    navigator.clipboard.writeText(summary);
    toast.success('Summary copied');
  };

  const handleConvert = (target: 'crm' | 'marketing' | 'invoice') => {
    const routes: Record<string, string> = {
      crm: '/apps/crm',
      marketing: '/apps/marketing',
      invoice: '/apps/invoices',
    };
    toast.info(`Redirecting to ${target}...`);
    navigate(routes[target], { state: { from: 'workboard', title, description, sourceId: id, sourceType: type } });
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-7 w-7">
          <MoreHorizontal className="h-4 w-4 text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48 bg-popover border-border">
        <DropdownMenuItem onClick={handleShare} className="gap-2 text-xs">
          <Link className="h-3.5 w-3.5" /> Share link
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleCopySummary} className="gap-2 text-xs">
          <Copy className="h-3.5 w-3.5" /> Copy summary
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuLabel className="text-[10px] text-muted-foreground uppercase">Convert to</DropdownMenuLabel>
        <DropdownMenuItem onClick={() => handleConvert('crm')} className="gap-2 text-xs">
          <Users className="h-3.5 w-3.5" /> CRM action
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleConvert('marketing')} className="gap-2 text-xs">
          <Megaphone className="h-3.5 w-3.5" /> Marketing campaign
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleConvert('invoice')} className="gap-2 text-xs">
          <Receipt className="h-3.5 w-3.5" /> Invoice
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
