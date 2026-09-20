import { appLocalStorage } from '../repositories/storage';

export const PWA_INSTALL_DISMISSED_KEY = 'bricojob_pwa_install_dismissed_at';
export const PWA_COOLDOWN_MS = 3 * 24 * 60 * 60 * 1000; // 3 days cooldown

/**
 * Checks if the user recently dismissed the PWA install prompt within the cooldown window.
 * Handles storage errors and malformed values safely.
 */
export function isPwaDismissedInCooldown(now: number = Date.now()): boolean {
  try {
    const raw = appLocalStorage.getItem<number | string>(PWA_INSTALL_DISMISSED_KEY);
    if (raw === null || raw === undefined) {
      return false;
    }
    const timestamp = typeof raw === 'number' ? raw : Number(raw);
    if (!Number.isFinite(timestamp) || timestamp <= 0) {
      // Clear corrupt data
      appLocalStorage.removeItem(PWA_INSTALL_DISMISSED_KEY);
      return false;
    }
    return now - timestamp < PWA_COOLDOWN_MS;
  } catch {
    return false;
  }
}

/**
 * Records the current timestamp as the dismissal time in local storage.
 */
export function recordPwaDismissal(now: number = Date.now()): void {
  try {
    appLocalStorage.setItem(PWA_INSTALL_DISMISSED_KEY, now);
  } catch {
    // Graceful fallback
  }
}

/**
 * Clears the PWA dismissal timestamp.
 */
export function clearPwaDismissal(): void {
  try {
    appLocalStorage.removeItem(PWA_INSTALL_DISMISSED_KEY);
  } catch {
    // Graceful fallback
  }
}

/**
 * Checks if the app is currently running in standalone display mode.
 */
export function isStandaloneMode(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const isMediaStandalone = window.matchMedia && window.matchMedia('(display-mode: standalone)').matches;
    const isNavStandalone = (window.navigator as unknown as { standalone?: boolean })?.standalone === true;
    return Boolean(isMediaStandalone || isNavStandalone);
  } catch {
    return false;
  }
}

/**
 * Safely detects iOS devices (iPhone, iPad, iPod) without false positives.
 */
export function isIOSDevice(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const userAgent = window.navigator?.userAgent?.toLowerCase() || '';
    return /iphone|ipad|ipod/.test(userAgent) && !isStandaloneMode();
  } catch {
    return false;
  }
}
