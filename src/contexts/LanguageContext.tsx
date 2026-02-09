import { createContext, useContext, useState, ReactNode, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/integrations/supabase/client';

export interface Language {
  code: string;
  name: string;
  nativeName: string;
  dir: 'ltr' | 'rtl';
}

export const AVAILABLE_LANGUAGES: Language[] = [
  { code: 'en', name: 'English', nativeName: 'English', dir: 'ltr' },
  { code: 'ar', name: 'Arabic', nativeName: 'العربية', dir: 'rtl' },
  { code: 'fr', name: 'French', nativeName: 'Français', dir: 'ltr' },
  { code: 'es', name: 'Spanish', nativeName: 'Español', dir: 'ltr' },
  { code: 'de', name: 'German', nativeName: 'Deutsch', dir: 'ltr' },
];

interface LanguageContextType {
  currentLanguage: Language;
  enabledLanguages: Language[];
  setCurrentLanguage: (lang: Language) => void;
  setEnabledLanguages: (languages: Language[]) => void;
  toggleLanguage: (lang: Language) => void;
  cycleLanguage: () => void;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

const STORAGE_KEY_CURRENT = 'app_current_language';
const STORAGE_KEY_ENABLED = 'app_enabled_languages';

export function LanguageProvider({ children }: { children: ReactNode }) {
  const { i18n } = useTranslation();
  const [currentLanguage, setCurrentLanguageState] = useState<Language>(AVAILABLE_LANGUAGES[0]);
  const [enabledLanguages, setEnabledLanguagesState] = useState<Language[]>([AVAILABLE_LANGUAGES[0]]);

  // Load from DB profile first, then localStorage fallback
  useEffect(() => {
    const loadPreferences = async () => {
      // Load enabled languages from localStorage
      const storedEnabled = localStorage.getItem(STORAGE_KEY_ENABLED);
      if (storedEnabled) {
        try {
          const parsed = JSON.parse(storedEnabled);
          const enabled = AVAILABLE_LANGUAGES.filter(lang => parsed.includes(lang.code));
          if (enabled.length > 0) setEnabledLanguagesState(enabled);
        } catch (e) {
          console.error('Failed to parse enabled languages', e);
        }
      }

      // Try loading preferred_locale from profile
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('preferred_locale')
          .eq('user_id', user.id)
          .single();
        
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
    // Sync with i18next
    i18n.changeLanguage(currentLanguage.code);
  }, [currentLanguage, i18n]);

  const setCurrentLanguage = (lang: Language) => {
    setCurrentLanguageState(lang);
    localStorage.setItem(STORAGE_KEY_CURRENT, lang.code);
  };

  const setEnabledLanguages = (languages: Language[]) => {
    setEnabledLanguagesState(languages);
    localStorage.setItem(STORAGE_KEY_ENABLED, JSON.stringify(languages.map(l => l.code)));
    
    // If current language is not in enabled list, switch to first enabled
    if (!languages.find(l => l.code === currentLanguage.code) && languages.length > 0) {
      setCurrentLanguage(languages[0]);
    }
  };

  const toggleLanguage = (lang: Language) => {
    const isEnabled = enabledLanguages.find(l => l.code === lang.code);
    
    if (isEnabled) {
      // Don't allow removing the last language
      if (enabledLanguages.length > 1) {
        setEnabledLanguages(enabledLanguages.filter(l => l.code !== lang.code));
      }
    } else {
      setEnabledLanguages([...enabledLanguages, lang]);
    }
  };

  const cycleLanguage = () => {
    if (enabledLanguages.length <= 1) return;
    
    const currentIndex = enabledLanguages.findIndex(l => l.code === currentLanguage.code);
    const nextIndex = (currentIndex + 1) % enabledLanguages.length;
    setCurrentLanguage(enabledLanguages[nextIndex]);
  };

  return (
    <LanguageContext.Provider value={{
      currentLanguage,
      enabledLanguages,
      setCurrentLanguage,
      setEnabledLanguages,
      toggleLanguage,
      cycleLanguage
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
