/**
 * Booking Media Upload Hook
 *
 * Handles upload of vendor logos, vendor covers, and service images
 * to the 'booking-assets' storage bucket with validation.
 */
import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';

const BUCKET = 'booking-assets';
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

type MediaCategory = 'vendor-logo' | 'vendor-cover' | 'service-cover' | 'tenant-logo';

interface UploadResult {
  url: string;
  path: string;
}

export function useBookingMedia() {
  const { t } = useTranslation();
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);

  const validate = useCallback((file: File): string | null => {
    if (!ALLOWED_TYPES.includes(file.type)) {
      return 'Only JPEG, PNG, WebP, and GIF images are allowed.';
    }
    if (file.size > MAX_FILE_SIZE) {
      return 'File size must be under 5 MB.';
    }
    return null;
  }, []);

  const upload = useCallback(async (
    file: File,
    workspaceId: string,
    category: MediaCategory,
    entityId?: string,
  ): Promise<UploadResult | null> => {
    const validationError = validate(file);
    if (validationError) {
      toast.error(validationError);
      return null;
    }

    setUploading(true);
    setProgress(10);

    try {
      const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
      const fileName = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const storagePath = `${workspaceId}/${category}${entityId ? `/${entityId}` : ''}/${fileName}`;

      setProgress(30);

      const { error: uploadError } = await supabase.storage
        .from(BUCKET)
        .upload(storagePath, file, {
          cacheControl: '3600',
          upsert: false,
          contentType: file.type,
        });

      if (uploadError) throw uploadError;

      setProgress(80);

      const { data: { publicUrl } } = supabase.storage
        .from(BUCKET)
        .getPublicUrl(storagePath);

      setProgress(100);

      return { url: publicUrl, path: storagePath };
    } catch (err: any) {
      console.error('[BookingMedia] Upload failed:', err);
      toast.error('Upload failed. Please try again.');
      return null;
    } finally {
      setUploading(false);
      // Reset progress after a brief delay
      setTimeout(() => setProgress(0), 500);
    }
  }, [validate]);

  const remove = useCallback(async (storagePath: string): Promise<boolean> => {
    try {
      const { error } = await supabase.storage
        .from(BUCKET)
        .remove([storagePath]);
      if (error) throw error;
      return true;
    } catch (err) {
      console.error('[BookingMedia] Remove failed:', err);
      return false;
    }
  }, []);

  return { upload, remove, validate, uploading, progress };
}
