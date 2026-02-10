import { useState, useMemo } from 'react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { Check, Search } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';

export interface ContentLanguage {
  code: string;
  name: string;
  nativeName: string;
}

/** Top 30 popular languages by global speaker count */
export const POPULAR_CONTENT_LANGUAGES: ContentLanguage[] = [
  { code: 'en', name: 'English', nativeName: 'English' },
  { code: 'ar', name: 'Arabic', nativeName: 'العربية' },
  { code: 'fr', name: 'French', nativeName: 'Français' },
  { code: 'es', name: 'Spanish', nativeName: 'Español' },
  { code: 'de', name: 'German', nativeName: 'Deutsch' },
  { code: 'hi', name: 'Hindi', nativeName: 'हिन्दी' },
  { code: 'ur', name: 'Urdu', nativeName: 'اردو' },
  { code: 'zh', name: 'Chinese (Simplified)', nativeName: '中文' },
  { code: 'pt', name: 'Portuguese', nativeName: 'Português' },
  { code: 'ru', name: 'Russian', nativeName: 'Русский' },
  { code: 'ja', name: 'Japanese', nativeName: '日本語' },
  { code: 'ko', name: 'Korean', nativeName: '한국어' },
  { code: 'tr', name: 'Turkish', nativeName: 'Türkçe' },
  { code: 'it', name: 'Italian', nativeName: 'Italiano' },
  { code: 'nl', name: 'Dutch', nativeName: 'Nederlands' },
  { code: 'pl', name: 'Polish', nativeName: 'Polski' },
  { code: 'sw', name: 'Swahili', nativeName: 'Kiswahili' },
  { code: 'th', name: 'Thai', nativeName: 'ไทย' },
  { code: 'vi', name: 'Vietnamese', nativeName: 'Tiếng Việt' },
  { code: 'id', name: 'Indonesian', nativeName: 'Bahasa Indonesia' },
  { code: 'ms', name: 'Malay', nativeName: 'Bahasa Melayu' },
  { code: 'fa', name: 'Persian', nativeName: 'فارسی' },
  { code: 'bn', name: 'Bengali', nativeName: 'বাংলা' },
  { code: 'ta', name: 'Tamil', nativeName: 'தமிழ்' },
  { code: 'uk', name: 'Ukrainian', nativeName: 'Українська' },
  { code: 'ro', name: 'Romanian', nativeName: 'Română' },
  { code: 'el', name: 'Greek', nativeName: 'Ελληνικά' },
  { code: 'he', name: 'Hebrew', nativeName: 'עברית' },
  { code: 'sv', name: 'Swedish', nativeName: 'Svenska' },
  { code: 'da', name: 'Danish', nativeName: 'Dansk' },
];

interface ContentLanguagePickerProps {
  value: string | null;
  onChange: (code: string) => void;
  placeholder?: string;
}

export function ContentLanguagePicker({ value, onChange, placeholder }: ContentLanguagePickerProps) {
  const [search, setSearch] = useState('');

  const filteredLanguages = useMemo(() => {
    if (!search.trim()) return POPULAR_CONTENT_LANGUAGES;
    const q = search.toLowerCase();
    return POPULAR_CONTENT_LANGUAGES.filter(
      l => l.name.toLowerCase().includes(q) ||
           l.nativeName.toLowerCase().includes(q) ||
           l.code.toLowerCase().includes(q)
    );
  }, [search]);

  const selectedLang = POPULAR_CONTENT_LANGUAGES.find(l => l.code === value);

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder={placeholder || 'Search languages...'}
          className="pl-9"
        />
      </div>

      <ScrollArea className="h-[280px] rounded-lg border border-border">
        <div className="p-1 space-y-0.5">
          {filteredLanguages.map(lang => (
            <button
              key={lang.code}
              type="button"
              onClick={() => onChange(lang.code)}
              className={cn(
                'w-full flex items-center justify-between px-3 py-2.5 rounded-md text-sm transition-colors',
                value === lang.code
                  ? 'bg-primary/10 text-primary'
                  : 'hover:bg-secondary text-foreground'
              )}
            >
              <div className="flex items-center gap-3">
                <span className="font-mono text-xs text-muted-foreground w-6 uppercase">{lang.code}</span>
                <span className="font-medium">{lang.name}</span>
                <span className="text-muted-foreground text-xs">{lang.nativeName}</span>
              </div>
              {value === lang.code && (
                <Check className="h-4 w-4 text-primary shrink-0" />
              )}
            </button>
          ))}
          {filteredLanguages.length === 0 && search.trim() && (
            <div className="p-4 text-center">
              <p className="text-sm text-muted-foreground mb-2">No match found</p>
              <button
                type="button"
                onClick={() => onChange(search.trim().toLowerCase())}
                className="text-sm text-primary hover:underline"
              >
                Use "{search.trim()}" as custom language code
              </button>
            </div>
          )}
        </div>
      </ScrollArea>

      {selectedLang && (
        <p className="text-xs text-muted-foreground">
          Selected: <span className="font-medium text-foreground">{selectedLang.nativeName}</span> ({selectedLang.code})
        </p>
      )}
    </div>
  );
}
