/**
 * Generic Image Upload Component for Booking Module
 *
 * Validates file type/size, shows preview, handles upload progress.
 * Used for vendor logos, covers, and service images.
 */
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useBookingMedia } from '@/hooks/useBookingMedia';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Upload, X, Image as ImageIcon, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ImageUploadProps {
  currentUrl: string | null;
  workspaceId: string;
  category: 'vendor-logo' | 'vendor-cover' | 'service-cover' | 'tenant-logo';
  entityId?: string;
  onUploaded: (url: string) => void;
  onRemoved?: () => void;
  className?: string;
  aspectRatio?: 'square' | 'wide' | 'banner';
  label?: string;
}

export function ImageUpload({
  currentUrl,
  workspaceId,
  category,
  entityId,
  onUploaded,
  onRemoved,
  className,
  aspectRatio = 'square',
  label,
}: ImageUploadProps) {
  const { t } = useTranslation();
  const { upload, uploading, progress, validate } = useBookingMedia();
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);

  const aspectClass = {
    square: 'aspect-square',
    wide: 'aspect-video',
    banner: 'aspect-[3/1]',
  }[aspectRatio];

  const handleFile = async (file: File) => {
    const error = validate(file);
    if (error) return;

    // Show preview immediately
    const objectUrl = URL.createObjectURL(file);
    setPreview(objectUrl);

    const result = await upload(file, workspaceId, category, entityId);
    if (result) {
      onUploaded(result.url);
    }

    URL.revokeObjectURL(objectUrl);
    setPreview(null);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    // Reset input
    if (inputRef.current) inputRef.current.value = '';
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  };

  const handleRemove = () => {
    onRemoved?.();
  };

  const displayUrl = preview || currentUrl;

  return (
    <div className={cn('space-y-2', className)}>
      {label && <p className="text-sm font-medium text-foreground">{label}</p>}

      <div
        className={cn(
          'relative rounded-lg border-2 border-dashed border-border overflow-hidden cursor-pointer transition-all hover:border-primary/50',
          aspectClass,
          dragOver && 'border-primary bg-primary/5',
          !displayUrl && 'flex items-center justify-center bg-muted/30'
        )}
        onClick={() => !uploading && inputRef.current?.click()}
        onDragOver={e => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
      >
        {displayUrl ? (
          <>
            <img
              src={displayUrl}
              alt=""
              className="w-full h-full object-cover"
            />
            {/* Remove button */}
            {!uploading && onRemoved && (
              <button
                className="absolute top-2 right-2 p-1 rounded-full bg-background/80 backdrop-blur-sm border border-border hover:bg-destructive/10 transition-colors"
                onClick={e => { e.stopPropagation(); handleRemove(); }}
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </>
        ) : (
          <div className="flex flex-col items-center gap-2 text-muted-foreground p-4">
            <ImageIcon className="h-8 w-8" />
            <p className="text-xs text-center">
              Drop image here or click to upload
            </p>
            <p className="text-[10px]">JPEG, PNG, WebP • Max 5 MB</p>
          </div>
        )}

        {/* Upload overlay */}
        {uploading && (
          <div className="absolute inset-0 bg-background/70 backdrop-blur-sm flex flex-col items-center justify-center gap-2">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
            <Progress value={progress} className="w-2/3 h-1.5" />
          </div>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        className="hidden"
        onChange={handleChange}
      />
    </div>
  );
}
