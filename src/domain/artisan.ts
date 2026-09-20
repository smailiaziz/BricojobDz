import { Artisan, UserSession, OrderItem } from '../types';
import { isOwnArtisanProfile } from './favorites';
import { calculateRatingSummary } from './reviews';

/**
 * Pure domain selector/enricher: Computes derived professional trust attributes at read-time
 * to prevent database state divergence and self-escalated values.
 * 
 * Derived fields:
 * - rating: Average of valid reviews (1-5) using canonical calculateRatingSummary()
 * - reviewCount: Number of valid reviews
 * - completedJobs: Number of unique completed orders belonging to this artisan (order.artisanId === artisan.id)
 */
export function enrichArtisanWithDerivedMetrics(
  artisan: Artisan,
  orders: OrderItem[]
): Artisan {
  if (!artisan) return artisan;

  // 1. Derive rating and reviewCount from reviews array
  const reviews = artisan.reviews || [];
  const { rating, reviewCount } = calculateRatingSummary(reviews);

  // 2. Derive completedJobs count from completed orders list
  // Enforces:
  // - order.artisanId === artisan.id strictly
  // - order.status === "completed" strictly
  // - unique order IDs to avoid duplicate counting of the same order
  const uniqueCompletedOrderIds = new Set<string>();
  let completedJobsCount = 0;

  if (Array.isArray(orders)) {
    for (const order of orders) {
      if (
        order &&
        order.artisanId === artisan.id &&
        order.status === 'completed' &&
        order.id
      ) {
        if (!uniqueCompletedOrderIds.has(order.id)) {
          uniqueCompletedOrderIds.add(order.id);
          completedJobsCount++;
        }
      }
    }
  }

  return {
    ...artisan,
    rating,
    reviewCount,
    completedJobs: completedJobsCount,
  };
}

/**
 * Pure domain transformation: Updates the professional avatar of an artisan.
 * Enforces canonical ownership verification and non-empty valid avatar string.
 */
export function updateArtisanAvatar(
  artisan: Artisan,
  newAvatar: string,
  currentUser?: UserSession | null
): { success: boolean; updatedArtisan: Artisan; error?: string } {
  if (!currentUser || !isOwnArtisanProfile(artisan, currentUser)) {
    return {
      success: false,
      updatedArtisan: artisan,
      error: 'UNAUTHORIZED_OWNERSHIP',
    };
  }

  const cleanAvatar = newAvatar.trim();
  if (!cleanAvatar) {
    return {
      success: false,
      updatedArtisan: artisan,
      error: 'INVALID_AVATAR',
    };
  }

  return {
    success: true,
    updatedArtisan: {
      ...artisan,
      avatar: cleanAvatar,
    },
  };
}

/**
 * Pure domain transformation: Sanitizes artisan updates and strictly protects platform-controlled
 * and derived fields from being altered by client-side form submissions.
 * Platform-controlled fields protected:
 * - id (immutable)
 * - verified (strictly platform-controlled, user cannot grant verification to self)
 * - rating (derived from reviews)
 * - reviewCount (derived from reviews)
 * - completedJobs (derived from completed orders)
 * - reviews (modified only via review domain lifecycle)
 */
export function sanitizeArtisanProfileUpdate(
  existingArtisan: Artisan,
  updates: Partial<Artisan>
): Artisan {
  if (!existingArtisan) {
    throw new Error('EXISTING_ARTISAN_REQUIRED');
  }

  return {
    ...existingArtisan,
    ...updates,
    id: existingArtisan.id,
    verified: Boolean(existingArtisan.verified), // Platform-controlled ONLY
    rating: existingArtisan.rating,
    reviewCount: existingArtisan.reviewCount,
    completedJobs: existingArtisan.completedJobs,
    reviews: existingArtisan.reviews || [],
  };
}

/**
 * Pure domain selector: Resolves the active Artisan profile for the current user session
 * using strictly canonical identifiers (currentUser.artisanId or currentUser.id).
 * Never relies on artisan.name to prevent impersonation or cross-account data leakage.
 */
export function resolveCurrentArtisan(
  currentUser: UserSession | null | undefined,
  artisans: Artisan[]
): Artisan | null {
  if (!currentUser || currentUser.role !== 'artisan' || !Array.isArray(artisans)) {
    return null;
  }
  if (currentUser.artisanId) {
    const found = artisans.find(a => a.id === currentUser.artisanId);
    if (found) return found;
  }
  return artisans.find(a => a.id === currentUser.id) || null;
}
