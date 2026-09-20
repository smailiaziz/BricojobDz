import { Review, Artisan, UserSession, OrderItem } from '../types';
import { isOwnArtisanProfile } from './favorites';

/**
 * Validates whether a rating value is valid (number between 1 and 5 inclusive, non-NaN, finite).
 */
export function isValidRating(rating: unknown): rating is number {
  return (
    typeof rating === 'number' &&
    Number.isFinite(rating) &&
    rating >= 1 &&
    rating <= 5
  );
}

/**
 * Retrieves the review entity linked to a specific completed order from an artisan's reviews list.
 */
export function getReviewForOrder(
  artisan: Artisan | null | undefined,
  orderId: string | null | undefined
): Review | null {
  if (!artisan || !artisan.reviews || !orderId) return null;
  return artisan.reviews.find(r => r.orderId === orderId) || null;
}

/**
 * Checks whether a specific completed order has already been reviewed.
 */
export function hasOrderBeenReviewed(
  artisan: Artisan | null | undefined,
  orderId: string | null | undefined
): boolean {
  return Boolean(getReviewForOrder(artisan, orderId));
}

/**
 * Pure predicate: Checks whether a user is allowed to review a given artisan.
 * Enforces:
 * 1. Must be an authenticated user.
 * 2. Self-Rating Prevention: Artisan cannot review their own profile.
 * 3. Requires at least one completed order eligible for review if userOrders provided.
 * 4. Backward compatibility: if userOrders omitted, check hasUserReviewedArtisan.
 */
export function canUserReviewArtisan(
  artisan: Artisan | null | undefined,
  currentUser?: UserSession | null,
  userOrders?: OrderItem[]
): boolean {
  if (!artisan || !currentUser) return false;
  if (isOwnArtisanProfile(artisan, currentUser)) return false;
  if (userOrders && Array.isArray(userOrders)) {
    // If user orders are provided, check if there is an unreviewed completed order
    const eligibleOrders = userOrders.filter(
      o => o.status === 'completed' && o.clientId === currentUser.id && o.artisanId === artisan.id && !hasOrderBeenReviewed(artisan, o.id)
    );
    return eligibleOrders.length > 0;
  }
  if (hasUserReviewedArtisan(artisan, currentUser.id)) return false;
  return true;
}

/**
 * Calculates the average rating and total count from an array of reviews.
 * Returns rating rounded to 1 decimal place. Only includes valid ratings 1..5.
 */
export function calculateRatingSummary(reviews: Review[]): { rating: number; reviewCount: number } {
  if (!reviews || reviews.length === 0) {
    return { rating: 0, reviewCount: 0 };
  }

  const validReviews = reviews.filter(r => isValidRating(r.rating));
  if (validReviews.length === 0) {
    return { rating: 0, reviewCount: 0 };
  }

  const totalSum = validReviews.reduce((sum, r) => sum + r.rating, 0);
  const count = validReviews.length;
  const average = Math.round((totalSum / count) * 10) / 10;

  return {
    rating: average,
    reviewCount: count,
  };
}

/**
 * Pure predicate to check if a user has already submitted a review for a specific artisan.
 * Canonical review identity: strictly matches review.userId === userId.
 * Never uses email, name, phone, or display name fallbacks.
 */
export function hasUserReviewedArtisan(
  artisan: Artisan,
  userId: string,
  _userEmail?: string
): boolean {
  if (!artisan || !artisan.reviews || !userId) return false;
  return artisan.reviews.some(
    r => r.userId === userId
  );
}

/**
 * Creates a new Review domain entity with a generated ID and formatted timestamp.
 */
export function createReviewEntity(params: {
  userId: string;
  userName: string;
  userAvatar?: string;
  rating: number;
  comment: string;
  date?: string;
  orderId?: string;
}): Review {
  const numericRating = typeof params.rating === 'number' && !isNaN(params.rating) ? params.rating : 5;
  const validRating = Math.min(5, Math.max(1, numericRating));

  return {
    id: `rev-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    orderId: params.orderId,
    userId: params.userId,
    userName: params.userName,
    userAvatar: params.userAvatar,
    rating: validRating,
    comment: (params.comment || '').trim(),
    date: params.date || 'اليوم',
  };
}

/**
 * Pure transformation: Adds a new review to an artisan and recalculates rating summary.
 * Returns a new Artisan object without mutating the original.
 * Idempotent: If a review with the same orderId already exists, returns artisan unchanged.
 */
export function addReviewToArtisan(artisan: Artisan, newReview: Review): Artisan {
  const currentReviews = artisan.reviews || [];

  // Idempotency / Duplicate protection by orderId
  if (newReview.orderId && currentReviews.some(r => r.orderId === newReview.orderId)) {
    return artisan;
  }

  const updatedReviews = [newReview, ...currentReviews];
  const { rating, reviewCount } = calculateRatingSummary(updatedReviews);

  return {
    ...artisan,
    rating,
    reviewCount,
    reviews: updatedReviews,
  };
}

/**
 * Pure transformation: Updates an existing review on an artisan and recalculates rating summary.
 * Canonical review ownership enforcement:
 * Updates ONLY when review.id === reviewId AND review.userId === updates.userId.
 * If reviewId is correct but userId does not match, NO modification occurs.
 * Never uses email or name fallback.
 */
export function updateReviewInArtisan(
  artisan: Artisan,
  reviewId: string,
  updates: { rating: number; comment: string; userId: string; userEmail?: string }
): Artisan {
  const currentReviews = artisan.reviews || [];
  let isModified = false;

  const updatedReviews = currentReviews.map(r => {
    const isTarget = r.id === reviewId && r.userId === updates.userId;
    if (isTarget) {
      isModified = true;
      return {
        ...r,
        rating: Math.min(5, Math.max(1, updates.rating)),
        comment: updates.comment.trim(),
        date: 'معدّل اليوم',
      };
    }
    return r;
  });

  if (!isModified) {
    return artisan;
  }

  const { rating, reviewCount } = calculateRatingSummary(updatedReviews);

  return {
    ...artisan,
    rating,
    reviewCount,
    reviews: updatedReviews,
  };
}

/**
 * Pure transformation: Deletes a review from an artisan and recalculates rating summary.
 * Canonical review ownership enforcement:
 * Deletes ONLY when review.id === reviewId AND review.userId === userId.
 * Another user cannot delete a review they do not own.
 * Never uses email or name fallback.
 */
export function deleteReviewFromArtisan(
  artisan: Artisan,
  reviewId: string,
  userId: string,
  _userEmail?: string
): Artisan {
  const currentReviews = artisan.reviews || [];
  const targetReview = currentReviews.find(r => r.id === reviewId && r.userId === userId);
  if (!targetReview) {
    return artisan;
  }

  const updatedReviews = currentReviews.filter(
    r => !(r.id === reviewId && r.userId === userId)
  );

  const { rating, reviewCount } = calculateRatingSummary(updatedReviews);

  return {
    ...artisan,
    rating,
    reviewCount,
    reviews: updatedReviews,
  };
}

/**
 * Pure selector: Counts total reviews authored by a specific user across an array of artisans.
 * Relies strictly on review.userId === userId. Never matches legacy reviews via name or email.
 */
export function countUserReviews(
  artisans: Artisan[],
  userId: string,
  _userName?: string
): number {
  if (!artisans || !Array.isArray(artisans) || !userId) return 0;
  let count = 0;
  for (const art of artisans) {
    if (Array.isArray(art.reviews)) {
      for (const r of art.reviews) {
        if (r.userId === userId) {
          count++;
        }
      }
    }
  }
  return count;
}

