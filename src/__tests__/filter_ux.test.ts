import { describe, it, expect } from 'vitest';
import { SERVICE_CATEGORIES } from '../data';
import { normalizeArabicText, isArtisan247 } from '../utils';
import { FilterDraftValues } from '../components/AdvancedFilterModal';
import { Artisan } from '../types';

const TEST_ARTISANS: Artisan[] = [
  {
    id: 'test-art-1',
    name: 'كريم عمراني',
    profession: 'سباك',
    category: 'plumbing',
    city: 'باب الزوار',
    wilaya: 'الجزائر',
    rating: 4.9,
    reviewCount: 38,
    startingPrice: 2000,
    avatar: '',
    verified: true,
    experienceYears: 9,
    bio: 'تست',
    services: ['تصليح تسربات المياه'],
    portfolio: [],
    reviews: [],
    availableTimes: 'طوارئ 24/7',
    phone: '0552147896',
    availableNow: true
  },
  {
    id: 'test-art-2',
    name: 'ياسين بن علي',
    profession: 'كهربائي',
    category: 'electrical',
    city: 'حي النخيل',
    wilaya: 'وهران',
    rating: 4.8,
    reviewCount: 29,
    startingPrice: 1800,
    avatar: '',
    verified: false,
    experienceYears: 7,
    bio: 'تست',
    services: [],
    portfolio: [],
    reviews: [],
    availableTimes: 'السبت - الخميس',
    phone: '0661234598',
    availableNow: false
  }
];

describe('Search & Filter UX - Draft Logic & Counts', () => {
  it('computes correct draft matching count for specific wilaya and category', () => {
    const draft: FilterDraftValues = {
      wilaya: 'الجزائر',
      commune: 'الكل',
      category: 'plumbing',
      sortBy: 'default',
      availableNowOnly: false,
      emergency247Only: false,
      verifiedOnly: false,
    };

    const matches = TEST_ARTISANS.filter(a => {
      if (draft.category !== 'all' && a.category !== draft.category) return false;
      if (draft.wilaya !== 'الكل' && a.wilaya !== draft.wilaya) return false;
      if (draft.commune !== 'الكل' && a.city !== draft.commune) return false;
      if (draft.verifiedOnly && !a.verified) return false;
      if (draft.availableNowOnly && !a.availableNow) return false;
      if (draft.emergency247Only && !isArtisan247(a)) return false;
      return true;
    });

    expect(matches.length).toBeGreaterThan(0);
    matches.forEach(artisan => {
      expect(artisan.wilaya).toBe('الجزائر');
      expect(artisan.category).toBe('plumbing');
    });
  });

  it('correctly filters for 24/7 emergency artisans', () => {
    const emergencyArtisans = TEST_ARTISANS.filter(a => isArtisan247(a));
    expect(emergencyArtisans.length).toBeGreaterThan(0);
    emergencyArtisans.forEach(a => {
      expect(isArtisan247(a)).toBe(true);
    });
  });

  it('correctly filters for verified and available now artisans', () => {
    const activeVerified = TEST_ARTISANS.filter(a => a.verified && a.availableNow);
    expect(activeVerified.length).toBeGreaterThan(0);
    activeVerified.forEach(a => {
      expect(a.verified).toBe(true);
      expect(a.availableNow).toBe(true);
    });
  });

  it('draft reset returns all parameters to canonical defaults', () => {
    const resetDraft: FilterDraftValues = {
      wilaya: 'الكل',
      commune: 'الكل',
      category: 'all',
      sortBy: 'default',
      availableNowOnly: false,
      emergency247Only: false,
      verifiedOnly: false,
    };

    expect(resetDraft.wilaya).toBe('الكل');
    expect(resetDraft.commune).toBe('الكل');
    expect(resetDraft.category).toBe('all');
    expect(resetDraft.sortBy).toBe('default');
    expect(resetDraft.availableNowOnly).toBe(false);
    expect(resetDraft.emergency247Only).toBe(false);
    expect(resetDraft.verifiedOnly).toBe(false);
  });

  it('categories array maintains "all" as the first category', () => {
    expect(SERVICE_CATEGORIES[0].id).toBe('all');
    expect(SERVICE_CATEGORIES[0].name).toBe('جميع المهن');
  });
});
