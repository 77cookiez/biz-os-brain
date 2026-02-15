import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { RotateCcw, Loader2, CheckCircle, AlertTriangle } from 'lucide-react';
import type { RestorePreview } from '@/hooks/useRecovery';

interface RestoreWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  previewData: RestorePreview | null;
  previewPending: boolean;
  restorePending: boolean;
  restoreSuccess: boolean;
  requiredPhrase: string;
  onConfirmRestore: () => void;
}

export default function RestoreWizard({
  open, onOpenChange, previewData, previewPending, restorePending, restoreSuccess, requiredPhrase, onConfirmRestore,
}: RestoreWizardProps) {
  const { t } = useTranslation();
  const [step, setStep] = useState<1 | 2>(1);
  const [confirmPhrase, setConfirmPhrase] = useState('');

  const handleOpenChange = (v: boolean) => {
    if (!v) {
      setStep(1);
      setConfirmPhrase('');
    }
    onOpenChange(v);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <RotateCcw className="h-5 w-5" />
            {step === 1 ? t('recovery.previewRestore', 'Preview Restore') : t('recovery.confirmRestore', 'Confirm Restore')}
          </DialogTitle>
          <DialogDescription>
            {step === 1
              ? t('recovery.previewDesc', 'Review what will change before restoring.')
              : t('recovery.confirmDesc', 'This action is irreversible. A pre-restore backup will be created automatically.')}
          </DialogDescription>
        </DialogHeader>

        {step === 1 && (
          <div className="space-y-4">
            {previewPending ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : previewData ? (
              <>
                <Alert>
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle>{t('recovery.willReplace', 'Current data will be replaced')}</AlertTitle>
                  <AlertDescription>
                    <div className="grid grid-cols-2 gap-2 mt-2 text-xs">
                      <div>
                        <p className="font-medium">Will remove:</p>
                        {Object.entries(previewData.summary.will_replace).map(([k, v]) => (
                          <p key={k}>{k}: {v}</p>
                        ))}
                      </div>
                      <div>
                        <p className="font-medium">Will restore:</p>
                        {Object.entries(previewData.summary.will_restore).map(([k, v]) => (
                          <p key={k}>{k}: {v}</p>
                        ))}
                      </div>
                    </div>
                  </AlertDescription>
                </Alert>
                <DialogFooter>
                  <Button variant="outline" onClick={() => handleOpenChange(false)}>Cancel</Button>
                  <Button variant="destructive" onClick={() => setStep(2)}>Continue</Button>
                </DialogFooter>
              </>
            ) : null}
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>{t('recovery.typeToConfirm', 'Type the following to confirm:')}</Label>
              <code className="block text-sm bg-muted px-3 py-2 rounded font-mono">{requiredPhrase}</code>
              <Input value={confirmPhrase} onChange={(e) => setConfirmPhrase(e.target.value)} placeholder={requiredPhrase} />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setStep(1)}>Back</Button>
              <Button
                variant="destructive"
                disabled={confirmPhrase !== requiredPhrase || restorePending}
                onClick={onConfirmRestore}
              >
                {restorePending ? (
                  <><Loader2 className="h-4 w-4 animate-spin me-1" /> Restoring...</>
                ) : (
                  <><RotateCcw className="h-4 w-4 me-1" /> Restore Now</>
                )}
              </Button>
            </DialogFooter>
          </div>
        )}

        {restoreSuccess && (
          <div className="flex items-center gap-2 text-sm text-primary">
            <CheckCircle className="h-4 w-4" />
            Restore completed successfully!
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
