/**
 * ============================================================================
 * BRICOJOBDZ — STAGE 7: REVIEWS TIED TO COMPLETED SERVICE TEST SUITE
 * ============================================================================
 * Tests enforcing that reviews are strictly tied to completed service orders.
 *
 * Requirements Enforced:
 * 1. Order.completed is the ONLY basis for review eligibility.
 * 2. Status Locks: assigned, in_progress, cancelled, legacy pending -> DENIED.
 * 3. Client Ownership: strictly order.clientId === actor.id (no name/email fallback).
 * 4. Target Artisan Integrity: order.artisanId === targetArtisan.id strictly.
 * 5. One Review Per Order: Order 1 -> Review 1; duplicate for Order 1 -> DENIED.
 * 6. Multiple Orders Same Artisan: Order 1 -> Review 1 (ALLOW), Order 2 -> Review 2 (ALLOW).
 * 7. Self-Review Prevention: Artisan cannot review their own completed order/profile.
 * 8. Rating Validation: 1 <= rating <= 5; 0, negative, >5, NaN, Infinity -> DENIED/INVALID.
 * 9. Idempotency: Duplicate submissions with same orderId do not create duplicate reviews.
 * 10. Legacy Reviews: Preserved and readable, but do not satisfy order review transactions.
 * ============================================================================
 */

import { describe, it, expect } from 'vitest';
import {
  canReviewCompletedOrder,
  canReviewArtisan,
  canEditReview,
  canDeleteReview,
  createReviewEntity,
  addReviewToArtisan,
  updateReviewInArtisan,
  deleteReviewFromArtisan,
  getReviewForOrder,
  hasOrderBeenReviewed,
  isValidRating,
  calculateRatingSummary,
} from '../domain';
import {
  UserSession,
  Artisan,
  OrderItem,
  Review,
  ServiceRequestStatus,
} from '../types';

/* ============================================================================
 * CANONICAL FIXTURES
 * ============================================================================ */
const USER_A: UserSession = {
  id: 'user-a',
  name: 'أحمد بن علي',
  email: 'ahmed.benali@example.com',
  phone: '0550111111',
  role: 'user',
  createdAt: '2026-01-01T00:00:00.000Z',
};

const USER_B: UserSession = {
  id: 'user-b',
  name: 'سليم عماري',
  email: 'salim.amari@example.com',
  phone: '0660222222',
  role: 'user',
  createdAt: '2026-01-01T00:00:00.000Z',
};

// Imposter Actors with matching Name or Email but different ID
const USER_IMPOSTER_SAME_NAME: UserSession = {
  id: 'user-imposter-name',
  name: 'أحمد بن علي', // Same name as USER_A
  email: 'imposter.name@example.com',
  role: 'user',
  createdAt: '2026-01-01T00:00:00.000Z',
};

const USER_IMPOSTER_SAME_EMAIL: UserSession = {
  id: 'user-imposter-email',
  name: 'مستخدم آخر',
  email: 'ahmed.benali@example.com', // Same email as USER_A
  role: 'user',
  createdAt: '2026-01-01T00:00:00.000Z',
};

const ARTISAN_ACTOR_A: UserSession = {
  id: 'user-artisan-a',
  name: 'كريم بلومبي',
  email: 'karim.plumber@artisan.com',
  role: 'artisan',
  artisanId: 'artisan-profile-a',
  createdAt: '2026-01-01T00:00:00.000Z',
};

const ARTISAN_ACTOR_B: UserSession = {
  id: 'user-artisan-b',
  name: 'مصطفى كهربائي',
  email: 'mustapha.elec@artisan.com',
  role: 'artisan',
  artisanId: 'artisan-profile-b',
  createdAt: '2026-01-01T00:00:00.000Z',
};

const ARTISAN_PROFILE_A: Artisan = {
  id: 'artisan-profile-a',
  name: 'كريم بلومبي',
  profession: 'سباك صحي',
  category: 'plumbing',
  wilaya: 'الجزائر',
  city: 'باب الوادي',
  phone: '0555123456',
  startingPrice: 1500,
  rating: 4.8,
  reviewCount: 1,
  avatar: 'https://images.unsplash.com/photo-avatar-a.jpg',
  verified: true,
  experienceYears: 8,
  bio: 'سباك صحي مؤهل وخبير في تصليح التسربات',
  services: ['تصليح تسربات', 'تركيب شبكات المياه'],
  portfolio: [],
  availableTimes: '8:00 - 18:00',
  availableNow: true,
  reviews: [],
};

const ARTISAN_PROFILE_B: Artisan = {
  id: 'artisan-profile-b',
  name: 'مصطفى كهربائي',
  profession: 'كهربائي منازل',
  category: 'electricity',
  wilaya: 'الجزائر',
  city: 'باب الوادي',
  phone: '0666123456',
  startingPrice: 2000,
  rating: 5.0,
  reviewCount: 0,
  avatar: 'https://images.unsplash.com/photo-avatar-b.jpg',
  verified: true,
  experienceYears: 12,
  bio: 'كهربائي معتمد',
  services: ['تركيب لوحات التوزيع'],
  portfolio: [],
  availableTimes: '8:00 - 20:00',
  availableNow: true,
  reviews: [],
};

// Canonical Order Fixtures
const ORDER_1_COMPLETED: OrderItem = {
  id: 'ord-1-comp',
  requestId: 'req-1',
  offerId: 'off-1',
  clientId: 'user-a',
  clientName: 'أحمد بن علي',
  clientPhone: '0550111111',
  artisanId: 'artisan-profile-a',
  artisanName: 'كريم بلومبي',
  artisanProfession: 'سباك صحي',
  serviceDetails: 'تصليح تسرب مياه تحت حوض المطبخ',
  proposedPrice: 1500,
  status: 'completed',
  createdAt: '2026-03-01T10:00:00.000Z',
};

const ORDER_2_COMPLETED: OrderItem = {
  id: 'ord-2-comp',
  requestId: 'req-2',
  offerId: 'off-2',
  clientId: 'user-a',
  clientName: 'أحمد بن علي',
  clientPhone: '0550111111',
  artisanId: 'artisan-profile-a', // Same artisan, second distinct order
  artisanName: 'كريم بلومبي',
  artisanProfession: 'سباك صحي',
  serviceDetails: 'تركيب صنبور مياه جديد',
  proposedPrice: 2000,
  status: 'completed',
  createdAt: '2026-03-05T10:00:00.000Z',
};

const ORDER_ASSIGNED: OrderItem = {
  ...ORDER_1_COMPLETED,
  id: 'ord-assigned',
  status: 'assigned',
};

const ORDER_IN_PROGRESS: OrderItem = {
  ...ORDER_1_COMPLETED,
  id: 'ord-in-progress',
  status: 'in_progress',
};

const ORDER_CANCELLED: OrderItem = {
  ...ORDER_1_COMPLETED,
  id: 'ord-cancelled',
  status: 'cancelled',
};

const LEGACY_REVIEW_NO_ORDER: Review = {
  id: 'rev-legacy-1',
  userId: 'user-a',
  userName: 'أحمد بن علي',
  rating: 5,
  comment: 'خدمة ممتازة تاريخية',
  date: '2025-12-01',
};

/* ============================================================================
 * TEST SUITES
 * ============================================================================ */

describe('STAGE 7: Reviews Tied to Completed Service', () => {

  describe('1. Review Eligibility & Order Status Locks', () => {
    it('ALLOWS review when order is strictly completed by the client for target artisan', () => {
      expect(canReviewCompletedOrder(USER_A, ORDER_1_COMPLETED, ARTISAN_PROFILE_A)).toBe(true);
    });

    it('DENIES review when order status is assigned', () => {
      expect(canReviewCompletedOrder(USER_A, ORDER_ASSIGNED, ARTISAN_PROFILE_A)).toBe(false);
    });

    it('DENIES review when order status is in_progress', () => {
      expect(canReviewCompletedOrder(USER_A, ORDER_IN_PROGRESS, ARTISAN_PROFILE_A)).toBe(false);
    });

    it('DENIES review when order status is cancelled', () => {
      expect(canReviewCompletedOrder(USER_A, ORDER_CANCELLED, ARTISAN_PROFILE_A)).toBe(false);
    });

    it('DENIES review for legacy or unknown order status', () => {
      const pendingOrder = { ...ORDER_1_COMPLETED, status: 'pending' as any };
      expect(canReviewCompletedOrder(USER_A, pendingOrder, ARTISAN_PROFILE_A)).toBe(false);
    });
  });

  describe('2. Canonical Ownership & Identity Isolation', () => {
    it('ALLOWS review for canonical order client (USER_A)', () => {
      expect(canReviewCompletedOrder(USER_A, ORDER_1_COMPLETED, ARTISAN_PROFILE_A)).toBe(true);
    });

    it('DENIES review for non-owner client (USER_B)', () => {
      expect(canReviewCompletedOrder(USER_B, ORDER_1_COMPLETED, ARTISAN_PROFILE_A)).toBe(false);
    });

    it('DENIES review for imposter with identical name but different ID', () => {
      expect(canReviewCompletedOrder(USER_IMPOSTER_SAME_NAME, ORDER_1_COMPLETED, ARTISAN_PROFILE_A)).toBe(false);
    });

    it('DENIES review for imposter with identical email but different ID', () => {
      expect(canReviewCompletedOrder(USER_IMPOSTER_SAME_EMAIL, ORDER_1_COMPLETED, ARTISAN_PROFILE_A)).toBe(false);
    });
  });

  describe('3. Target Artisan Integrity Guard', () => {
    it('ALLOWS review when order.artisanId matches targetArtisan.id strictly', () => {
      expect(canReviewCompletedOrder(USER_A, ORDER_1_COMPLETED, ARTISAN_PROFILE_A)).toBe(true);
    });

    it('DENIES review when order is for Artisan A but submitted against Artisan B profile', () => {
      expect(canReviewCompletedOrder(USER_A, ORDER_1_COMPLETED, ARTISAN_PROFILE_B)).toBe(false);
    });
  });

  describe('4. Self Review Prevention', () => {
    it('DENIES review when artisan tries to review their own profile/order', () => {
      expect(canReviewCompletedOrder(ARTISAN_ACTOR_A, ORDER_1_COMPLETED, ARTISAN_PROFILE_A)).toBe(false);
    });

    it('DENIES review even if artisan uses a customer session matching the artisan profile ID', () => {
      const dualRoleUser: UserSession = {
        ...USER_A,
        id: 'artisan-profile-a',
      };
      expect(canReviewCompletedOrder(dualRoleUser, ORDER_1_COMPLETED, ARTISAN_PROFILE_A)).toBe(false);
    });
  });

  describe('5. One Review Per Order & Multiple Orders Same Artisan', () => {
    it('DENIES duplicate review for the same orderId once already reviewed', () => {
      const review1 = createReviewEntity({
        orderId: ORDER_1_COMPLETED.id,
        userId: USER_A.id,
        userName: USER_A.name,
        rating: 5,
        comment: 'ممتاز جزيتم خيرا',
      });
      const artisanWithReview1 = addReviewToArtisan(ARTISAN_PROFILE_A, review1);

      // Order 1 is now reviewed
      expect(canReviewCompletedOrder(USER_A, ORDER_1_COMPLETED, artisanWithReview1)).toBe(false);
      expect(hasOrderBeenReviewed(artisanWithReview1, ORDER_1_COMPLETED.id)).toBe(true);
    });

    it('ALLOWS separate reviews for two distinct completed orders with the same artisan', () => {
      const review1 = createReviewEntity({
        orderId: ORDER_1_COMPLETED.id,
        userId: USER_A.id,
        userName: USER_A.name,
        rating: 5,
        comment: 'ممتاز للخدمة الأولى',
      });
      const artisanWithReview1 = addReviewToArtisan(ARTISAN_PROFILE_A, review1);

      // Order 1 is reviewed, but Order 2 is NOT reviewed yet!
      expect(canReviewCompletedOrder(USER_A, ORDER_1_COMPLETED, artisanWithReview1)).toBe(false);
      expect(canReviewCompletedOrder(USER_A, ORDER_2_COMPLETED, artisanWithReview1)).toBe(true);

      // Submit Review for Order 2
      const review2 = createReviewEntity({
        orderId: ORDER_2_COMPLETED.id,
        userId: USER_A.id,
        userName: USER_A.name,
        rating: 4,
        comment: 'جيد جداً للخدمة الثانية',
      });
      const artisanWithBothReviews = addReviewToArtisan(artisanWithReview1, review2);

      // Now both Order 1 and Order 2 are reviewed!
      expect(canReviewCompletedOrder(USER_A, ORDER_1_COMPLETED, artisanWithBothReviews)).toBe(false);
      expect(canReviewCompletedOrder(USER_A, ORDER_2_COMPLETED, artisanWithBothReviews)).toBe(false);
      expect(artisanWithBothReviews.reviews.length).toBe(2);
    });
  });

  describe('6. Legacy Reviews Backward Compatibility', () => {
    it('preserves legacy reviews without orderId in artisan profile', () => {
      const artisanWithLegacy = {
        ...ARTISAN_PROFILE_A,
        reviews: [LEGACY_REVIEW_NO_ORDER],
      };
      expect(getReviewForOrder(artisanWithLegacy, 'ord-1-comp')).toBeNull();
      expect(artisanWithLegacy.reviews.length).toBe(1);
      expect(artisanWithLegacy.reviews[0].id).toBe(LEGACY_REVIEW_NO_ORDER.id);
    });

    it('legacy review does NOT block reviewing a new completed order', () => {
      const artisanWithLegacy = {
        ...ARTISAN_PROFILE_A,
        reviews: [LEGACY_REVIEW_NO_ORDER],
      };
      expect(canReviewCompletedOrder(USER_A, ORDER_1_COMPLETED, artisanWithLegacy)).toBe(true);
    });
  });

  describe('7. Rating Validation Rules', () => {
    it('validates 1 <= rating <= 5 as valid ratings', () => {
      expect(isValidRating(1)).toBe(true);
      expect(isValidRating(3)).toBe(true);
      expect(isValidRating(5)).toBe(true);
    });

    it('rejects invalid ratings: 0, negative, >5, NaN, Infinity, strings, null, undefined', () => {
      expect(isValidRating(0)).toBe(false);
      expect(isValidRating(-1)).toBe(false);
      expect(isValidRating(6)).toBe(false);
      expect(isValidRating(NaN)).toBe(false);
      expect(isValidRating(Infinity)).toBe(false);
      expect(isValidRating('5' as any)).toBe(false);
      expect(isValidRating(null)).toBe(false);
      expect(isValidRating(undefined)).toBe(false);
    });

    it('createReviewEntity clamps ratings strictly into 1..5 range', () => {
      const revClampedHigh = createReviewEntity({
        userId: USER_A.id,
        userName: USER_A.name,
        rating: 10,
        comment: 'تقييم ممتاز',
      });
      expect(revClampedHigh.rating).toBe(5);

      const revClampedLow = createReviewEntity({
        userId: USER_A.id,
        userName: USER_A.name,
        rating: -5,
        comment: 'تقييم سيء',
      });
      expect(revClampedLow.rating).toBe(1);
    });
  });

  describe('8. Idempotency & Mutation Protection', () => {
    it('addReviewToArtisan is idempotent when adding a review with existing orderId', () => {
      const review1 = createReviewEntity({
        orderId: 'ord-idempotency-1',
        userId: USER_A.id,
        userName: USER_A.name,
        rating: 5,
        comment: 'المرة الأولى',
      });

      const step1 = addReviewToArtisan(ARTISAN_PROFILE_A, review1);
      expect(step1.reviews.length).toBe(1);

      // Submit identical review with same orderId
      const step2 = addReviewToArtisan(step1, review1);
      expect(step2.reviews.length).toBe(1); // Length did NOT increase!
    });
  });

  describe('9. Review Edit & Delete Authorization', () => {
    const REVIEW_A: Review = {
      id: 'rev-a',
      orderId: 'ord-1-comp',
      userId: USER_A.id,
      userName: USER_A.name,
      rating: 5,
      comment: 'تقييم العميل أ',
      date: 'اليوم',
    };

    it('canEditReview & canDeleteReview ALLOW author user (USER_A)', () => {
      expect(canEditReview(USER_A, REVIEW_A)).toBe(true);
      expect(canDeleteReview(USER_A, REVIEW_A)).toBe(true);
    });

    it('canEditReview & canDeleteReview DENY non-author user (USER_B)', () => {
      expect(canEditReview(USER_B, REVIEW_A)).toBe(false);
      expect(canDeleteReview(USER_B, REVIEW_A)).toBe(false);
    });

    it('updateReviewInArtisan modifies ONLY when userId matches author strictly', () => {
      const artisanWithReview = {
        ...ARTISAN_PROFILE_A,
        reviews: [REVIEW_A],
      };

      // Imposter attempts update
      const resultImposter = updateReviewInArtisan(artisanWithReview, REVIEW_A.id, {
        rating: 1,
        comment: 'تخريب',
        userId: USER_B.id,
      });
      expect(resultImposter.reviews[0].comment).toBe('تقييم العميل أ'); // Unchanged!

      // Author performs update
      const resultAuthor = updateReviewInArtisan(artisanWithReview, REVIEW_A.id, {
        rating: 4,
        comment: 'تعديل التقييم',
        userId: USER_A.id,
      });
      expect(resultAuthor.reviews[0].comment).toBe('تعديل التقييم');
      expect(resultAuthor.reviews[0].rating).toBe(4);
    });

    it('deleteReviewFromArtisan removes ONLY when userId matches author strictly', () => {
      const artisanWithReview = {
        ...ARTISAN_PROFILE_A,
        reviews: [REVIEW_A],
      };

      // Imposter attempts delete
      const resultImposter = deleteReviewFromArtisan(artisanWithReview, REVIEW_A.id, USER_B.id);
      expect(resultImposter.reviews.length).toBe(1); // Unchanged!

      // Author performs delete
      const resultAuthor = deleteReviewFromArtisan(artisanWithReview, REVIEW_A.id, USER_A.id);
      expect(resultAuthor.reviews.length).toBe(0);
    });
  });

  describe('10. Authorization Matrix Table', () => {
    const testCases = [
      // { actor, orderState, action, expected }
      { actor: null, state: 'completed', action: 'CREATE REVIEW', expected: false },
      { actor: USER_A, state: 'assigned', action: 'CREATE REVIEW', expected: false },
      { actor: USER_A, state: 'in_progress', action: 'CREATE REVIEW', expected: false },
      { actor: USER_A, state: 'cancelled', action: 'CREATE REVIEW', expected: false },
      { actor: USER_A, state: 'completed', action: 'CREATE REVIEW', expected: true },
      { actor: USER_B, state: 'completed', action: 'CREATE REVIEW', expected: false },
      { actor: ARTISAN_ACTOR_A, state: 'completed', action: 'CREATE REVIEW', expected: false },
    ];

    testCases.forEach(({ actor, state, action, expected }) => {
      it(`${action} for ${actor ? actor.id : 'Guest'} on order status [${state}] -> ${expected ? 'ALLOW' : 'DENY'}`, () => {
        const testOrder: OrderItem = {
          ...ORDER_1_COMPLETED,
          status: state as any,
        };
        const res = canReviewCompletedOrder(actor, testOrder, ARTISAN_PROFILE_A);
        expect(res).toBe(expected);
      });
    });
  });

});
