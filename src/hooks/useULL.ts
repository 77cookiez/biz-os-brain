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
// Meaning-based cache: meaning_object_id:target_lang → text
const meaningCache = new Map<string, string>();

function cacheKey(table: string, id: string, field: string, targetLang: string) {
  return `${table}:${id}:${field}:${targetLang}`;
}

function meaningCacheKey(meaningId: string, targetLang: string) {
  return `meaning:${meaningId}:${targetLang}`;
}

// Pending meaning translation requests — keyed by meaningId:targetLang
const pendingMeaningRequests = new Set<string>();

export function useULL() {
  const { currentLanguage } = useLanguage();
  const [, forceUpdate] = useState(0);
  const batchQueue = useRef<TranslateItem[]>([]);
  const batchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const meaningQueue = useRef<string[]>([]);
  const meaningTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

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

      if (!resp.ok) return;

      const data = await resp.json();
      const translations = data.translations as Record<string, string>;

      for (const [compositeKey, translatedText] of Object.entries(translations)) {
        const fullKey = `${compositeKey}:${targetLang}`;
        translationCache.set(fullKey, translatedText);
      }

      forceUpdate(n => n + 1);
    } catch {
      // Silent failure — original text will be shown
    }
  }, [currentLanguage.code]);

  const flushMeaningBatch = useCallback(async () => {
    const ids = [...meaningQueue.current];
    meaningQueue.current = [];
    if (ids.length === 0) return;

    const targetLang = currentLanguage.code;

    try {
      const resp = await fetch(ULL_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({
          meaning_object_ids: ids,
          target_lang: targetLang,
        }),
      });

      if (!resp.ok) {
        // Clear pending so they can be retried
        for (const id of ids) pendingMeaningRequests.delete(`${id}:${targetLang}`);
        return;
      }

      const data = await resp.json();
      const translations = data.translations as Record<string, string>;

      for (const [mId, translatedText] of Object.entries(translations)) {
        meaningCache.set(meaningCacheKey(mId, targetLang), translatedText);
        pendingMeaningRequests.delete(`${mId}:${targetLang}`);
      }
      // Clear any ids that weren't in the response
      for (const id of ids) pendingMeaningRequests.delete(`${id}:${targetLang}`);

      forceUpdate(n => n + 1);
    } catch {
      for (const id of ids) pendingMeaningRequests.delete(`${id}:${targetLang}`);
    }
  }, [currentLanguage.code]);

  const scheduleBatch = useCallback((item: TranslateItem) => {
    batchQueue.current.push(item);
    if (batchTimer.current) clearTimeout(batchTimer.current);
    batchTimer.current = setTimeout(flushBatch, 50);
  }, [flushBatch]);

  const scheduleMeaning = useCallback((meaningId: string) => {
    const pendingKey = `${meaningId}:${currentLanguage.code}`;
    if (pendingMeaningRequests.has(pendingKey)) return;
    pendingMeaningRequests.add(pendingKey);
    meaningQueue.current.push(meaningId);
    if (meaningTimer.current) clearTimeout(meaningTimer.current);
    meaningTimer.current = setTimeout(flushMeaningBatch, 50);
  }, [flushMeaningBatch, currentLanguage.code]);

  /**
   * Legacy Phase 0: Get translated text by table/id/field.
   */
  const getText = useCallback((
    table: string,
    id: string,
    field: string,
    originalText: string,
    sourceLang: string = 'en'
  ): string => {
    const targetLang = currentLanguage.code;
    if (sourceLang === targetLang) return originalText;

    const key = cacheKey(table, id, field, targetLang);
    const cached = translationCache.get(key);
    if (cached) return cached;

    scheduleBatch({ table, id, field, text: originalText, sourceLang });
    return originalText;
  }, [currentLanguage.code, scheduleBatch]);

  /**
   * Phase 1: Get translated text by meaning_object_id.
   */
  const getTextByMeaning = useCallback((
    meaningId: string | null | undefined,
    fallback: string
  ): string => {
    if (!meaningId) return fallback;

    const targetLang = currentLanguage.code;
    const key = meaningCacheKey(meaningId, targetLang);
    const cached = meaningCache.get(key);
    if (cached) return cached;

    scheduleMeaning(meaningId);
    return fallback;
  }, [currentLanguage.code, scheduleMeaning]);

  return { getText, getTextByMeaning };
}

/**
 * Clear the translation cache. Useful when language changes.
 */
export function clearULLCache() {
  translationCache.clear();
  meaningCache.clear();
}
