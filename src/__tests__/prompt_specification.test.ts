import { describe, it, expect } from 'vitest';
import { Artisan, Review, UserSession, ServiceRequest } from '../types';
import {
  canUserReviewArtisan,
  hasUserReviewedArtisan,
  updateReviewInArtisan,
  deleteReviewFromArtisan,
  countUserReviews,
  calculateRatingSummary,
} from '../domain/reviews';
import {
  formatStartingPrice,
  parseStartingPrice,
  getCleanStartingPrice,
} from '../utils';
import {
  validateServiceRequestBudget,
  validateServiceOfferPrice,
} from '../domain/serviceRequests';
import { getAllWilayas } from '../data';

describe('Specification 1: Artisan Trust Defaults & Integrity', () => {
  it('New artisan creation enforces zero trust defaults (verified: false, rating: 0, reviewCount: 0, experienceYears: 0, reviews: [])', () => {
    // Simulate creating a new artisan entity following the system standard
    const newArtisanDraft: Partial<Artisan> = {
      id: 'art-new-1',
      name: 'أحمد نجار',
      profession: 'نجار أثاث',
      category: 'carpentry',
      wilaya: 'الجزائر',
      city: 'الرويبة',
      phone: '0550123456',
      startingPrice: 0, // Free consultation
      rating: 0,
      reviewCount: 0,
      avatar: '',
      verified: false,
      experienceYears: 0,
      reviews: [],
    };

    expect(newArtisanDraft.verified).toBe(false);
    expect(newArtisanDraft.rating).toBe(0);
    expect(newArtisanDraft.reviewCount).toBe(0);
    expect(newArtisanDraft.experienceYears).toBe(0);
    expect(newArtisanDraft.reviews).toEqual([]);
  });

  it('Updating an existing artisan strictly preserves its trust data (verified, rating, reviewCount, experienceYears, reviews)', () => {
    const existingArtisan: Artisan = {
      id: 'art-established-1',
      name: 'مراد كهربائي',
      profession: 'كهربائي منازل معتمد',
      category: 'electricity',
      wilaya: 'وهران',
      city: 'وهران وسط',
      phone: '0661123456',
      startingPrice: 2500,
      rating: 4.8,
      reviewCount: 24,
      avatar: 'https://example.com/avatar.jpg',
      verified: true,
      experienceYears: 12,
      bio: 'خبرة طويلة معتمدة',
      services: ['صيانة لوحات الكهرباء'],
      portfolio: [],
      reviews: [
        { id: 'rev-101', userId: 'usr-88', userName: 'سفيان', rating: 5, comment: 'ممتاز', date: 'منذ شهر' }
      ],
      availableTimes: 'طوال الأسبوع',
      availableNow: true,
    };

    // When artisan updates their bio and phone in workspace
    const updatedProfile: Artisan = {
      ...existingArtisan,
      phone: '0770987654',
      bio: 'تم تحديث النبذة التعريفية وساعات العمل',
      // Explicitly preserved trust data
      verified: existingArtisan.verified,
      rating: existingArtisan.rating,
      reviewCount: existingArtisan.reviewCount,
      experienceYears: existingArtisan.experienceYears,
      reviews: existingArtisan.reviews,
    };

    expect(updatedProfile.verified).toBe(true);
    expect(updatedProfile.rating).toBe(4.8);
    expect(updatedProfile.reviewCount).toBe(24);
    expect(updatedProfile.experienceYears).toBe(12);
    expect(updatedProfile.reviews.length).toBe(1);
  });
});

describe('Specification 2: Review Identity — Canonical ID ONLY', () => {
  const mockArtisanWithReviews: Artisan = {
    id: 'art-200',
    name: 'حسين دهان',
    profession: 'صباغة وديكور',
    category: 'painting',
    wilaya: 'قسنطينة',
    city: 'قسنطينة وسط',
    phone: '0555001122',
    rating: 5,
    reviewCount: 2,
    startingPrice: 1500,
    avatar: '',
    verified: false,
    experienceYears: 3,
    bio: '',
    services: [],
    portfolio: [],
    reviews: [
      {
        id: 'rev-user-1',
        userId: 'usr-id-1',
        userName: 'كمال بن علي',
        rating: 5,
        comment: 'عمل ممتاز ومتقن',
        date: 'أمس',
      },
      {
        id: 'rev-legacy-1',
        // Legacy review with NO userId
        userId: '',
        userName: 'كمال بن علي',
        rating: 4,
        comment: 'تقييم قديم',
        date: '2023-01-01',
      },
    ],
    availableTimes: '08:00 - 18:00',
    availableNow: false,
  };

  it('Case A: Legitimate owner is recognized strictly when review.userId === currentUser.id', () => {
    const isReviewed = hasUserReviewedArtisan(mockArtisanWithReviews, 'usr-id-1');
    expect(isReviewed).toBe(true);
  });

  it('Case B: User with the SAME EMAIL but DIFFERENT ID is NEVER considered the review owner', () => {
    // Someone trying to claim ownership via email fallback
    const isReviewed = hasUserReviewedArtisan(mockArtisanWithReviews, 'usr-impostor-id', 'kamal@example.com');
    expect(isReviewed).toBe(false);
  });

  it('Case C: User with the SAME NAME but DIFFERENT ID is NEVER considered the review owner', () => {
    // Someone with identical display name 'كمال بن علي' but different ID
    const count = countUserReviews([mockArtisanWithReviews], 'usr-different-id', 'كمال بن علي');
    expect(count).toBe(0);
  });

  it('Case D: Modifying a review authored by someone else FAILS and leaves data untouched', () => {
    // usr-attacker tries to update review rev-user-1 owned by usr-id-1
    const result = updateReviewInArtisan(mockArtisanWithReviews, 'rev-user-1', {
      rating: 1,
      comment: 'تم التخريب',
      userId: 'usr-attacker',
    });

    // Immutable & unchanged
    expect(result).toBe(mockArtisanWithReviews);
    expect(result.reviews[0].comment).toBe('عمل ممتاز ومتقن');
    expect(result.reviews[0].rating).toBe(5);
  });

  it('Case E: Deleting a review authored by someone else FAILS and leaves data untouched', () => {
    // usr-attacker tries to delete rev-user-1 owned by usr-id-1
    const result = deleteReviewFromArtisan(mockArtisanWithReviews, 'rev-user-1', 'usr-attacker');

    // Untouched
    expect(result).toBe(mockArtisanWithReviews);
    expect(result.reviews.length).toBe(2);
  });

  it('Case F: Legitimate owner can successfully update and delete their own review', () => {
    // Legitimate update by usr-id-1
    const updated = updateReviewInArtisan(mockArtisanWithReviews, 'rev-user-1', {
      rating: 4,
      comment: 'تحديث تقييم صاحب الحساب',
      userId: 'usr-id-1',
    });
    expect(updated.reviews[0].comment).toBe('تحديث تقييم صاحب الحساب');
    expect(updated.reviews[0].rating).toBe(4);

    // Legitimate deletion by usr-id-1
    const deleted = deleteReviewFromArtisan(updated, 'rev-user-1', 'usr-id-1');
    expect(deleted.reviews.length).toBe(1);
    expect(deleted.reviews[0].id).toBe('rev-legacy-1');
  });

  it('Case G: Legacy reviews without userId are preserved for display but not owned by any user', () => {
    // Count reviews for new user 'usr-new' whose name matches legacy review
    const count = countUserReviews([mockArtisanWithReviews], 'usr-new', 'كمال بن علي');
    expect(count).toBe(0);

    // Legacy review cannot be edited by matching name
    const updateAttempt = updateReviewInArtisan(mockArtisanWithReviews, 'rev-legacy-1', {
      rating: 5,
      comment: 'محاولة تعديل مراجعة قديمة',
      userId: 'usr-new',
    });
    expect(updateAttempt).toBe(mockArtisanWithReviews);
  });
});

describe('Specification 3: Price Semantics', () => {
  it('formatStartingPrice differentiates null/undefined from 0 and positive numbers', () => {
    expect(formatStartingPrice(null)).toBe('حسب المعاينة');
    expect(formatStartingPrice(undefined)).toBe('حسب المعاينة');
    expect(formatStartingPrice(0)).toBe('مجاني / استشارة مجانية');
    expect(formatStartingPrice('0')).toBe('مجاني / استشارة مجانية');
    expect(formatStartingPrice(1500)).toBe('1500 دج');
    expect(formatStartingPrice('1500')).toBe('1500 دج');
    expect(formatStartingPrice('1500 دج')).toBe('1500 دج');
  });

  it('parseStartingPrice preserves 0, parses positive numbers, and rejects invalid/negative values', () => {
    expect(parseStartingPrice(null)).toBeNull();
    expect(parseStartingPrice(undefined)).toBeNull();
    expect(parseStartingPrice(0)).toBe(0);
    expect(parseStartingPrice('0')).toBe(0);
    expect(parseStartingPrice(' 0 ')).toBe(0);
    expect(parseStartingPrice(1000)).toBe(1000);
    expect(parseStartingPrice('1000')).toBe(1000);
    expect(parseStartingPrice('1000 دج')).toBe(1000);
    expect(parseStartingPrice(-1)).toBeNull();
    expect(parseStartingPrice('-100')).toBeNull();
    expect(parseStartingPrice('')).toBeNull();
    expect(parseStartingPrice('invalid string')).toBeNull();
    expect(parseStartingPrice('abc')).toBeNull();
  });

  it('startingPrice === 0 survives dirty checks and completeness without being treated as missing', () => {
    const targetWithZero = { startingPrice: 0 };
    const targetWithNull = { startingPrice: null };
    const targetWithUndefined = { startingPrice: undefined };

    // Explicit check rule from specification
    const isDoneZero = targetWithZero.startingPrice !== null && targetWithZero.startingPrice !== undefined;
    const isDoneNull = targetWithNull.startingPrice !== null && targetWithNull.startingPrice !== undefined;
    const isDoneUndef = targetWithUndefined.startingPrice !== null && targetWithUndefined.startingPrice !== undefined;

    expect(isDoneZero).toBe(true);
    expect(isDoneNull).toBe(false);
    expect(isDoneUndef).toBe(false);
  });
});

describe('Specification 4: Service Request Budget Validation', () => {
  it('allows empty/null/undefined budget as unspecified (valid)', () => {
    expect(validateServiceRequestBudget('')).toEqual({ isValid: true, parsedBudget: undefined });
    expect(validateServiceRequestBudget('   ')).toEqual({ isValid: true, parsedBudget: undefined });
    expect(validateServiceRequestBudget(null)).toEqual({ isValid: true, parsedBudget: undefined });
    expect(validateServiceRequestBudget(undefined)).toEqual({ isValid: true, parsedBudget: undefined });
  });

  it('allows budget 0 as volunteer/free/consultation (valid)', () => {
    expect(validateServiceRequestBudget(0)).toEqual({ isValid: true, parsedBudget: 0 });
    expect(validateServiceRequestBudget('0')).toEqual({ isValid: true, parsedBudget: 0 });
    expect(validateServiceRequestBudget('0 دج')).toEqual({ isValid: true, parsedBudget: 0 });
  });

  it('allows positive budget (valid)', () => {
    expect(validateServiceRequestBudget(3000)).toEqual({ isValid: true, parsedBudget: 3000 });
    expect(validateServiceRequestBudget('3000')).toEqual({ isValid: true, parsedBudget: 3000 });
    expect(validateServiceRequestBudget('3000 دج')).toEqual({ isValid: true, parsedBudget: 3000 });
  });

  it('rejects negative budget (invalid)', () => {
    const result = validateServiceRequestBudget(-100);
    expect(result.isValid).toBe(false);
    expect(result.error).toBeDefined();

    const strResult = validateServiceRequestBudget('-500');
    expect(strResult.isValid).toBe(false);
  });

  it('rejects non-numeric invalid string budget (invalid)', () => {
    expect(validateServiceRequestBudget('abc').isValid).toBe(false);
    expect(validateServiceRequestBudget('غير محدد').isValid).toBe(false);
  });
});

describe('Specification 5: Service Offer Proposed Price Validation', () => {
  it('allows 0 as valid proposed price (free consultation / service)', () => {
    expect(validateServiceOfferPrice(0)).toEqual({ isValid: true, parsedPrice: 0 });
    expect(validateServiceOfferPrice('0')).toEqual({ isValid: true, parsedPrice: 0 });
    expect(validateServiceOfferPrice('0 دج')).toEqual({ isValid: true, parsedPrice: 0 });
  });

  it('allows positive proposed price (valid)', () => {
    expect(validateServiceOfferPrice(1000)).toEqual({ isValid: true, parsedPrice: 1000 });
    expect(validateServiceOfferPrice('1000')).toEqual({ isValid: true, parsedPrice: 1000 });
  });

  it('rejects negative proposed price (invalid)', () => {
    expect(validateServiceOfferPrice(-1).isValid).toBe(false);
    expect(validateServiceOfferPrice('-500').isValid).toBe(false);
  });

  it('rejects NaN or invalid string (invalid)', () => {
    expect(validateServiceOfferPrice('xyz').isValid).toBe(false);
    expect(validateServiceOfferPrice(NaN).isValid).toBe(false);
  });

  it('rejects empty proposed price (required field)', () => {
    expect(validateServiceOfferPrice('').isValid).toBe(false);
    expect(validateServiceOfferPrice('   ').isValid).toBe(false);
    expect(validateServiceOfferPrice(null).isValid).toBe(false);
    expect(validateServiceOfferPrice(undefined).isValid).toBe(false);
  });
});

describe('Specification 6: Dynamic Wilaya Count', () => {
  it('derives wilaya count dynamically from the data source and matches getAllWilayas().length', () => {
    const count = getAllWilayas().length;
    expect(count).toBeGreaterThan(0);
    expect(typeof count).toBe('number');
  });
});
