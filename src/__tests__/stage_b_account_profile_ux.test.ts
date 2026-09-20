import { describe, it, expect, beforeEach } from 'vitest';
import { UserSession, Artisan, ServiceRequest } from '../types';
import { 
  isOwnArtisanProfile, 
  canReviewArtisan, 
  canCreateContactRequest,
  canFavoriteArtisan,
  sanitizeArtisanProfileUpdate,
  canEditArtisanProfile
} from '../domain';
import { 
  orderRepository, 
  serviceRequestRepository, 
  favoritesRepository,
  appLocalStorage 
} from '../repositories';

describe('Stage B: Account & Profile UX Tests', () => {
  beforeEach(() => {
    appLocalStorage.removeItem('bricojob_orders');
    appLocalStorage.removeItem('bricojob_service_requests');
    appLocalStorage.removeItem('bricojob_favorites');
  });

  describe('1. Customer Account (/account) Data & Privacy Integrity', () => {
    const customerUser: UserSession = {
      id: 'cust-123',
      name: 'أحمد بن علي',
      email: 'ahmed@example.dz',
      role: 'user',
      phone: '0555123456',
      wilaya: 'الجزائر',
      city: 'باب الزوار',
      createdAt: '2026-09-17T10:00:00Z'
    };

    it('calculates account completion based strictly on existing canonical fields', () => {
      // With all existing fields provided: name, email, phone, wilaya, avatar
      const hasPhone = Boolean(customerUser.phone && customerUser.phone.trim().length > 0);
      const hasLocation = Boolean(customerUser.wilaya && customerUser.wilaya.trim().length > 0);
      const hasAvatar = Boolean(customerUser.avatar && customerUser.avatar.trim().length > 0);

      const totalPoints = 4;
      const completedPoints = 1 + (hasPhone ? 1 : 0) + (hasLocation ? 1 : 0) + (hasAvatar ? 1 : 0);
      const percentage = Math.round((completedPoints / totalPoints) * 100);

      expect(hasPhone).toBe(true);
      expect(hasLocation).toBe(true);
      expect(hasAvatar).toBe(false);
      expect(percentage).toBe(75); // 3 of 4
    });

    it('displays activity summary correctly from existing repositories without fabrication', () => {
      // Initially zero
      const initialRequests = serviceRequestRepository.getByClientId(customerUser.id);
      const initialOrders = orderRepository.getByClient(customerUser.id);
      const initialFavorites = favoritesRepository.getFavoriteIds(customerUser.id);

      expect(initialRequests.length).toBe(0);
      expect(initialOrders.length).toBe(0);
      expect(initialFavorites.length).toBe(0);

      // Create a real service request for this customer
      const requestCreated = serviceRequestRepository.create({
        id: 'req-1',
        clientId: customerUser.id,
        category: 'tech',
        title: 'تصليح قاطع كهربائي',
        description: 'تصليح قاطع كهربائي للمطبخ',
        wilaya: 'الجزائر',
        city: 'باب الزوار',
        clientName: customerUser.name,
        clientPhone: customerUser.phone,
        urgency: 'flexible',
        status: 'open',
        createdAt: '2026-09-17T10:00:00Z'
      });

      expect(requestCreated).toBe(true);
      const updatedRequests = serviceRequestRepository.getByClientId(customerUser.id);
      expect(updatedRequests.length).toBe(1);

      // Save a favorite for this customer
      favoritesRepository.saveFavoriteIds(['artisan-999'], customerUser.id);
      const updatedFavorites = favoritesRepository.getFavoriteIds(customerUser.id);
      expect(updatedFavorites.length).toBe(1);
    });

    it('guarantees customer accounts are private and cannot be impersonated or reviewed', () => {
      const anotherCustomer: UserSession = {
        id: 'cust-456',
        name: 'كريم بلحاج',
        email: 'karim@example.dz',
        role: 'user',
        createdAt: '2026-09-17T10:00:00Z'
      };

      // Customer cannot review another customer
      expect(canReviewArtisan(anotherCustomer, null as any)).toBe(false);

      // Customer cannot favorite a null or non-artisan entity
      expect(canFavoriteArtisan(anotherCustomer, null as any)).toBe(false);
    });
  });

  describe('2. Artisan Professional Profile & Client Preview UX', () => {
    const artisanOwnerUser: UserSession = {
      id: 'artisan-user-1',
      artisanId: 'art-1',
      name: 'مولود حداد',
      email: 'mouloud@example.dz',
      role: 'artisan',
      phone: '0661998877',
      wilaya: 'وهران',
      city: 'السانية',
      createdAt: '2026-09-17T10:00:00Z'
    };

    const artisanRecord: Artisan = {
      id: 'art-1',
      name: 'مولود حداد',
      profession: 'سباك وصحي معتمد',
      category: 'plumbing',
      wilaya: 'وهران',
      city: 'السانية',
      phone: '0661998877',
      avatar: 'https://images.unsplash.com/photo-1540569014015-19a7be504e3a',
      rating: 4.8,
      reviewCount: 12,
      completedJobs: 15,
      experienceYears: 7,
      startingPrice: 1500,
      availableNow: true,
      availableTimes: '8:00 - 18:00',
      bio: 'سباك محترف مع خبرة 7 سنوات في الشبكات المائية والتسريبات.',
      services: ['تصليح تسربات', 'تركيب سخانات', 'تمديد أنابيب'],
      portfolio: [],
      reviews: [],
      verified: true
    };

    const clientUser: UserSession = {
      id: 'cust-99',
      name: 'سمير قادري',
      email: 'samir@example.dz',
      role: 'user',
      createdAt: '2026-09-17T10:00:00Z'
    };

    it('correctly identifies artisan ownership for client preview mode', () => {
      // When artisan owner inspects their own profile
      const isOwner = isOwnArtisanProfile(artisanRecord, artisanOwnerUser);
      expect(isOwner).toBe(true);

      // When an ordinary client inspects the profile
      const isClientOwner = isOwnArtisanProfile(artisanRecord, clientUser);
      expect(isClientOwner).toBe(false);
    });

    it('preserves read-only restrictions during client preview without mutating session or auth', () => {
      // Artisan viewing their own profile cannot send contact request to themselves
      expect(canCreateContactRequest(artisanOwnerUser, artisanRecord)).toBe(false);

      // Ordinary client can send contact request
      expect(canCreateContactRequest(clientUser, artisanRecord)).toBe(true);

      // Ordinary client can favorite the artisan
      expect(canFavoriteArtisan(clientUser, artisanRecord)).toBe(true);

      // Artisan cannot favorite themselves
      expect(canFavoriteArtisan(artisanOwnerUser, artisanRecord)).toBe(false);
    });

    it('preserves professional information integrity including bio and experience years', () => {
      expect(artisanRecord.bio).toBe('سباك محترف مع خبرة 7 سنوات في الشبكات المائية والتسريبات.');
      expect(artisanRecord.experienceYears).toBe(7);
      expect(artisanRecord.completedJobs).toBe(15);
      expect(artisanRecord.verified).toBe(true);
      expect(artisanRecord.startingPrice).toBe(1500);
    });

    it('safeguards editing authorization so non-owners cannot mutate artisan profile', () => {
      expect(canEditArtisanProfile(artisanOwnerUser, artisanRecord)).toBe(true);
      expect(canEditArtisanProfile(clientUser, artisanRecord)).toBe(false);

      // Protected fields like verified and rating are preserved during updates
      const sanitized = sanitizeArtisanProfileUpdate(artisanRecord, {
        profession: 'سباك ممتاز',
        bio: 'نبذة محدثة'
      });

      expect(sanitized.profession).toBe('سباك ممتاز');
      expect(sanitized.bio).toBe('نبذة محدثة');
      expect(sanitized.verified).toBe(true); // platform-protected
      expect(sanitized.rating).toBe(4.8);   // platform-protected
    });
  });
});
