import { appLocalStorage } from './storage';

const LEGACY_STORAGE_KEY = 'bricojob_favorites';
const GUEST_STORAGE_KEY = 'bricojob_favorites_guest';
const USER_STORAGE_KEY_PREFIX = 'bricojob_favorites_user_';

export interface IFavoritesRepository {
  getFavoriteIds(userId?: string | null): string[];
  saveFavoriteIds(favoriteIds: string[], userId?: string | null): boolean;
}

export class FavoritesRepository implements IFavoritesRepository {
  private getStorageKey(userId?: string | null): string {
    if (userId) {
      return `${USER_STORAGE_KEY_PREFIX}${userId}`;
    }
    return GUEST_STORAGE_KEY;
  }

  public getFavoriteIds(userId?: string | null): string[] {
    const key = this.getStorageKey(userId);
    let raw = appLocalStorage.getItem<string[]>(key, null);

    // Safe fallback for guest: if guest storage key does not exist yet, check legacy storage key
    if (raw === null && !userId) {
      raw = appLocalStorage.getItem<string[]>(LEGACY_STORAGE_KEY, []);
    }

    const LEGACY_SEED_IDS = ['art-1', 'art-2', 'art-3', 'art-4', 'art-5', 'art-6', 'art-7', 'art-8'];
    return Array.isArray(raw) ? raw.filter(id => !LEGACY_SEED_IDS.includes(id)) : [];
  }

  public saveFavoriteIds(favoriteIds: string[], userId?: string | null): boolean {
    const key = this.getStorageKey(userId);
    return appLocalStorage.setItem(key, favoriteIds);
  }
}

export const favoritesRepository = new FavoritesRepository();
