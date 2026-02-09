import { ClipboardCheck, Loader2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useState } from 'react';

interface WorkboardInstallPromptProps {
  onInstall: () => Promise<void>;
  onDismiss: () => void;
}

export function WorkboardInstallPrompt({ onInstall, onDismiss }: WorkboardInstallPromptProps) {
  const [installing, setInstalling] = useState(false);

  const handleInstall = async () => {
    setInstalling(true);
    try {
      await onInstall();
    } finally {
      setInstalling(false);
    }
  };

  return (
    <div className="rounded-lg border border-primary/30 bg-primary/5 p-4 space-y-3">
      <div className="flex items-start gap-3">
        <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
          <ClipboardCheck className="h-5 w-5 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="text-sm font-medium text-foreground">
            Workboard Required
          </h4>
          <p className="text-xs text-muted-foreground mt-1">
            To turn this plan into trackable tasks, you need the Workboard app.
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Button size="sm" onClick={handleInstall} disabled={installing} className="gap-1.5">
          {installing ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <ClipboardCheck className="h-3.5 w-3.5" />
          )}
          Install Workboard
        </Button>
        <Button size="sm" variant="ghost" onClick={onDismiss} className="gap-1.5">
          <X className="h-3.5 w-3.5" />
          Not now
        </Button>
      </div>
    </div>
  );
}
