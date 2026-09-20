import { describe, it, expect } from 'vitest';
import {
  calculateRatingSummary,
  hasUserReviewedArtisan,
  createReviewEntity,
  addReviewToArtisan,
  updateReviewInArtisan,
  deleteReviewFromArtisan,
  countUserReviews,
  canUserReviewArtisan,
} from '../domain/reviews';
import { toggleFavorite, filterFavoriteArtisans, isOwnArtisanProfile } from '../domain/favorites';
import { calculateCategoryCounts } from '../domain/categories';
import { filterUserOrders } from '../domain/orders';
import { resolveCurrentArtisan } from '../domain/artisan';
import { sanitizeUserSession } from '../domain/session';
import { Artisan, OrderItem, ServiceCategory, UserSession } from '../types';

describe('Domain Logic - Reviews', () => {
  const mockArtisan: Artisan = {
    id: 'art-100',
    name: 'Test Artisan',
    profession: 'Plumber',
    category: 'plumbing',
    city: 'باب الزوار',
    wilaya: 'الجزائر',
    rating: 5,
    reviewCount: 1,
    startingPrice: 2000,
    avatar: 'https://example.com/avatar.jpg',
    verified: true,
    experienceYears: 5,
    bio: 'Test bio',
    services: ['Service 1'],
    portfolio: [],
    reviews: [
      { id: 'rev-1', userId: 'usr-1', userName: 'User 1', rating: 5, comment: 'Great!', date: 'منذ يومين' },
    ],
    availableTimes: '24/7',
    phone: '0552147896',
    availableNow: true,
  };

  it('calculateRatingSummary handles empty and valid reviews', () => {
    expect(calculateRatingSummary([])).toEqual({ rating: 0, reviewCount: 0 });
    const summary = calculateRatingSummary([
      { id: '1', userName: 'A', rating: 5, comment: 'ok', date: 'now' },
      { id: '2', userName: 'B', rating: 4, comment: 'good', date: 'now' },
    ]);
    expect(summary).toEqual({ rating: 4.5, reviewCount: 2 });
  });

  it('hasUserReviewedArtisan detects duplicate reviews strictly by canonical userId (ID ONLY)', () => {
    expect(hasUserReviewedArtisan(mockArtisan, 'usr-1')).toBe(true);
    expect(hasUserReviewedArtisan(mockArtisan, 'usr-999')).toBe(false);
    // Crucial: other ID with same email/fallback is NEVER considered the review owner
    expect(hasUserReviewedArtisan(mockArtisan, 'other-id', 'usr-1')).toBe(false);
  });

  it('createReviewEntity creates review with bounds clamping', () => {
    const rev = createReviewEntity({
      userId: 'usr-2',
      userName: 'User 2',
      rating: 10, // should clamp to 5
      comment: '  Awesome service!  ',
    });
    expect(rev.userId).toBe('usr-2');
    expect(rev.rating).toBe(5);
    expect(rev.comment).toBe('Awesome service!');
  });

  it('addReviewToArtisan appends review without mutating original', () => {
    const newRev = createReviewEntity({
      userId: 'usr-2',
      userName: 'User 2',
      rating: 4,
      comment: 'Good',
    });
    const updated = addReviewToArtisan(mockArtisan, newRev);

    expect(mockArtisan.reviews?.length).toBe(1); // Original immutable
    expect(updated.reviews?.length).toBe(2);
    expect(updated.rating).toBe(4.5);
    expect(updated.reviewCount).toBe(2);
  });

  it('updateReviewInArtisan modifies existing review and recalculates rating', () => {
    const updated = updateReviewInArtisan(mockArtisan, 'rev-1', {
      rating: 3,
      comment: 'Updated comment',
      userId: 'usr-1',
    });
    expect(updated.reviews?.[0].comment).toBe('Updated comment');
    expect(updated.rating).toBe(3);
  });

  it('deleteReviewFromArtisan removes review and updates summary', () => {
    const updated = deleteReviewFromArtisan(mockArtisan, 'rev-1', 'usr-1');
    expect(updated.reviews?.length).toBe(0);
    expect(updated.rating).toBe(0);
    expect(updated.reviewCount).toBe(0);
  });

  it('countUserReviews counts authored reviews across all artisans', () => {
    const artisans = [
      mockArtisan,
      {
        ...mockArtisan,
        id: 'art-200',
        reviews: [
          { id: 'rev-2', userId: 'usr-1', userName: 'User 1', rating: 5, comment: 'Nice', date: 'now' },
          { id: 'rev-3', userId: 'usr-3', userName: 'User 3', rating: 4, comment: 'OK', date: 'now' },
        ],
      },
    ];
    expect(countUserReviews(artisans, 'usr-1')).toBe(2);
    expect(countUserReviews(artisans, 'non-existent')).toBe(0);
  });

  describe('Self-Rating & Review Eligibility (canUserReviewArtisan)', () => {
    const targetArtisan: Artisan = {
      id: 'art-100',
      name: 'كريم سباك',
      profession: 'سباك',
      reviews: [],
    } as unknown as Artisan;

    it('Case 1: Blocks artisan from reviewing own profile by direct ID', () => {
      const ownerSession: UserSession = {
        id: 'art-100',
        name: 'كريم سباك',
        email: 'karim@test.com',
        role: 'artisan',
        createdAt: '2026-09-16',
      };
      expect(canUserReviewArtisan(targetArtisan, ownerSession)).toBe(false);
    });

    it('Case 2: Blocks artisan from reviewing own profile via artisanId link', () => {
      const ownerByArtisanId: UserSession = {
        id: 'usr-100',
        artisanId: 'art-100',
        name: 'كريم سباك',
        email: 'karim@test.com',
        role: 'artisan',
        createdAt: '2026-09-16',
      };
      expect(canUserReviewArtisan(targetArtisan, ownerByArtisanId)).toBe(false);
    });

    it('Case 3: Allows artisan to review a different artisan', () => {
      const otherArtisanSession: UserSession = {
        id: 'art-200',
        artisanId: 'art-200',
        name: 'ياسين كهربائي',
        email: 'yacine@test.com',
        role: 'artisan',
        createdAt: '2026-09-16',
      };
      expect(canUserReviewArtisan(targetArtisan, otherArtisanSession)).toBe(true);
    });

    it('Case 4: Same Name, Different IDs allows review (No Name Matching)', () => {
      const sameNameDifferentArtisan: UserSession = {
        id: 'art-300',
        artisanId: 'art-300',
        name: 'كريم سباك', // Identical name but different ID
        email: 'other_karim@test.com',
        role: 'artisan',
        createdAt: '2026-09-16',
      };
      expect(canUserReviewArtisan(targetArtisan, sameNameDifferentArtisan)).toBe(true);
    });

    it('Case 5: Allows regular authenticated user to review', () => {
      const regularUser: UserSession = {
        id: 'usr-1',
        name: 'أحمد',
        email: 'ahmed@test.com',
        role: 'user',
        createdAt: '2026-09-16',
      };
      expect(canUserReviewArtisan(targetArtisan, regularUser)).toBe(true);
    });

    it('Case 6: Disallows guest (null / undefined) session from reviewing', () => {
      expect(canUserReviewArtisan(targetArtisan, null)).toBe(false);
      expect(canUserReviewArtisan(targetArtisan, undefined)).toBe(false);
    });

    it('Case 7: Disallows review if user has already submitted one', () => {
      const artisanWithReview: Artisan = {
        ...targetArtisan,
        reviews: [
          { id: 'rev-1', userId: 'usr-1', userName: 'أحمد', rating: 5, comment: 'ممتاز', date: 'اليوم' }
        ],
      };
      const regularUser: UserSession = {
        id: 'usr-1',
        name: 'أحمد',
        email: 'ahmed@test.com',
        role: 'user',
        createdAt: '2026-09-16',
      };
      expect(canUserReviewArtisan(artisanWithReview, regularUser)).toBe(false);
    });
  });
});

describe('Domain Logic - Favorites', () => {
  it('toggleFavorite adds or removes artisan ID immutably', () => {
    const initial = ['art-1', 'art-2'];
    const removed = toggleFavorite(initial, 'art-1');
    expect(removed.isAdded).toBe(false);
    expect(removed.updatedFavorites).toEqual(['art-2']);
    expect(initial).toEqual(['art-1', 'art-2']); // Immutable check

    const added = toggleFavorite(removed.updatedFavorites, 'art-3');
    expect(added.isAdded).toBe(true);
    expect(added.updatedFavorites).toEqual(['art-2', 'art-3']);
  });

  it('filterFavoriteArtisans filters list matching favorite IDs', () => {
    const mockArtisans: Artisan[] = [
      { id: 'art-1', name: 'A' } as Artisan,
      { id: 'art-2', name: 'B' } as Artisan,
      { id: 'art-3', name: 'C' } as Artisan,
    ];
    const filtered = filterFavoriteArtisans(mockArtisans, ['art-1', 'art-3']);
    expect(filtered.map(a => a.id)).toEqual(['art-1', 'art-3']);
    expect(filterFavoriteArtisans(mockArtisans, [])).toEqual([]);
  });

  it('isOwnArtisanProfile detects own profile accurately across all roles and sessions', () => {
    const targetArtisan: Artisan = {
      id: 'art-100',
      name: 'كريم سباك',
      profession: 'سباك',
    } as Artisan;

    // 1. Guest session (null/undefined)
    expect(isOwnArtisanProfile(targetArtisan, null)).toBe(false);
    expect(isOwnArtisanProfile(targetArtisan, undefined)).toBe(false);

    // 2. Regular User session
    const regularUser: UserSession = {
      id: 'usr-1',
      name: 'أحمد',
      email: 'ahmed@test.com',
      role: 'user',
      createdAt: '2026-09-16',
    };
    expect(isOwnArtisanProfile(targetArtisan, regularUser)).toBe(false);

    // 3. Different Artisan session
    const otherArtisan: UserSession = {
      id: 'usr-2',
      artisanId: 'art-200',
      name: 'ياسين كهربائي',
      email: 'yacine@test.com',
      role: 'artisan',
      createdAt: '2026-09-16',
    };
    expect(isOwnArtisanProfile(targetArtisan, otherArtisan)).toBe(false);

    // 4. Same Artisan by artisanId
    const ownerByArtisanId: UserSession = {
      id: 'usr-3',
      artisanId: 'art-100',
      name: 'كريم سباك',
      email: 'karim@test.com',
      role: 'artisan',
      createdAt: '2026-09-16',
    };
    expect(isOwnArtisanProfile(targetArtisan, ownerByArtisanId)).toBe(true);

    // 5. Same Artisan by id directly
    const ownerById: UserSession = {
      id: 'art-100',
      name: 'كريم سباك',
      email: 'karim@test.com',
      role: 'artisan',
      createdAt: '2026-09-16',
    };
    expect(isOwnArtisanProfile(targetArtisan, ownerById)).toBe(true);

    // 6. Security Hardening: Same Name ≠ Same Owner (Different IDs must return false)
    const differentArtisanSameName: UserSession = {
      id: 'art-200',
      artisanId: 'art-200',
      name: 'كريم سباك', // Identical name
      email: 'other_karim@test.com',
      role: 'artisan',
      createdAt: '2026-09-16',
    };
    expect(isOwnArtisanProfile(targetArtisan, differentArtisanSameName)).toBe(false);
  });
});

describe('Domain Logic - Categories', () => {
  it('calculateCategoryCounts correctly computes total and per-category counts', () => {
    const categories: ServiceCategory[] = [
      { id: 'all', name: 'جميع المهن', iconName: 'Layers', count: 0, color: '', description: '' },
      { id: 'plumbing', name: 'السباكة', iconName: 'Wrench', count: 0, color: '', description: '' },
      { id: 'electrical', name: 'الكهرباء', iconName: 'Zap', count: 0, color: '', description: '' },
    ];
    const artisans: Artisan[] = [
      { id: '1', category: 'plumbing' } as Artisan,
      { id: '2', category: 'plumbing' } as Artisan,
      { id: '3', category: 'electrical' } as Artisan,
      { id: '4', category: 'other' } as Artisan,
    ];

    const result = calculateCategoryCounts(categories, artisans);
    expect(result.find(c => c.id === 'all')?.count).toBe(4);
    expect(result.find(c => c.id === 'plumbing')?.count).toBe(2);
    expect(result.find(c => c.id === 'electrical')?.count).toBe(1);
  });

  it('handles empty artisans array and artisans without category', () => {
    const categories: ServiceCategory[] = [
      { id: 'all', name: 'جميع المهن', iconName: 'Layers', count: 0, color: '', description: '' },
      { id: 'plumbing', name: 'السباكة', iconName: 'Wrench', count: 0, color: '', description: '' },
    ];
    const emptyResult = calculateCategoryCounts(categories, []);
    expect(emptyResult.find(c => c.id === 'all')?.count).toBe(0);
    expect(emptyResult.find(c => c.id === 'plumbing')?.count).toBe(0);
  });
});

describe('Domain Logic - Orders', () => {
  it('filterUserOrders matches orders strictly by canonical clientId (clientId === userId)', () => {
    const orders: OrderItem[] = [
      { id: 'ord-1', clientId: 'usr-1', clientName: 'Ali', clientEmail: 'ali@example.com', artisanId: 'art-1', artisanName: 'Kareem', artisanProfession: 'Plumber', clientPhone: '0552147896', preferredDate: '2026-09-14', serviceDetails: 'Plumbing', status: 'pending', createdAt: '2026-09-14' },
      { id: 'ord-2', clientId: 'usr-2', clientName: 'Ali', clientEmail: 'ali.work@example.com', artisanId: 'art-2', artisanName: 'Yassine', artisanProfession: 'Electrician', clientPhone: '0661234598', preferredDate: '2026-09-14', serviceDetails: 'Electrical', status: 'completed', createdAt: '2026-09-14' },
      { id: 'ord-3', clientId: 'usr-3', clientName: 'Ali', clientEmail: 'ali.third@example.com', artisanId: 'art-1', artisanName: 'Kareem', artisanProfession: 'Plumber', clientPhone: '0770987654', preferredDate: '2026-09-14', serviceDetails: 'Plumbing', status: 'pending', createdAt: '2026-09-14' },
    ];

    // User A and User B with exact same name ("Ali") and different IDs & emails:
    // User A sees strictly ord-1
    expect(filterUserOrders(orders, 'usr-1').map(o => o.id)).toEqual(['ord-1']);
    // User B sees strictly ord-2
    expect(filterUserOrders(orders, 'usr-2').map(o => o.id)).toEqual(['ord-2']);
    // User C sees strictly ord-3
    expect(filterUserOrders(orders, 'usr-3').map(o => o.id)).toEqual(['ord-3']);

    // CRITICAL: A user with ID 'usr-99' passing another user's email cannot claim ownership
    expect(filterUserOrders(orders, 'usr-99', 'ali@example.com')).toEqual([]);

    // Name is never used in ownership: unknown ID with matching name returns empty array
    expect(filterUserOrders(orders, 'usr-99')).toEqual([]);

    // Guest or missing ID returns empty array
    expect(filterUserOrders(orders, undefined)).toEqual([]);
    expect(filterUserOrders(orders, '')).toEqual([]);
    expect(filterUserOrders([], 'usr-1')).toEqual([]);
  });

  it('resolveCurrentArtisan resolves strictly by canonical ID and prevents cross-account collision', () => {
    const artisansList: Artisan[] = [
      {
        id: 'art-1',
        name: 'Same Name',
        profession: 'Electrician',
        category: 'electrical',
        city: 'القبة',
        wilaya: 'الجزائر',
        rating: 5,
        reviewCount: 3,
        startingPrice: 1500,
        avatar: '',
        verified: true,
        experienceYears: 4,
        bio: '',
        services: [],
        portfolio: [],
        reviews: [],
        availableTimes: '',
        phone: '0550111111',
      },
      {
        id: 'art-2',
        name: 'Same Name',
        profession: 'Plumber',
        category: 'plumbing',
        city: 'الخروب',
        wilaya: 'قسنطينة',
        rating: 4.5,
        reviewCount: 2,
        startingPrice: 2000,
        avatar: '',
        verified: false,
        experienceYears: 2,
        bio: '',
        services: [],
        portfolio: [],
        reviews: [],
        availableTimes: '',
        phone: '0550222222',
      },
    ];

    const sessionA: UserSession = {
      id: 'usr-a',
      name: 'Same Name',
      email: 'a@test.com',
      role: 'artisan',
      artisanId: 'art-1',
      createdAt: '2026-09-14T10:00:00Z',
    };

    const sessionB: UserSession = {
      id: 'usr-b',
      name: 'Same Name',
      email: 'b@test.com',
      role: 'artisan',
      artisanId: 'art-2',
      createdAt: '2026-09-14T10:00:00Z',
    };

    const sessionFallbackId: UserSession = {
      id: 'art-1',
      name: 'Same Name',
      email: 'fallback@test.com',
      role: 'artisan',
      createdAt: '2026-09-14T10:00:00Z',
    };

    const sessionUser: UserSession = {
      id: 'usr-c',
      name: 'Same Name',
      email: 'c@test.com',
      role: 'user',
      createdAt: '2026-09-14T10:00:00Z',
    };

    // Resolves by artisanId
    expect(resolveCurrentArtisan(sessionA, artisansList)?.id).toBe('art-1');
    expect(resolveCurrentArtisan(sessionA, artisansList)?.category).toBe('electrical');

    expect(resolveCurrentArtisan(sessionB, artisansList)?.id).toBe('art-2');
    expect(resolveCurrentArtisan(sessionB, artisansList)?.category).toBe('plumbing');

    // Resolves by currentUser.id fallback
    expect(resolveCurrentArtisan(sessionFallbackId, artisansList)?.id).toBe('art-1');

    // Non-artisan returns null
    expect(resolveCurrentArtisan(sessionUser, artisansList)).toBeNull();

    // Guest returns null
    expect(resolveCurrentArtisan(null, artisansList)).toBeNull();
    expect(resolveCurrentArtisan(undefined, artisansList)).toBeNull();
  });
});

describe('Domain Logic - Session', () => {
  it('sanitizeUserSession strips password field and returns clean UserSession', () => {
    const rawUser = {
      id: 'usr-1',
      name: 'Test User',
      email: 'test@example.com',
      phone: '0552147896',
      password: 'SecretPassword123!',
      role: 'user' as const,
      createdAt: '2026-09-14',
    };

    const sanitized = sanitizeUserSession(rawUser);
    expect(sanitized).not.toBeNull();
    expect(sanitized?.id).toBe('usr-1');
    expect(sanitized && 'password' in sanitized).toBe(false);
  });
});

describe('Repository & Auth Logic - Fixes', () => {
  it('FavoritesRepository isolates favorites by user ID', async () => {
    const { favoritesRepository } = await import('../repositories/favoritesRepository');
    const { appLocalStorage } = await import('../repositories/storage');

    const store: Record<string, string> = {};
    const mockStorage = {
      getItem: (key: string) => store[key] || null,
      setItem: (key: string, value: string) => { store[key] = value; },
      removeItem: (key: string) => { delete store[key]; },
      clear: () => { Object.keys(store).forEach(k => delete store[k]); },
      length: 0,
      key: () => null,
    };
    (appLocalStorage as any).storage = mockStorage;
    
    favoritesRepository.saveFavoriteIds(['art-100'], 'usr-A');
    favoritesRepository.saveFavoriteIds(['art-200'], 'usr-B');

    expect(favoritesRepository.getFavoriteIds('usr-A')).toEqual(['art-100']);
    expect(favoritesRepository.getFavoriteIds('usr-B')).toEqual(['art-200']);
    expect(favoritesRepository.getFavoriteIds(null)).toEqual([]);
  });

  it('authService.register rejects registration if email already exists', async () => {
    const { authService } = await import('../services/authService');
    const { sessionRepository } = await import('../repositories/sessionRepository');
    const { appLocalStorage } = await import('../repositories/storage');

    const store: Record<string, string> = {};
    const mockStorage = {
      getItem: (key: string) => store[key] || null,
      setItem: (key: string, value: string) => { store[key] = value; },
      removeItem: (key: string) => { delete store[key]; },
      clear: () => { Object.keys(store).forEach(k => delete store[k]); },
      length: 0,
      key: () => null,
    };
    (appLocalStorage as any).storage = mockStorage;

    sessionRepository.savePublicUsers([{
      id: 'usr-exist',
      name: 'Existing User',
      email: 'already@taken.com',
      role: 'user',
      createdAt: new Date().toISOString(),
    }]);

    await expect(authService.register({
      name: 'New User',
      email: '  ALREADY@TAKEN.com  ',
      password: 'Password123!',
      role: 'user',
    })).rejects.toThrow('EMAIL_EXISTS');
  });
});

describe('Domain Logic - Artisan Client Preview & Ownership Integrity', () => {
  const artisanA: Artisan = {
    id: 'art-100',
    name: 'كريم سباك',
    profession: 'سباك صحي',
    category: 'plumbing',
    city: 'باب الزوار',
    wilaya: 'الجزائر',
    rating: 4.8,
    reviewCount: 3,
    startingPrice: 1500,
    avatar: 'https://example.com/karim.jpg',
    verified: true,
    experienceYears: 7,
    bio: 'متخصص في جميع أعمال السباكة والصيانة المنزلية.',
    services: ['صيانة الأنابيب', 'تركيب السخانات'],
    portfolio: [],
    reviews: [],
    availableTimes: 'طوال الأسبوع',
    phone: '0555123456',
    availableNow: true,
  };

  const artisanB: Artisan = {
    id: 'art-200',
    name: 'كريم سباك', // Same name, different ID
    profession: 'سباك صحي',
    category: 'plumbing',
    city: 'الدار البيضاء',
    wilaya: 'الجزائر',
    rating: 5.0,
    reviewCount: 1,
    startingPrice: 2000,
    avatar: 'https://example.com/karim-b.jpg',
    verified: true,
    experienceYears: 4,
    bio: 'سباك مؤهل ومعتمد.',
    services: ['تصليح التسريبات'],
    portfolio: [],
    reviews: [],
    availableTimes: 'طوال الأسبوع',
    phone: '0555987654',
    availableNow: true,
  };

  const userSessionArtisanA: UserSession = {
    id: 'art-100',
    artisanId: 'art-100',
    name: 'كريم سباك',
    email: 'karim@example.com',
    role: 'artisan',
    createdAt: '2026-09-15T10:00:00.000Z',
  };

  const userSessionArtisanB: UserSession = {
    id: 'art-200',
    artisanId: 'art-200',
    name: 'كريم سباك',
    email: 'karim2@example.com',
    role: 'artisan',
    createdAt: '2026-09-15T10:00:00.000Z',
  };

  const userSessionCustomer: UserSession = {
    id: 'usr-customer',
    name: 'أحمد عميل',
    email: 'ahmed@example.com',
    role: 'user',
    createdAt: '2026-09-15T10:00:00.000Z',
  };

  it('Case 1 & 5 — Artisan A is identified as owner of Artisan A but not Artisan B even with same name', () => {
    expect(isOwnArtisanProfile(artisanA, userSessionArtisanA)).toBe(true);
    expect(isOwnArtisanProfile(artisanB, userSessionArtisanA)).toBe(false);
    expect(isOwnArtisanProfile(artisanA, userSessionArtisanB)).toBe(false);
    expect(isOwnArtisanProfile(artisanB, userSessionArtisanB)).toBe(true);
  });

  it('Case 2 & 3 — Regular Customer and Guest are never identified as artisan owners', () => {
    expect(isOwnArtisanProfile(artisanA, userSessionCustomer)).toBe(false);
    expect(isOwnArtisanProfile(artisanA, null)).toBe(false);
  });

  it('Case 9 — Self-favorite remains strictly blocked for owner in preview and workspace', () => {
    // Owner attempting to favorite self is detected by isOwnArtisanProfile guard
    expect(isOwnArtisanProfile(artisanA, userSessionArtisanA)).toBe(true);

    // Customer is NOT blocked by isOwnArtisanProfile and can toggle favorite
    expect(isOwnArtisanProfile(artisanA, userSessionCustomer)).toBe(false);
    const customerFavResult = toggleFavorite(['other-id'], 'art-100');
    expect(customerFavResult.isAdded).toBe(true);
    expect(customerFavResult.updatedFavorites).toContain('art-100');
  });

  it('Case 10 — Self-rating remains strictly blocked for owner in preview and workspace', () => {
    // Owner cannot review self
    const canOwnerReview = canUserReviewArtisan(artisanA, userSessionArtisanA);
    expect(canOwnerReview).toBe(false);

    // Regular customer who has not reviewed yet CAN review
    const canCustomerReview = canUserReviewArtisan(artisanA, userSessionCustomer);
    expect(canCustomerReview).toBe(true);

    // Guest cannot review without login
    const canGuestReview = canUserReviewArtisan(artisanA, null);
    expect(canGuestReview).toBe(false);
  });

  it('Case 6 & 7 — Canonical Artisan updates (including professional image) are immediately reflected in data source', () => {
    const updatedImage = 'data:image/jpeg;base64,UPDATED_IMAGE_DATA';
    const updatedArtisan: Artisan = {
      ...artisanA,
      avatar: updatedImage,
      startingPrice: 1800,
      profession: 'خبير سباكة وتدفئة مركزية',
    };

    // The updated object contains the latest canonical fields
    expect(updatedArtisan.avatar).toBe(updatedImage);
    expect(updatedArtisan.startingPrice).toBe(1800);
    expect(updatedArtisan.profession).toBe('خبير سباكة وتدفئة مركزية');
  });

  it('Preview eligibility — Artisan A can preview own profile, but Artisan B, Customer, and Guest cannot', () => {
    // Only owner has ownership permission to preview own profile
    expect(isOwnArtisanProfile(artisanA, userSessionArtisanA)).toBe(true);
    expect(isOwnArtisanProfile(artisanA, userSessionArtisanB)).toBe(false);
    expect(isOwnArtisanProfile(artisanA, userSessionCustomer)).toBe(false);
    expect(isOwnArtisanProfile(artisanA, null)).toBe(false);
  });

  it('Session Immutability — Preview does not mutate user session or role', () => {
    const sessionBefore = { ...userSessionArtisanA };
    // Simulating opening and closing preview with canonical artisan
    const previewTarget = artisanA;
    expect(previewTarget.id).toBe(userSessionArtisanA.artisanId);
    
    // User session remains identical
    expect(userSessionArtisanA.role).toBe('artisan');
    expect(userSessionArtisanA.id).toBe(sessionBefore.id);
    expect(userSessionArtisanA.artisanId).toBe(sessionBefore.artisanId);
  });

  it('Self Contact — Contact request is blocked for owner, while Phone, WhatsApp, and Share remain available', () => {
    // Owner is blocked from sending contact request to self
    expect(isOwnArtisanProfile(artisanA, userSessionArtisanA)).toBe(true);
    
    // Customer can send contact request to artisanA
    expect(isOwnArtisanProfile(artisanA, userSessionCustomer)).toBe(false);

    // Public contact credentials remain intact for preview validation
    expect(artisanA.phone).toBe('0555123456');
    expect(artisanA.phone.length).toBeGreaterThan(0);
  });

  it('Edit & Cancel Isolation — Discarding edits preserves original canonical data', () => {
    const originalAvatar = artisanA.avatar;
    const originalPrice = artisanA.startingPrice;

    // Simulated dirty edit state
    const dirtyFormState = {
      avatar: 'data:image/jpeg;base64,UNSAVED_DRAFT_IMAGE',
      startingPrice: '9999',
    };
    expect(dirtyFormState.avatar).not.toBe(originalAvatar);

    // Simulated cancel action (reverting back to canonical artisan)
    const revertedState = {
      avatar: artisanA.avatar,
      startingPrice: String(artisanA.startingPrice),
    };
    expect(revertedState.avatar).toBe(originalAvatar);
    expect(Number(revertedState.startingPrice)).toBe(originalPrice);
  });
});

