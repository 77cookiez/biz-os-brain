import { useState, useCallback, useRef } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';

const ULL_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ull-translate`;

interface TranslateItem {
  table: string;
  id: string;
  field: string;
  text: string;
  sourceLang: string;
}

// In-memory translation cache (shared across all hook instances)
const translationCache = new Map<string, string>();
const pendingRequests = new Map<string, Promise<void>>();

function cacheKey(table: string, id: string, field: string, targetLang: string) {
  return `${table}:${id}:${field}:${targetLang}`;
}

export function useULL() {
  const { currentLanguage } = useLanguage();
  const [, forceUpdate] = useState(0);
  const batchQueue = useRef<TranslateItem[]>([]);
  const batchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flushBatch = useCallback(async () => {
    const items = [...batchQueue.current];
    batchQueue.current = [];
    if (items.length === 0) return;

    const targetLang = currentLanguage.code;

    try {
      const resp = await fetch(ULL_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({
          items: items.map(i => ({
            table: i.table,
            id: i.id,
            field: i.field,
            text: i.text,
            source_lang: i.sourceLang,
          })),
          target_lang: targetLang,
        }),
      });

      if (!resp.ok) return; // Fallback to original text silently

      const data = await resp.json();
      const translations = data.translations as Record<string, string>;

      // Store in cache
      for (const [compositeKey, translatedText] of Object.entries(translations)) {
        const fullKey = `${compositeKey}:${targetLang}`;
        translationCache.set(fullKey, translatedText);
      }

      // Trigger re-render for all consumers
      forceUpdate(n => n + 1);
    } catch {
      // Silent failure — original text will be shown
    }
  }, [currentLanguage.code]);

  const scheduleBatch = useCallback((item: TranslateItem) => {
    batchQueue.current.push(item);
    if (batchTimer.current) clearTimeout(batchTimer.current);
    batchTimer.current = setTimeout(flushBatch, 50); // 50ms debounce
  }, [flushBatch]);

  /**
   * Get the translated text for a piece of content.
   * Returns the original text immediately, schedules translation if needed.
   */
  const getText = useCallback((
    table: string,
    id: string,
    field: string,
    originalText: string,
    sourceLang: string = 'en'
  ): string => {
    const targetLang = currentLanguage.code;

    // Same language — no translation needed
    if (sourceLang === targetLang) return originalText;

    // Check cache
    const key = cacheKey(table, id, field, targetLang);
    const cached = translationCache.get(key);
    if (cached) return cached;

    // Schedule translation
    scheduleBatch({ table, id, field, text: originalText, sourceLang });

    // Return original while waiting
    return originalText;
  }, [currentLanguage.code, scheduleBatch]);

  return { getText };
}

/**
 * Clear the translation cache. Useful when language changes.
 */
export function clearULLCache() {
  translationCache.clear();
}
