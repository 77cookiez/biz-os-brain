import { describe, it, expect } from 'vitest';
import en from '@/i18n/translations/en.json';
import ar from '@/i18n/translations/ar.json';
import fr from '@/i18n/translations/fr.json';
import es from '@/i18n/translations/es.json';
import de from '@/i18n/translations/de.json';

/**
 * Recursively collect all dot-notation keys from a nested object.
 */
function collectKeys(obj: Record<string, unknown>, prefix = ''): string[] {
  const keys: string[] = [];
  for (const [key, value] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      keys.push(...collectKeys(value as Record<string, unknown>, fullKey));
    } else {
      keys.push(fullKey);
    }
  }
  return keys;
}

describe('i18n translation key consistency', () => {
  const enKeys = new Set(collectKeys(en));
  const locales: Record<string, Set<string>> = {
    Arabic: new Set(collectKeys(ar)),
    French: new Set(collectKeys(fr)),
    Spanish: new Set(collectKeys(es)),
    German: new Set(collectKeys(de)),
  };

  for (const [name, keys] of Object.entries(locales)) {
    it(`${name} file has all English keys`, () => {
      const missing = [...enKeys].filter(k => !keys.has(k));
      expect(missing, `Missing ${name} keys: ${missing.join(', ')}`).toEqual([]);
    });

    it(`No orphan ${name} keys (not in English)`, () => {
      const orphan = [...keys].filter(k => !enKeys.has(k));
      expect(orphan, `Orphan ${name} keys: ${orphan.join(', ')}`).toEqual([]);
    });
  }
});
