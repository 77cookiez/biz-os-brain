/**
 * Booking Media Upload Hook
 *
 * Handles upload of vendor logos, vendor covers, and service images
 * to the 'booking-assets' storage bucket with validation.
 *
 * Storage paths are STANDARDIZED and must match RLS policies exactly:
 *   Vendor logo:   {workspaceId}/vendor/{vendorId}/logo/{file}
 *   Vendor cover:  {workspaceId}/vendor/{vendorId}/cover/{file}
 *   Service cover: {workspaceId}/service/{serviceId}/cover/{file}
 *   Tenant logo:   {workspaceId}/tenant/logo/{file}
 */
import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const BUCKET = 'booking-assets';
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

type MediaCategory = 'vendor-logo' | 'vendor-cover' | 'service-cover' | 'tenant-logo';

interface UploadResult {
  url: string;
  path: string;
}

/**
 * Build the canonical storage path for a given category.
 * These paths MUST match the RLS policies on storage.objects.
 */
function buildStoragePath(
  workspaceId: string,
  category: MediaCategory,
  entityId: string | undefined,
  fileName: string,
): string {
  switch (category) {
    case 'vendor-logo':
      if (!entityId) throw new Error('vendor-logo requires entityId (vendorId)');
      return `${workspaceId}/vendor/${entityId}/logo/${fileName}`;
    case 'vendor-cover':
      if (!entityId) throw new Error('vendor-cover requires entityId (vendorId)');
      return `${workspaceId}/vendor/${entityId}/cover/${fileName}`;
    case 'service-cover':
      if (!entityId) throw new Error('service-cover requires entityId (serviceId)');
      return `${workspaceId}/service/${entityId}/cover/${fileName}`;
    case 'tenant-logo':
      return `${workspaceId}/tenant/logo/${fileName}`;
    default:
      throw new Error(`Unknown media category: ${category}`);
  }
}

export function useBookingMedia() {
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
      const storagePath = buildStoragePath(workspaceId, category, entityId, fileName);

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
