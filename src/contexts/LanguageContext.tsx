import { createContext, useContext, useState, ReactNode, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/integrations/supabase/client';
import { clearULLCache } from '@/hooks/useULL';

export interface Language {
  code: string;
  name: string;
  nativeName: string;
  dir: 'ltr' | 'rtl';
}

/** Languages that have full UI translations (i18n) */
export const AVAILABLE_LANGUAGES: Language[] = [
  { code: 'en', name: 'English', nativeName: 'English', dir: 'ltr' },
  { code: 'ar', name: 'Arabic', nativeName: 'العربية', dir: 'rtl' },
  { code: 'fr', name: 'French', nativeName: 'Français', dir: 'ltr' },
];

/** UI language codes that have full i18n support */
const UI_LANGUAGE_CODES = new Set(AVAILABLE_LANGUAGES.map(l => l.code));

interface LanguageContextType {
  currentLanguage: Language;
  contentLocale: string | null;
  setCurrentLanguage: (lang: Language) => void;
  setContentLocale: (code: string | null) => void;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

const STORAGE_KEY_CURRENT = 'app_current_language';

export function LanguageProvider({ children }: { children: ReactNode }) {
  const { i18n } = useTranslation();
  const [currentLanguage, setCurrentLanguageState] = useState<Language>(AVAILABLE_LANGUAGES[0]);
  const [contentLocale, setContentLocaleState] = useState<string | null>(null);

  // Load from DB profile first, then localStorage fallback
  useEffect(() => {
    const loadPreferences = async () => {
      // Try loading preferred_locale + content_locale from profile
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('preferred_locale, content_locale')
          .eq('user_id', user.id)
          .single();
        
        if (profile?.content_locale) {
          setContentLocaleState(profile.content_locale);
        }

        if (profile?.preferred_locale) {
          const found = AVAILABLE_LANGUAGES.find(l => l.code === profile.preferred_locale);
          if (found) {
            setCurrentLanguageState(found);
            localStorage.setItem(STORAGE_KEY_CURRENT, found.code);
            return;
          }
        }
      }

      // Fallback to localStorage
      const storedCurrent = localStorage.getItem(STORAGE_KEY_CURRENT);
      if (storedCurrent) {
        const found = AVAILABLE_LANGUAGES.find(l => l.code === storedCurrent);
        if (found) setCurrentLanguageState(found);
      }
    };

    loadPreferences();
  }, []);

  // Update document direction and i18n when language changes
  useEffect(() => {
    document.documentElement.dir = currentLanguage.dir;
    document.documentElement.lang = currentLanguage.code;
    i18n.changeLanguage(currentLanguage.code);
  }, [currentLanguage, i18n]);

  const setCurrentLanguage = async (lang: Language) => {
    setCurrentLanguageState(lang);
    localStorage.setItem(STORAGE_KEY_CURRENT, lang.code);
    clearULLCache();
    
    // Persist to DB profile
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      await supabase
        .from('profiles')
        .update({ preferred_locale: lang.code })
        .eq('user_id', user.id);
    }
  };

  const setContentLocale = async (code: string | null) => {
    setContentLocaleState(code);
    clearULLCache();

    // Auto-sync UI language if the chosen content locale has a UI translation
    if (code && UI_LANGUAGE_CODES.has(code)) {
      const matchedLang = AVAILABLE_LANGUAGES.find(l => l.code === code);
      if (matchedLang && matchedLang.code !== currentLanguage.code) {
        setCurrentLanguageState(matchedLang);
        localStorage.setItem(STORAGE_KEY_CURRENT, matchedLang.code);
      }
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      await supabase
        .from('profiles')
        .update({ 
          content_locale: code,
          // Also persist the auto-synced UI language
          ...(code && UI_LANGUAGE_CODES.has(code) ? { preferred_locale: code } : {})
        } as any)
        .eq('user_id', user.id);
    }
  };

  return (
    <LanguageContext.Provider value={{
      currentLanguage,
      contentLocale,
      setCurrentLanguage,
      setContentLocale,
    }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
}
