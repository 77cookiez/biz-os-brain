import { useState, useRef } from 'react';
import { Camera, Upload, X, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';

interface AvatarUploadProps {
  currentAvatarUrl: string | null;
  userId: string;
  displayName: string;
  onUploadComplete: (url: string) => void;
}

export function AvatarUpload({ currentAvatarUrl, userId, displayName, onUploadComplete }: AvatarUploadProps) {
  const { t } = useTranslation();
  const [uploading, setUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const initials = displayName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || 'U';

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error(t('account.avatarInvalidType'));
      return;
    }

    // Validate file size (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      toast.error(t('account.avatarTooLarge'));
      return;
    }

    // Show preview immediately
    const localPreview = URL.createObjectURL(file);
    setPreviewUrl(localPreview);
    setUploading(true);

    try {
      const fileExt = file.name.split('.').pop();
      const filePath = `${userId}/avatar.${fileExt}`;

      // Upload to storage
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);

      // Add cache buster
      const urlWithCacheBuster = `${publicUrl}?t=${Date.now()}`;
      
      onUploadComplete(urlWithCacheBuster);
      toast.success(t('account.avatarUpdated'));
    } catch (error) {
      console.error('Error uploading avatar:', error);
      toast.error(t('account.avatarUploadFailed'));
      setPreviewUrl(null);
    } finally {
      setUploading(false);
    }
  };

  const removeAvatar = async () => {
    setUploading(true);
    try {
      // List files to find the current avatar
      const { data: files } = await supabase.storage
        .from('avatars')
        .list(userId);

      if (files && files.length > 0) {
        const filesToRemove = files.map(f => `${userId}/${f.name}`);
        await supabase.storage.from('avatars').remove(filesToRemove);
      }

      setPreviewUrl(null);
      onUploadComplete('');
      toast.success(t('account.avatarRemoved'));
    } catch (error) {
      console.error('Error removing avatar:', error);
      toast.error(t('account.avatarRemoveFailed'));
    } finally {
      setUploading(false);
    }
  };

  const displayUrl = previewUrl || currentAvatarUrl;

  return (
    <div className="flex items-center gap-4">
      <div className="relative">
        {displayUrl ? (
          <div className="relative h-20 w-20">
            <img 
              src={displayUrl} 
              alt="Avatar" 
              className="h-20 w-20 rounded-full object-cover ring-2 ring-border"
            />
            {!uploading && (
              <button
                onClick={removeAvatar}
                className="absolute -top-1 -right-1 h-6 w-6 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center hover:bg-destructive/90 transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        ) : (
          <div className="h-20 w-20 rounded-full bg-primary/20 flex items-center justify-center text-2xl font-bold text-primary ring-2 ring-border">
            {initials}
          </div>
        )}
        {uploading && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/50 rounded-full">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        )}
      </div>
      <div className="flex flex-col gap-2">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileSelect}
          className="hidden"
        />
        <Button 
          variant="outline" 
          size="sm" 
          onClick={() => fileInputRef.current?.click()}
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
              {t('account.changeAvatar')}
            </>
          )}
        </Button>
        <p className="text-xs text-muted-foreground">{t('account.avatarHint')}</p>
      </div>
    </div>
  );
}
