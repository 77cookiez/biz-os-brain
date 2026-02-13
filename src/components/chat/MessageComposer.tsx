import { useState, useCallback, useRef, useEffect, KeyboardEvent } from 'react';
import { Send, Paperclip, X, FileIcon, ImageIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB
const MAX_FILES = 10;
const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'];

interface MessageComposerProps {
  onSend: (text: string, files?: File[]) => Promise<boolean>;
  onTyping?: () => void;
  disabled?: boolean;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function MessageComposer({ onSend, onTyping, disabled }: MessageComposerProps) {
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<Map<string, string>>(new Map());
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Auto-grow textarea
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 120) + 'px';
  }, [text]);

  // Generate image previews
  useEffect(() => {
    const newPreviews = new Map<string, string>();
    files.forEach((file) => {
      if (IMAGE_TYPES.includes(file.type)) {
        const url = URL.createObjectURL(file);
        newPreviews.set(file.name + file.size, url);
      }
    });
    setPreviews(newPreviews);

    return () => {
      newPreviews.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [files]);

  const handleSend = useCallback(async () => {
    if ((!text.trim() && files.length === 0) || sending) return;
    setSending(true);
    const ok = await onSend(text.trim(), files.length > 0 ? files : undefined);
    if (ok) {
      setText('');
      setFiles([]);
    }
    setSending(false);
    textareaRef.current?.focus();
  }, [text, files, onSend, sending]);

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setText(e.target.value);
    onTyping?.();
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(e.target.files || []);
    if (selected.length === 0) return;

    // Validate
    const totalFiles = files.length + selected.length;
    if (totalFiles > MAX_FILES) {
      toast.error(`Maximum ${MAX_FILES} files per message`);
      return;
    }

    const oversized = selected.filter(f => f.size > MAX_FILE_SIZE);
    if (oversized.length > 0) {
      toast.error(`Files must be under ${formatFileSize(MAX_FILE_SIZE)}`);
      return;
    }

    setFiles(prev => [...prev, ...selected]);

    // Reset input so same file can be re-selected
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const dropped = Array.from(e.dataTransfer.files);
    if (dropped.length === 0) return;

    const totalFiles = files.length + dropped.length;
    if (totalFiles > MAX_FILES) {
      toast.error(`Maximum ${MAX_FILES} files per message`);
      return;
    }

    const oversized = dropped.filter(f => f.size > MAX_FILE_SIZE);
    if (oversized.length > 0) {
      toast.error(`Files must be under ${formatFileSize(MAX_FILE_SIZE)}`);
      return;
    }

    setFiles(prev => [...prev, ...dropped]);
  }, [files.length]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
  }, []);

  const canSend = (text.trim().length > 0 || files.length > 0) && !sending && !disabled;

  return (
    <div
      className="border-t border-border px-3 py-2.5 bg-card/80 backdrop-blur-sm"
      onDrop={handleDrop}
      onDragOver={handleDragOver}
    >
      {/* File previews */}
      {files.length > 0 && (
        <div className="flex gap-2 mb-2 flex-wrap max-w-2xl mx-auto">
          {files.map((file, i) => {
            const key = file.name + file.size;
            const isImage = IMAGE_TYPES.includes(file.type);
            const preview = previews.get(key);

            return (
              <div
                key={key + i}
                className="relative group rounded-lg border border-border bg-muted/50 overflow-hidden"
              >
                {isImage && preview ? (
                  <img
                    src={preview}
                    alt={file.name}
                    className="h-16 w-16 object-cover"
                  />
                ) : (
                  <div className="h-16 w-16 flex flex-col items-center justify-center px-1">
                    <FileIcon className="h-5 w-5 text-muted-foreground" />
                    <span className="text-[9px] text-muted-foreground mt-1 truncate max-w-full text-center leading-tight">
                      {file.name.length > 12 ? file.name.slice(0, 10) + '…' : file.name}
                    </span>
                  </div>
                )}
                <button
                  onClick={() => removeFile(i)}
                  className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-sm"
                >
                  <X className="h-3 w-3" />
                </button>
                <div className="absolute bottom-0 left-0 right-0 bg-background/80 text-[8px] text-muted-foreground text-center py-0.5">
                  {formatFileSize(file.size)}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="flex items-end gap-2 max-w-2xl mx-auto">
        {/* Attachment button */}
        <Button
          variant="ghost"
          size="icon"
          className="shrink-0 h-10 w-10 rounded-full text-muted-foreground hover:text-foreground"
          onClick={() => fileInputRef.current?.click()}
          disabled={disabled || sending}
        >
          <Paperclip className="h-4.5 w-4.5" />
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          onChange={handleFileSelect}
          accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.zip,.rar"
        />

        <textarea
          ref={textareaRef}
          value={text}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder="Write in your language…"
          disabled={disabled || sending}
          rows={1}
          className={cn(
            "flex-1 resize-none rounded-xl border border-input bg-background px-3.5 py-2.5 text-sm",
            "placeholder:text-muted-foreground/60",
            "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
            "disabled:cursor-not-allowed disabled:opacity-50",
            "min-h-[40px] max-h-[120px] leading-relaxed"
          )}
        />
        <Button
          size="icon"
          onClick={handleSend}
          disabled={!canSend}
          className={cn(
            "shrink-0 h-10 w-10 rounded-full transition-all",
            canSend ? "scale-100 opacity-100" : "scale-95 opacity-50"
          )}
        >
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
