import { describe, it, expect } from 'vitest';
import { Artisan, OrderItem, Review } from '../types';
import { enrichArtisanWithDerivedMetrics, sanitizeArtisanProfileUpdate } from '../domain/artisan';
import { isValidOrderPrice } from '../domain/orders';
import { validateServiceRequestBudget, validateServiceOfferPrice } from '../domain/serviceRequests';
import { validateExperienceYears, clampExperienceYears } from '../utils';

describe('Stage 8 - Reputation Integrity and Trust Matrix', () => {
  const baseArtisan: Artisan = {
    id: 'artisan-test-1',
    name: 'أحمد الجزائري',
    profession: 'سباك محترف',
    category: 'plumbing',
    wilaya: 'الجزائر',
    city: 'باب الزوار',
    phone: '0550123456',
    startingPrice: 1500,
    rating: 0,
    reviewCount: 0,
    completedJobs: 0,
    avatar: 'avatar.jpg',
    verified: true, // Initially verified by platform
    experienceYears: 10,
    bio: 'نبذة تعريفية',
    services: ['تسليك الأنابيب'],
    portfolio: [],
    reviews: [],
    availableTimes: 'طوال الأسبوع',
    availableNow: true,
  };

  describe('enrichArtisanWithDerivedMetrics', () => {
    it('should derive completedJobs from orders correctly', () => {
      const orders: OrderItem[] = [
        {
          id: 'order-1',
          artisanId: 'artisan-test-1',
          artisanName: 'أحمد الجزائري',
          clientId: 'client-1',
          clientName: 'جمال',
          clientPhone: '0661111111',
          status: 'completed', // Completed
          createdAt: '2026-09-01T10:00:00Z',
        },
        {
          id: 'order-2',
          artisanId: 'artisan-test-1',
          artisanName: 'أحمد الجزائري',
          clientId: 'client-1',
          clientName: 'جمال',
          clientPhone: '0661111111',
          status: 'in_progress', // Not completed yet
          createdAt: '2026-09-02T10:00:00Z',
        },
        {
          id: 'order-3',
          artisanId: 'artisan-test-1',
          artisanName: 'أحمد الجزائري',
          clientId: 'client-2',
          clientName: 'كريم',
          clientPhone: '0661222222',
          status: 'completed', // Completed
          createdAt: '2026-09-03T10:00:00Z',
        },
        {
          id: 'order-4',
          artisanId: 'another-artisan', // Different artisan
          artisanName: 'آخر',
          clientId: 'client-1',
          clientName: 'جمال',
          clientPhone: '0661111111',
          status: 'completed',
          createdAt: '2026-09-04T10:00:00Z',
        }
      ];

      const enriched = enrichArtisanWithDerivedMetrics(baseArtisan, orders);
      expect(enriched.completedJobs).toBe(2);
    });

    it('should derive rating and reviewCount from artisan reviews', () => {
      const artisanWithReviews: Artisan = {
        ...baseArtisan,
        reviews: [
          {
            id: 'rev-1',
            userId: 'user-1',
            userName: 'علي',
            rating: 5,
            comment: 'ممتاز جداً',
            date: '2026-09-01',
          },
          {
            id: 'rev-2',
            userId: 'user-2',
            userName: 'سارة',
            rating: 4,
            comment: 'عمل جيد وسريع',
            date: '2026-09-02',
          }
        ],
      };

      const enriched = enrichArtisanWithDerivedMetrics(artisanWithReviews, []);
      expect(enriched.reviewCount).toBe(2);
      expect(enriched.rating).toBe(4.5);
    });

    it('should fall back to 0 if no reviews exist', () => {
      const enriched = enrichArtisanWithDerivedMetrics(baseArtisan, []);
      expect(enriched.reviewCount).toBe(0);
      expect(enriched.rating).toBe(0);
      expect(enriched.completedJobs).toBe(0);
    });
  });

  describe('sanitizeArtisanProfileUpdate', () => {
    it('strictly preserves platform-controlled verified status and prevents self-escalation', () => {
      const unverifiedArtisan: Artisan = {
        ...baseArtisan,
        id: 'art-unverified',
        verified: false,
      };

      // Attacker tries to set verified: true via client update payload
      const maliciousUpdate = sanitizeArtisanProfileUpdate(unverifiedArtisan, {
        name: 'اسم معدل',
        verified: true as any,
        id: 'different-id',
        rating: 5.0,
        reviewCount: 999,
        completedJobs: 500,
      });

      expect(maliciousUpdate.verified).toBe(false);
      expect(maliciousUpdate.id).toBe('art-unverified');
      expect(maliciousUpdate.rating).toBe(0);
      expect(maliciousUpdate.reviewCount).toBe(0);
      expect(maliciousUpdate.completedJobs).toBe(0);
      expect(maliciousUpdate.name).toBe('اسم معدل');
    });

    it('preserves verified status if already verified by platform', () => {
      const verifiedArtisan: Artisan = {
        ...baseArtisan,
        verified: true,
      };

      const update = sanitizeArtisanProfileUpdate(verifiedArtisan, {
        profession: 'كهربائي محترف',
      });

      expect(update.verified).toBe(true);
      expect(update.profession).toBe('كهربائي محترف');
    });
  });

  describe('Unified Numeric Validation - Price & Budget Consistency', () => {
    it('isValidOrderPrice permits 0 and positive numbers, rejects negative, NaN, and Infinity', () => {
      expect(isValidOrderPrice(0)).toBe(true);
      expect(isValidOrderPrice(1500)).toBe(true);
      expect(isValidOrderPrice(-500)).toBe(false);
      expect(isValidOrderPrice(NaN)).toBe(false);
      expect(isValidOrderPrice(Infinity)).toBe(false);
      expect(isValidOrderPrice(-Infinity)).toBe(false);
      expect(isValidOrderPrice('1500')).toBe(false);
      expect(isValidOrderPrice(null)).toBe(false);
      expect(isValidOrderPrice(undefined)).toBe(false);
    });

    it('validateServiceRequestBudget validates numbers, strings with Arabic digits, and 0', () => {
      expect(validateServiceRequestBudget(0).isValid).toBe(true);
      expect(validateServiceRequestBudget(0).parsedBudget).toBe(0);
      expect(validateServiceRequestBudget(2500).isValid).toBe(true);
      expect(validateServiceRequestBudget(2500).parsedBudget).toBe(2500);
      expect(validateServiceRequestBudget('٢٥٠٠ دج').isValid).toBe(true);
      expect(validateServiceRequestBudget('٢٥٠٠ دج').parsedBudget).toBe(2500);

      // Unspecified is valid
      expect(validateServiceRequestBudget('').isValid).toBe(true);
      expect(validateServiceRequestBudget(undefined).isValid).toBe(true);
      expect(validateServiceRequestBudget(null).isValid).toBe(true);

      // Invalid inputs
      expect(validateServiceRequestBudget(-500).isValid).toBe(false);
      expect(validateServiceRequestBudget('-500').isValid).toBe(false);
      expect(validateServiceRequestBudget(NaN).isValid).toBe(false);
      expect(validateServiceRequestBudget('abc').isValid).toBe(false);
    });

    it('validateServiceOfferPrice validates 0, positive prices, and rejects invalid inputs', () => {
      expect(validateServiceOfferPrice(0).isValid).toBe(true);
      expect(validateServiceOfferPrice(0).parsedPrice).toBe(0);
      expect(validateServiceOfferPrice(1800).isValid).toBe(true);
      expect(validateServiceOfferPrice(1800).parsedPrice).toBe(1800);
      expect(validateServiceOfferPrice('١٨٠٠ DA').isValid).toBe(true);
      expect(validateServiceOfferPrice('١٨٠٠ DA').parsedPrice).toBe(1800);

      // Empty / negative / NaN are invalid
      expect(validateServiceOfferPrice('').isValid).toBe(false);
      expect(validateServiceOfferPrice(undefined).isValid).toBe(false);
      expect(validateServiceOfferPrice(-100).isValid).toBe(false);
      expect(validateServiceOfferPrice('-100').isValid).toBe(false);
      expect(validateServiceOfferPrice(NaN).isValid).toBe(false);
      expect(validateServiceOfferPrice('xyz').isValid).toBe(false);
    });
  });

  describe('Experience Years Validation & Clamping', () => {
    it('validateExperienceYears should block invalid inputs', () => {
      // Must be an integer number within 0 to 60
      expect(validateExperienceYears('-5')).toContain('قيمة سالبة');
      expect(validateExperienceYears('65')).toContain('لا يمكن أن تتجاوز 60 سنة');
      expect(validateExperienceYears('5.5')).toContain('بدون فواصل عشرية');
      expect(validateExperienceYears('abc')).toContain('يرجى إدخال رقم صحيح لسنوات الخبرة');
      expect(validateExperienceYears(NaN)).toContain('يرجى إدخال رقم صحيح لسنوات الخبرة');
      expect(validateExperienceYears(Infinity)).toContain('يرجى إدخال رقم صحيح لسنوات الخبرة');
      expect(validateExperienceYears('25')).toBe('');
      expect(validateExperienceYears(25)).toBe('');
      expect(validateExperienceYears(0)).toBe('');
      expect(validateExperienceYears('0')).toBe('');
      expect(validateExperienceYears('٠')).toBe('');
      expect(validateExperienceYears('١٠')).toBe('');
    });

    it('clampExperienceYears should safely constrain outputs', () => {
      expect(clampExperienceYears('-5')).toBe(0);
      expect(clampExperienceYears('65')).toBe(60);
      expect(clampExperienceYears('abc', 5)).toBe(5);
      expect(clampExperienceYears('25')).toBe(25);
      expect(clampExperienceYears(25.7)).toBe(25);
    });
  });
});
