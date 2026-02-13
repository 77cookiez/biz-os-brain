import { useState, useRef } from 'react';
import { Camera, X, Loader2, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';

interface LogoUploadProps {
  currentLogoUrl: string | null;
  workspaceId: string;
  onUploadComplete: (url: string | null) => void;
}

const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_SIZE = 2 * 1024 * 1024; // 2MB

export function LogoUpload({ currentLogoUrl, workspaceId, onUploadComplete }: LogoUploadProps) {
  const { t } = useTranslation();
  const [uploading, setUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!ACCEPTED_TYPES.includes(file.type)) {
      toast.error(t('booking.wizard.brand.logoInvalidType', 'Only JPG, PNG, or WebP images are allowed'));
      return;
    }

    if (file.size > MAX_SIZE) {
      toast.error(t('booking.wizard.brand.logoTooLarge', 'Logo must be under 2MB'));
      return;
    }

    const localPreview = URL.createObjectURL(file);
    setPreviewUrl(localPreview);
    setUploading(true);

    try {
      const fileExt = file.name.split('.').pop();
      const filePath = `${workspaceId}/logo-${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('booking-assets')
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('booking-assets')
        .getPublicUrl(filePath);

      const urlWithCacheBuster = `${publicUrl}?t=${Date.now()}`;
      onUploadComplete(urlWithCacheBuster);
      toast.success(t('booking.wizard.brand.logoUploaded', 'Logo uploaded'));
    } catch (error) {
      console.error('Error uploading logo:', error);
      toast.error(t('booking.wizard.brand.logoUploadFailed', 'Failed to upload logo'));
      setPreviewUrl(null);
    } finally {
      setUploading(false);
    }
  };

  const removeLogo = () => {
    setPreviewUrl(null);
    onUploadComplete(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const displayUrl = previewUrl || currentLogoUrl;

  return (
    <div className="space-y-2">
      <Label>{t('booking.wizard.brand.logo', 'Logo')}</Label>
      <div className="flex items-center gap-4">
        <div className="relative">
          {displayUrl ? (
            <div className="relative h-16 w-16">
              <img
                src={displayUrl}
                alt="Logo"
                className="h-16 w-16 rounded-lg object-contain ring-1 ring-border bg-muted"
              />
              {!uploading && (
                <button
                  type="button"
                  onClick={removeLogo}
                  className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center hover:bg-destructive/90 transition-colors"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>
          ) : (
            <div className="h-16 w-16 rounded-lg bg-muted flex items-center justify-center ring-1 ring-border">
              <Camera className="h-6 w-6 text-muted-foreground" />
            </div>
          )}
          {uploading && (
            <div className="absolute inset-0 flex items-center justify-center bg-background/50 rounded-lg">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
            </div>
          )}
        </div>
        <div className="flex flex-col gap-1">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={handleFileSelect}
            className="hidden"
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
          >
            {uploading ? (
              <>
                <Upload className="h-4 w-4 me-1 animate-pulse" />
                {t('account.uploading', 'Uploading…')}
              </>
            ) : (
              <>
                <Camera className="h-4 w-4 me-1" />
                {displayUrl
                  ? t('booking.wizard.brand.changeLogo', 'Change')
                  : t('booking.wizard.brand.uploadLogo', 'Upload Logo')}
              </>
            )}
          </Button>
          <p className="text-xs text-muted-foreground">
            {t('booking.wizard.brand.logoHint', 'JPG, PNG or WebP. Max 2MB.')}
          </p>
        </div>
      </div>
    </div>
  );
}
