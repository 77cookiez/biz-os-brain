import { useState, useCallback, useRef, useMemo, useEffect } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { getCachedTranslation, setCachedTranslation, loadAllCachedTranslations, clearTranslationCache as clearIDBCache } from '@/lib/ullCache';

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

// Flag to track if we've hydrated from IndexedDB
let hydratedFromIDB = false;

export function useULL() {
  const { currentLanguage, contentLocale } = useLanguage();
  const targetLang = contentLocale || currentLanguage.code;
  const [, forceUpdate] = useState(0);
  const batchQueue = useRef<TranslateItem[]>([]);
  const batchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const meaningQueue = useRef<string[]>([]);
  const meaningTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Hydrate from IndexedDB on first mount
  useEffect(() => {
    if (hydratedFromIDB) return;
    hydratedFromIDB = true;
    loadAllCachedTranslations().then(entries => {
      if (entries.size > 0) {
        for (const [key, text] of entries) {
          if (key.startsWith('meaning:')) {
            meaningCache.set(key, text);
          } else {
            translationCache.set(key, text);
          }
        }
        forceUpdate(n => n + 1);
      }
    }).catch(() => { /* silent */ });
  }, []);

  const flushBatch = useCallback(async () => {
    const items = [...batchQueue.current];
    batchQueue.current = [];
    if (items.length === 0) return;

    const tl = targetLang;

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const accessToken = session?.access_token;
      if (!accessToken) return;

      const resp = await fetch(ULL_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          items: items.map(i => ({
            table: i.table,
            id: i.id,
            field: i.field,
            text: i.text,
            source_lang: i.sourceLang,
          })),
          target_lang: tl,
        }),
      });

      if (!resp.ok) return;

      const data = await resp.json();
      const translations = data.translations as Record<string, string>;

      for (const [compositeKey, translatedText] of Object.entries(translations)) {
        const fullKey = `${compositeKey}:${tl}`;
        translationCache.set(fullKey, translatedText);
        // Persist to IndexedDB (fire-and-forget)
        setCachedTranslation(fullKey, translatedText).catch(() => {});
      }

      forceUpdate(n => n + 1);
    } catch {
      // Silent failure — original text will be shown
    }
  }, [targetLang]);

  const flushMeaningBatch = useCallback(async () => {
    const ids = [...meaningQueue.current];
    meaningQueue.current = [];
    if (ids.length === 0) return;

    const tl = targetLang;

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const accessToken = session?.access_token;
      if (!accessToken) return;

      const resp = await fetch(ULL_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          meaning_object_ids: ids,
          target_lang: tl,
        }),
      });

      if (!resp.ok) {
        // Clear pending so they can be retried
        for (const id of ids) pendingMeaningRequests.delete(`${id}:${tl}`);
        return;
      }

      const data = await resp.json();
      const translations = data.translations as Record<string, string>;

      for (const [mId, translatedText] of Object.entries(translations)) {
        const cKey = meaningCacheKey(mId, tl);
        meaningCache.set(cKey, translatedText);
        // Persist to IndexedDB (fire-and-forget)
        setCachedTranslation(cKey, translatedText).catch(() => {});
        pendingMeaningRequests.delete(`${mId}:${tl}`);
      }
      // Clear any ids that weren't in the response
      for (const id of ids) pendingMeaningRequests.delete(`${id}:${tl}`);

      forceUpdate(n => n + 1);
    } catch {
      for (const id of ids) pendingMeaningRequests.delete(`${id}:${tl}`);
    }
  }, [targetLang]);

  const scheduleBatch = useCallback((item: TranslateItem) => {
    batchQueue.current.push(item);
    if (batchTimer.current) clearTimeout(batchTimer.current);
    batchTimer.current = setTimeout(flushBatch, 50);
  }, [flushBatch]);

  const scheduleMeaning = useCallback((meaningId: string) => {
    const pendingKey = `${meaningId}:${targetLang}`;
    if (pendingMeaningRequests.has(pendingKey)) return;
    pendingMeaningRequests.add(pendingKey);
    meaningQueue.current.push(meaningId);
    if (meaningTimer.current) clearTimeout(meaningTimer.current);
    meaningTimer.current = setTimeout(flushMeaningBatch, 50);
  }, [flushMeaningBatch, targetLang]);

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
    const tl = targetLang;
    if (sourceLang === tl) return originalText;

    const key = cacheKey(table, id, field, tl);
    const cached = translationCache.get(key);
    if (cached) return cached;

    scheduleBatch({ table, id, field, text: originalText, sourceLang });
    return originalText;
  }, [targetLang, scheduleBatch]);

  /**
   * Phase 1: Get translated text by meaning_object_id.
   */
  const getTextByMeaning = useCallback((
    meaningId: string | null | undefined,
    fallback: string
  ): string => {
    if (!meaningId) return fallback;

    const tl = targetLang;
    const key = meaningCacheKey(meaningId, tl);
    const cached = meaningCache.get(key);
    if (cached) return cached;

    scheduleMeaning(meaningId);
    return fallback;
  }, [targetLang, scheduleMeaning]);

  return { getText, getTextByMeaning };
}

/**
 * Clear the translation cache. Useful when language changes.
 */
export function clearULLCache() {
  translationCache.clear();
  meaningCache.clear();
  pendingMeaningRequests.clear();
  hydratedFromIDB = false;
  clearIDBCache().catch(() => {});
}
