/**
 * System Apps — always installed, cannot be deactivated or uninstalled.
 * These are core OS modules that other apps depend on.
 */
export const SYSTEM_APP_IDS = ['ull'] as const;

export type SystemAppId = typeof SYSTEM_APP_IDS[number];

/** Returns true if the given app ID is a system app (non-removable). */
export function isSystemApp(appId: string): boolean {
  return (SYSTEM_APP_IDS as readonly string[]).includes(appId);
}

/** Apps that are always hidden from the Marketplace browse view (but shown when installed). */
export const HIDDEN_FROM_MARKETPLACE = ['brain'] as const;
