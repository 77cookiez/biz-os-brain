import { describe, it, expect } from 'vitest';
import en from '@/i18n/translations/en.json';
import ar from '@/i18n/translations/ar.json';
import fr from '@/i18n/translations/fr.json';

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
  const arKeys = new Set(collectKeys(ar));
  const frKeys = new Set(collectKeys(fr));

  it('Arabic file has all English keys', () => {
    const missing = [...enKeys].filter(k => !arKeys.has(k));
    expect(missing, `Missing Arabic keys: ${missing.join(', ')}`).toEqual([]);
  });

  it('French file has all English keys', () => {
    const missing = [...enKeys].filter(k => !frKeys.has(k));
    expect(missing, `Missing French keys: ${missing.join(', ')}`).toEqual([]);
  });

  it('No orphan Arabic keys (not in English)', () => {
    const orphan = [...arKeys].filter(k => !enKeys.has(k));
    expect(orphan, `Orphan Arabic keys: ${orphan.join(', ')}`).toEqual([]);
  });

  it('No orphan French keys (not in English)', () => {
    const orphan = [...frKeys].filter(k => !enKeys.has(k));
    expect(orphan, `Orphan French keys: ${orphan.join(', ')}`).toEqual([]);
  });
});
