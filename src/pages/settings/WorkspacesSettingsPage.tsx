import { ArrowLeft, Plus, FolderOpen, Edit2, Trash2, Loader2, Check } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { useState } from "react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export default function WorkspacesSettingsPage() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { 
    workspaces, 
    currentCompany, 
    currentWorkspace, 
    setCurrentWorkspace,
    createWorkspace,
    updateWorkspace,
    deleteWorkspace
  } = useWorkspace();

  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [selectedWorkspace, setSelectedWorkspace] = useState<typeof workspaces[0] | null>(null);
  
  const [newWorkspaceName, setNewWorkspaceName] = useState('');
  const [newWorkspaceLocale, setNewWorkspaceLocale] = useState('en');
  const [editName, setEditName] = useState('');
  const [editLocale, setEditLocale] = useState('en');
  const [loading, setLoading] = useState(false);

  const companyWorkspaces = workspaces.filter(w => w.company_id === currentCompany?.id);

  const handleCreateWorkspace = async () => {
    if (!newWorkspaceName.trim()) {
      toast.error(t('workspaces.nameRequired'));
      return;
    }

    setLoading(true);
    try {
      await createWorkspace(newWorkspaceName, newWorkspaceLocale);
      toast.success(t('workspaces.created'));
      setShowCreateDialog(false);
      setNewWorkspaceName('');
      setNewWorkspaceLocale('en');
    } catch (error) {
      console.error('Error creating workspace:', error);
      toast.error(t('workspaces.createFailed'));
    } finally {
      setLoading(false);
    }
  };

  const handleEditWorkspace = async () => {
    if (!selectedWorkspace || !editName.trim()) return;

    setLoading(true);
    try {
      await updateWorkspace(selectedWorkspace.id, { 
        name: editName, 
        default_locale: editLocale 
      });
      toast.success(t('workspaces.updated'));
      setShowEditDialog(false);
      setSelectedWorkspace(null);
    } catch (error) {
      console.error('Error updating workspace:', error);
      toast.error(t('workspaces.updateFailed'));
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteWorkspace = async () => {
    if (!selectedWorkspace) return;

    setLoading(true);
    try {
      await deleteWorkspace(selectedWorkspace.id);
      toast.success(t('workspaces.deleted'));
      setShowDeleteDialog(false);
      setSelectedWorkspace(null);
    } catch (error) {
      console.error('Error deleting workspace:', error);
      toast.error(t('workspaces.deleteFailed'));
    } finally {
      setLoading(false);
    }
  };

  const openEditDialog = (workspace: typeof workspaces[0]) => {
    setSelectedWorkspace(workspace);
    setEditName(workspace.name);
    setEditLocale(workspace.default_locale);
    setShowEditDialog(true);
  };

  const openDeleteDialog = (workspace: typeof workspaces[0]) => {
    setSelectedWorkspace(workspace);
    setShowDeleteDialog(true);
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate('/settings')}
          className="shrink-0"
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-foreground">{t('workspaces.title')}</h1>
          <p className="text-muted-foreground text-sm">{t('workspaces.description')}</p>
        </div>
        <Button onClick={() => setShowCreateDialog(true)}>
          <Plus className="h-4 w-4 mr-2" />
          {t('workspaces.new')}
        </Button>
      </div>

      <div className="space-y-3">
        {companyWorkspaces.map((workspace) => (
          <div
            key={workspace.id}
            className={`flex items-center gap-4 rounded-xl border bg-card p-4 transition-all ${
              currentWorkspace?.id === workspace.id 
                ? 'border-primary bg-primary/5' 
                : 'border-border hover:border-primary/20'
            }`}
          >
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <FolderOpen className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className="font-medium text-foreground truncate">{workspace.name}</p>
                {currentWorkspace?.id === workspace.id && (
                  <span className="text-xs bg-primary/20 text-primary px-2 py-0.5 rounded-full">
                    {t('workspaces.current')}
                  </span>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                {t('workspaces.locale')}: {workspace.default_locale.toUpperCase()}
              </p>
            </div>
            <div className="flex items-center gap-1">
              {currentWorkspace?.id !== workspace.id && (
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={() => setCurrentWorkspace(workspace)}
                >
                  <Check className="h-4 w-4 mr-1" />
                  {t('workspaces.switch')}
                </Button>
              )}
              <Button 
                variant="ghost" 
                size="icon"
                onClick={() => openEditDialog(workspace)}
              >
                <Edit2 className="h-4 w-4" />
              </Button>
              {companyWorkspaces.length > 1 && (
                <Button 
                  variant="ghost" 
                  size="icon"
                  onClick={() => openDeleteDialog(workspace)}
                  className="text-destructive hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Create Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('workspaces.createTitle')}</DialogTitle>
            <DialogDescription>{t('workspaces.createDescription')}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="workspace-name">{t('workspaces.name')}</Label>
              <Input
                id="workspace-name"
                value={newWorkspaceName}
                onChange={(e) => setNewWorkspaceName(e.target.value)}
                placeholder={t('workspaces.namePlaceholder')}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="workspace-locale">{t('workspaces.defaultLocale')}</Label>
              <Select value={newWorkspaceLocale} onValueChange={setNewWorkspaceLocale}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="en">English</SelectItem>
                  <SelectItem value="ar">العربية</SelectItem>
                  <SelectItem value="fr">Français</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
              {t('common.cancel')}
            </Button>
            <Button onClick={handleCreateWorkspace} disabled={loading}>
              {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {t('workspaces.create')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('workspaces.editTitle')}</DialogTitle>
            <DialogDescription>{t('workspaces.editDescription')}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-workspace-name">{t('workspaces.name')}</Label>
              <Input
                id="edit-workspace-name"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-workspace-locale">{t('workspaces.defaultLocale')}</Label>
              <Select value={editLocale} onValueChange={setEditLocale}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="en">English</SelectItem>
                  <SelectItem value="ar">العربية</SelectItem>
                  <SelectItem value="fr">Français</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditDialog(false)}>
              {t('common.cancel')}
            </Button>
            <Button onClick={handleEditWorkspace} disabled={loading}>
              {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {t('common.save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('workspaces.deleteTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('workspaces.deleteDescription', { name: selectedWorkspace?.name })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDeleteWorkspace}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {t('common.delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
