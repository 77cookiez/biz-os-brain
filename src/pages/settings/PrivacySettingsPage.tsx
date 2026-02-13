import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/contexts/AuthContext';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Download, Trash2, AlertTriangle, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

export default function PrivacySettingsPage() {
  const { t } = useTranslation();
  const { user, session } = useAuth();
  const { currentWorkspace } = useWorkspace();
  const [exporting, setExporting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handleExport = async () => {
    if (!currentWorkspace || !session) return;
    setExporting(true);
    try {
      const { data, error } = await supabase.functions.invoke('gdpr-export', {
        body: { action: 'export', workspace_id: currentWorkspace.id },
      });
      if (error) throw error;

      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `data-export-${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(t('privacy.exportSuccess', 'Data exported successfully'));
    } catch (err) {
      console.error('Export error:', err);
      toast.error(t('privacy.exportFailed', 'Failed to export data'));
    }
    setExporting(false);
  };

  const handleDelete = async () => {
    if (!currentWorkspace || !session) return;
    setDeleting(true);
    try {
      const { data, error } = await supabase.functions.invoke('gdpr-export', {
        body: { action: 'delete', workspace_id: currentWorkspace.id },
      });
      if (error) throw error;
      toast.success(t('privacy.deleteSuccess', 'Deletion request submitted'));
      setShowDeleteConfirm(false);
    } catch (err) {
      console.error('Delete error:', err);
      toast.error(t('privacy.deleteFailed', 'Failed to submit deletion request'));
    }
    setDeleting(false);
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">{t('privacy.title', 'Privacy & Data')}</h1>
        <p className="text-muted-foreground text-sm mt-1">{t('privacy.subtitle', 'Manage your data and privacy settings')}</p>
      </div>

      <Card className="border-border bg-card">
        <CardHeader>
          <CardTitle className="text-foreground flex items-center gap-2">
            <Download className="h-5 w-5 text-primary" />
            {t('privacy.exportTitle', 'Export My Data')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-4">
            {t('privacy.exportDesc', 'Download a JSON file containing all your data including tasks, goals, plans, ideas, and conversations.')}
          </p>
          <Button onClick={handleExport} disabled={exporting} variant="outline">
            {exporting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Download className="h-4 w-4 mr-2" />}
            {t('privacy.exportBtn', 'Export Data')}
          </Button>
        </CardContent>
      </Card>

      <Card className="border-destructive/30 bg-card">
        <CardHeader>
          <CardTitle className="text-foreground flex items-center gap-2">
            <Trash2 className="h-5 w-5 text-destructive" />
            {t('privacy.deleteTitle', 'Request Data Deletion')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-4">
            {t('privacy.deleteDesc', 'Request deletion of all your content data. This will soft-delete your tasks, goals, plans, ideas, and brain messages. This action cannot be undone.')}
          </p>
          <Button variant="destructive" onClick={() => setShowDeleteConfirm(true)}>
            <Trash2 className="h-4 w-4 mr-2" />
            {t('privacy.deleteBtn', 'Request Deletion')}
          </Button>
        </CardContent>
      </Card>

      <Dialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <DialogContent className="bg-card border-border">
          <DialogHeader>
            <DialogTitle className="text-foreground flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              {t('privacy.confirmTitle', 'Confirm Data Deletion')}
            </DialogTitle>
            <DialogDescription className="text-muted-foreground">
              {t('privacy.confirmDesc', 'This will permanently mark all your content for deletion. Tasks, goals, plans, ideas, and brain messages will be removed. This cannot be undone.')}
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-3 pt-4">
            <Button variant="outline" onClick={() => setShowDeleteConfirm(false)}>
              {t('common.cancel', 'Cancel')}
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
              {deleting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Trash2 className="h-4 w-4 mr-2" />}
              {t('privacy.confirmBtn', 'Yes, Delete My Data')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
