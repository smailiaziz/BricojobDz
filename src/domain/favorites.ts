import { Artisan, UserSession } from '../types';

/**
 * Pure transformation: Checks if an artisan profile is owned by the current user.
 * Strictly uses canonical identity links (id / artisanId) and never relies on mutable names.
 */
export function isOwnArtisanProfile(
  artisan: { id: string } | null | undefined,
  currentUser?: UserSession | null
): boolean {
  if (!artisan || !currentUser) return false;
  if (currentUser.id === artisan.id) return true;
  if (currentUser.artisanId && currentUser.artisanId === artisan.id) return true;
  return false;
}

/**
 * Pure transformation: Toggles an artisan ID in a list of favorite IDs.
 * Returns an immutable object containing the updated array and a boolean indicating whether it was added.
 */
export function toggleFavorite(
  favoriteIds: string[],
  targetId: string
): { updatedFavorites: string[]; isAdded: boolean } {
  if (!targetId) {
    return { updatedFavorites: [...(favoriteIds || [])], isAdded: false };
  }

  const safeList = Array.isArray(favoriteIds) ? favoriteIds : [];
  const exists = safeList.includes(targetId);

  if (exists) {
    return {
      updatedFavorites: safeList.filter(id => id !== targetId),
      isAdded: false,
    };
  }

  return {
    updatedFavorites: [...safeList, targetId],
    isAdded: true,
  };
}

/**
 * Pure transformation: Filters the list of artisans to only include those in the favoriteIds list.
 */
export function filterFavoriteArtisans(
  artisans: Artisan[],
  favoriteIds: string[]
): Artisan[] {
  if (!artisans || !Array.isArray(artisans)) return [];
  if (!favoriteIds || !Array.isArray(favoriteIds) || favoriteIds.length === 0) return [];

  const favoriteSet = new Set(favoriteIds);
  return artisans.filter(a => favoriteSet.has(a.id));
}
