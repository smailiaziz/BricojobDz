import { Artisan } from '../types';
import { INITIAL_ARTISANS } from '../data';
import { migrateArtisan } from '../utils';
import { countUserReviews } from '../domain';
import { appLocalStorage } from './storage';
import { orderRepository } from './orderRepository';
import { enrichArtisanWithDerivedMetrics } from '../domain/artisan';

const STORAGE_KEY = 'bricojob_artisans';
const LEGACY_SEED_IDS = ['art-1', 'art-2', 'art-3', 'art-4', 'art-5', 'art-6', 'art-7', 'art-8'];

export interface IArtisanRepository {
  getAll(): Artisan[];
  saveAll(artisans: Artisan[]): boolean;
  countUserReviews(userId: string, userName?: string): number;
}

export class ArtisanRepository implements IArtisanRepository {
  public getAll(): Artisan[] {
    try {
      const raw = appLocalStorage.getItem<unknown[]>(STORAGE_KEY, null);
      let list: Artisan[] = [];
      if (raw && Array.isArray(raw)) {
        list = raw
          .map(migrateArtisan)
          .filter((a): a is Artisan => Boolean(a && a.id));
      } else {
        list = INITIAL_ARTISANS;
      }

      // Enrich with dynamic derived metrics (rating, reviewCount, completedJobs) at read-time
      const orders = orderRepository.getAll();
      return list.map(a => enrichArtisanWithDerivedMetrics(a, orders));
    } catch {
      try {
        const orders = orderRepository.getAll();
        return INITIAL_ARTISANS.map(a => enrichArtisanWithDerivedMetrics(a, orders));
      } catch {
        return INITIAL_ARTISANS;
      }
    }
  }

  public saveAll(artisans: Artisan[]): boolean {
    if (!Array.isArray(artisans)) return false;
    const sanitized = artisans
      .filter((a): a is Artisan => Boolean(a && typeof a === 'object' && a.id))
      .map(artisan => {
        const { rating, reviewCount, completedJobs, ...base } = artisan;
        return base;
      });
    return appLocalStorage.setItem(STORAGE_KEY, sanitized);
  }

  public countUserReviews(userId: string, userName?: string): number {
    return countUserReviews(this.getAll(), userId, userName);
  }
}


export const artisanRepository = new ArtisanRepository();
