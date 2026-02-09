import { ArrowLeft, Building, Camera, Upload, X } from "lucide-react";
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
  const { currentCompany } = useWorkspace();
  const { t } = useTranslation();
  const [companyName, setCompanyName] = useState(currentCompany?.name || '');
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleLogoClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file');
      return;
    }

    // Validate file size (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      toast.error('Image size should be less than 2MB');
      return;
    }

    setUploading(true);

    try {
      // Create a local preview immediately
      const localUrl = URL.createObjectURL(file);
      setLogoUrl(localUrl);

      // For now, we just show the preview
      // Full storage upload would require Supabase Storage bucket setup
      toast.success('Logo updated! (Preview only - storage integration pending)');
    } catch (error) {
      console.error('Error uploading logo:', error);
      toast.error('Failed to upload logo');
    } finally {
      setUploading(false);
    }
  };

  const removeLogo = () => {
    setLogoUrl(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSave = () => {
    // TODO: Implement company update with logo
    toast.success(t('toast.settingsSaved'));
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
                  className="h-16 w-16 rounded-xl object-cover"
                />
                <button
                  onClick={removeLogo}
                  className="absolute -top-2 -right-2 h-6 w-6 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center hover:bg-destructive/90 transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <div className="h-16 w-16 rounded-xl bg-primary/20 flex items-center justify-center text-2xl font-bold text-primary">
                {currentCompany?.name?.[0]?.toUpperCase() || 'C'}
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
                  Uploading...
                </>
              ) : (
                <>
                  <Camera className="h-4 w-4 mr-2" />
                  {t('settings.company.changeLogo')}
                </>
              )}
            </Button>
            <p className="text-xs text-muted-foreground">PNG, JPG up to 2MB</p>
          </div>
        </div>

        {/* Company Name */}
        <div className="space-y-2">
          <Label htmlFor="company-name">{t('settings.company.name')}</Label>
          <Input
            id="company-name"
            value={companyName}
            onChange={(e) => setCompanyName(e.target.value)}
            placeholder="Enter company name"
          />
        </div>

        {/* Save Button */}
        <div className="flex justify-end pt-4">
          <Button onClick={handleSave}>{t('settings.company.saveChanges')}</Button>
        </div>
      </div>
    </div>
  );
}
