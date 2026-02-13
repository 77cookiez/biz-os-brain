/**
 * ULL Translation Cache — IndexedDB persistence layer.
 * 
 * Persists translation cache across sessions to avoid re-fetching
 * translations on every page load.
 */

const DB_NAME = 'ull_cache';
const DB_VERSION = 1;
const STORE_NAME = 'translations';
const MAX_ENTRIES = 5000;
const TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

interface CacheEntry {
  key: string;
  text: string;
  timestamp: number;
}

let dbPromise: Promise<IDBDatabase> | null = null;

function openDB(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB not available'));
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'key' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => {
      dbPromise = null;
      reject(request.error);
    };
  });

  return dbPromise;
}

export async function getCachedTranslation(key: string): Promise<string | null> {
  try {
    const db = await openDB();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const request = store.get(key);

      request.onsuccess = () => {
        const entry = request.result as CacheEntry | undefined;
        if (entry && Date.now() - entry.timestamp < TTL_MS) {
          resolve(entry.text);
        } else {
          resolve(null);
        }
      };

      request.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

export async function setCachedTranslation(key: string, text: string): Promise<void> {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);

    const entry: CacheEntry = { key, text, timestamp: Date.now() };
    store.put(entry);

    // Cleanup: count entries and delete oldest if over limit
    const countReq = store.count();
    countReq.onsuccess = () => {
      if (countReq.result > MAX_ENTRIES) {
        const cursor = store.openCursor();
        let deleted = 0;
        const toDelete = countReq.result - MAX_ENTRIES;
        cursor.onsuccess = () => {
          const c = cursor.result;
          if (c && deleted < toDelete) {
            c.delete();
            deleted++;
            c.continue();
          }
        };
      }
    };
  } catch {
    // Silent failure — in-memory cache still works
  }
}

export async function clearTranslationCache(): Promise<void> {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).clear();
  } catch {
    // Silent
  }
}

/**
 * Bulk load all cached translations into a Map.
 * Called on app startup to hydrate in-memory cache.
 */
export async function loadAllCachedTranslations(): Promise<Map<string, string>> {
  const result = new Map<string, string>();
  try {
    const db = await openDB();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const cursor = store.openCursor();
      const now = Date.now();

      cursor.onsuccess = () => {
        const c = cursor.result;
        if (c) {
          const entry = c.value as CacheEntry;
          if (now - entry.timestamp < TTL_MS) {
            result.set(entry.key, entry.text);
          }
          c.continue();
        } else {
          resolve(result);
        }
      };

      cursor.onerror = () => resolve(result);
    });
  } catch {
    return result;
  }
}
