import { ServiceCategory, Artisan } from '../types';

/**
 * Pure transformation: Computes category counts dynamically based on the artisan list.
 * For category 'all', returns total artisan count. For specific categories, counts matching category ID.
 */
export function calculateCategoryCounts(
  categories: ServiceCategory[],
  artisans: Artisan[]
): ServiceCategory[] {
  if (!categories || !Array.isArray(categories)) return [];
  const safeArtisans = Array.isArray(artisans) ? artisans : [];

  return categories.map(cat => ({
    ...cat,
    count: cat.id === 'all'
      ? safeArtisans.length
      : safeArtisans.filter(a => a.category === cat.id).length,
  }));
}
