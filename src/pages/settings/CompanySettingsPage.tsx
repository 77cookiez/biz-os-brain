import { ArrowLeft, Building, Camera, Upload, X, Loader2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { useState, useRef } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useTranslation } from "react-i18next";

export default function CompanySettingsPage() {
  const navigate = useNavigate();
  const { currentCompany, updateCompany } = useWorkspace();
  const { t } = useTranslation();
  const [companyName, setCompanyName] = useState(currentCompany?.name || '');
  const [logoUrl, setLogoUrl] = useState<string | null>(currentCompany?.logo_url || null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleLogoClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !currentCompany) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error(t('settings.company.invalidFileType'));
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error(t('settings.company.fileTooLarge'));
      return;
    }

    setUploading(true);

    try {
      const fileExt = file.name.split('.').pop();
      const filePath = `${currentCompany.id}/logo.${fileExt}`;

      // Upload to storage
      const { error: uploadError } = await supabase.storage
        .from('company-assets')
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      // Get public URL (bucket is public)
      const { data: publicData } = supabase.storage
        .from('company-assets')
        .getPublicUrl(filePath);

      const urlWithCacheBuster = `${publicData.publicUrl}?t=${Date.now()}`;
      setLogoUrl(urlWithCacheBuster);
      
      toast.success(t('settings.company.logoUpdated'));
    } catch (error) {
      console.error('Error uploading logo:', error);
      toast.error(t('settings.company.logoUploadFailed'));
    } finally {
      setUploading(false);
    }
  };

  const removeLogo = async () => {
    if (!currentCompany) return;

    setUploading(true);
    try {
      // List and remove files
      const { data: files } = await supabase.storage
        .from('company-assets')
        .list(currentCompany.id);

      if (files && files.length > 0) {
        const filesToRemove = files.map(f => `${currentCompany.id}/${f.name}`);
        await supabase.storage.from('company-assets').remove(filesToRemove);
      }

      setLogoUrl(null);
      toast.success(t('settings.company.logoRemoved'));
    } catch (error) {
      console.error('Error removing logo:', error);
      toast.error(t('settings.company.logoRemoveFailed'));
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateCompany({ 
        name: companyName,
        logo_url: logoUrl 
      });
      toast.success(t('toast.settingsSaved'));
    } catch (error) {
      console.error('Error saving company:', error);
      toast.error(t('settings.company.saveFailed'));
    } finally {
      setSaving(false);
    }
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
        <div>
          <h1 className="text-2xl font-bold text-foreground">{t('settings.company.title')}</h1>
          <p className="text-muted-foreground text-sm">{t('settings.company.description')}</p>
        </div>
      </div>

      <div className="space-y-6 rounded-xl border border-border bg-card p-6">
        {/* Company Logo */}
        <div className="flex items-center gap-4">
          <div className="relative">
            {logoUrl ? (
              <div className="relative h-16 w-16">
                <img 
                  src={logoUrl} 
                  alt="Company logo" 
                  className="h-16 w-16 rounded-xl object-cover ring-2 ring-border"
                />
                {!uploading && (
                  <button
                    onClick={removeLogo}
                    className="absolute -top-2 -right-2 h-6 w-6 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center hover:bg-destructive/90 transition-colors"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
            ) : (
              <div className="h-16 w-16 rounded-xl bg-primary/20 flex items-center justify-center text-2xl font-bold text-primary ring-2 ring-border">
                {currentCompany?.name?.[0]?.toUpperCase() || 'C'}
              </div>
            )}
            {uploading && (
              <div className="absolute inset-0 flex items-center justify-center bg-background/50 rounded-xl">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            )}
          </div>
          <div className="flex flex-col gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              className="hidden"
            />
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleLogoClick}
              disabled={uploading}
            >
              {uploading ? (
                <>
                  <Upload className="h-4 w-4 mr-2 animate-pulse" />
                  {t('account.uploading')}
                </>
              ) : (
                <>
                  <Camera className="h-4 w-4 mr-2" />
                  {t('settings.company.changeLogo')}
                </>
              )}
            </Button>
            <p className="text-xs text-muted-foreground">{t('settings.company.logoHint')}</p>
          </div>
        </div>

        {/* Company Name */}
        <div className="space-y-2">
          <Label htmlFor="company-name">{t('settings.company.name')}</Label>
          <Input
            id="company-name"
            value={companyName}
            onChange={(e) => setCompanyName(e.target.value)}
            placeholder={t('settings.company.namePlaceholder')}
          />
        </div>

        {/* Save Button */}
        <div className="flex justify-end pt-4">
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {t('settings.company.saveChanges')}
          </Button>
        </div>
      </div>
    </div>
  );
}
