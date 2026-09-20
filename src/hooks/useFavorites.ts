import { useState, useEffect, useMemo, useCallback } from 'react';
import { Artisan, UserSession } from '../types';
import { toggleFavorite as toggleFavoriteDomain, filterFavoriteArtisans, canFavoriteArtisan } from '../domain';
import { favoritesRepository } from '../repositories';

interface UseFavoritesOptions {
  artisans: Artisan[];
  currentUser?: UserSession | null;
  onToast?: (message: string, type?: 'success' | 'info' | 'warning' | 'error') => void;
}

export function useFavorites({ artisans, currentUser, onToast }: UseFavoritesOptions) {
  const userId = currentUser?.id || null;

  const [favorites, setFavorites] = useState<string[]>(() => {
    return favoritesRepository.getFavoriteIds(userId);
  });

  // Re-sync favorites when active user session changes (login/logout/switch)
  useEffect(() => {
    setFavorites(favoritesRepository.getFavoriteIds(userId));
  }, [userId]);

  // Derived filtered favorite artisans
  const favoriteArtisans = useMemo(() => {
    return filterFavoriteArtisans(artisans, favorites);
  }, [artisans, favorites]);

  // Toggle handler
  const handleToggleFavorite = useCallback((artisanId: string) => {
    if (!artisanId) return;

    // Ownership guard: Owner cannot favorite their own profile
    if (currentUser) {
      const targetArtisan = artisans.find(a => a.id === artisanId) || { id: artisanId };
      if (!canFavoriteArtisan(currentUser, targetArtisan)) {
        return;
      }
    }

    setFavorites(prev => {
      const { updatedFavorites, isAdded } = toggleFavoriteDomain(prev, artisanId);
      favoritesRepository.saveFavoriteIds(updatedFavorites, userId);
      if (onToast) {
        if (isAdded) {
          onToast('تمت إضافة الحرفي إلى قائمة المفضلة', 'success');
        } else {
          onToast('تمت إزالة الحرفي من المفضلة', 'info');
        }
      }
      return updatedFavorites;
    });
  }, [userId, currentUser, artisans, onToast]);

  return {
    favorites,
    favoriteArtisans,
    toggleFavorite: handleToggleFavorite,
  };
}
