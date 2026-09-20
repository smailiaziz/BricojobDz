import { describe, it, expect, beforeEach } from 'vitest';
import { 
  matchRequestsForArtisan, 
  getUrgencyInfo, 
  getStatusBadgeInfo, 
  URGENCY_OPTIONS 
} from '../domain/serviceRequests';
import { isOwnArtisanProfile } from '../domain/favorites';
import { serviceRequestRepository } from '../repositories/serviceRequestRepository';
import { serviceOfferRepository } from '../repositories/serviceOfferRepository';
import { contactRequestRepository } from '../repositories/contactRequestRepository';
import { appLocalStorage } from '../repositories/storage';
import { ServiceRequest, ServiceOffer, Artisan, UserSession } from '../types';

describe('Domain Logic - Service Requests', () => {
  const mockArtisan: Artisan = {
    id: 'art-1',
    name: 'Karim Plumber',
    profession: 'سباك صحي',
    category: 'plumbing',
    city: 'باب الزوار',
    wilaya: 'الجزائر',
    rating: 4.8,
    reviewCount: 10,
    startingPrice: 2000,
    avatar: '',
    verified: true,
    experienceYears: 6,
    bio: '',
    services: [],
    portfolio: [],
    reviews: [],
    availableTimes: '8-17',
    phone: '0550123456',
  };

  const sampleRequests: ServiceRequest[] = [
    {
      id: 'req-1',
      clientId: 'usr-1',
      category: 'plumbing',
      title: 'تسرب مياه المطبخ',
      description: 'تسرب تحت حوض المطبخ يحتاج إصلاح عاجل',
      wilaya: 'الجزائر',
      city: 'باب الزوار',
      urgency: 'now',
      status: 'open',
      createdAt: '2026-09-16T10:00:00Z',
    },
    {
      id: 'req-2',
      clientId: 'usr-2',
      category: 'plumbing',
      title: 'تركيب سخان ماء',
      description: 'تركيب سخان ماء جديد',
      wilaya: 'وهران',
      city: 'وهران',
      urgency: 'flexible',
      status: 'open',
      createdAt: '2026-09-16T09:00:00Z',
    },
    {
      id: 'req-3',
      clientId: 'usr-3',
      category: 'electrical',
      title: 'إصلاح قاطع الكهرباء',
      description: 'مشكلة في لوحة القواطع',
      wilaya: 'الجزائر',
      city: 'الحراش',
      urgency: 'today',
      status: 'open',
      createdAt: '2026-09-16T08:00:00Z',
    },
    {
      id: 'req-4',
      clientId: 'usr-4',
      category: 'plumbing',
      title: 'طلب ملغى',
      description: 'طلب ملغى من العميل',
      wilaya: 'الجزائر',
      city: 'باب الزوار',
      urgency: 'flexible',
      status: 'cancelled',
      createdAt: '2026-09-16T07:00:00Z',
    },
  ];

  it('matchRequestsForArtisan strictly requires matching category and prioritizes wilaya/urgency', () => {
    const matched = matchRequestsForArtisan(sampleRequests, mockArtisan, 'suitable');
    
    // req-4 (cancelled) should NOT be present
    expect(matched.find(r => r.id === 'req-4')).toBeUndefined();

    // req-3 (electrical) should NOT be present for a plumber even though they share the same wilaya!
    expect(matched.find(r => r.id === 'req-3')).toBeUndefined();

    // Both req-1 and req-2 are plumbing
    expect(matched.length).toBe(2);

    // req-1 is exact category & exact wilaya & urgency=now -> top ranked
    expect(matched[0].id).toBe('req-1');
    expect(matched[1].id).toBe('req-2');
  });

  it('matchRequestsForArtisan returns all non-cancelled requests in "all" mode', () => {
    const all = matchRequestsForArtisan(sampleRequests, mockArtisan, 'all');
    expect(all.length).toBe(3);
    expect(all.find(r => r.id === 'req-4')).toBeUndefined();
  });

  it('getUrgencyInfo returns correct option for each value', () => {
    expect(getUrgencyInfo('now').label).toBe('الآن (مستعجل)');
    expect(getUrgencyInfo('today').label).toBe('اليوم');
    expect(getUrgencyInfo('scheduled').label).toBe('موعد محدد');
    expect(getUrgencyInfo('flexible').label).toBe('مرن');
  });

  it('getStatusBadgeInfo handles all statuses properly', () => {
    expect(getStatusBadgeInfo('open').label).toBe('بانتظار العروض');
    expect(getStatusBadgeInfo('offers_received').label).toBe('وصلت عروض');
    expect(getStatusBadgeInfo('assigned').label).toBe('تم اختيار حرفي');
    expect(getStatusBadgeInfo('cancelled').label).toBe('ملغى');
  });
});

describe('Repositories - ServiceRequestRepository & ServiceOfferRepository', () => {
  beforeEach(() => {
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
  });

  it('ServiceRequestRepository: create, getById, getByClientId, and cancel', () => {
    const req: ServiceRequest = {
      id: 'req-100',
      clientId: 'usr-10',
      clientName: 'Smail',
      category: 'plumbing',
      title: 'تسرب مياه',
      description: 'تسرب مياه تحت الحوض',
      wilaya: 'الجزائر',
      city: 'باب الزوار',
      urgency: 'now',
      status: 'open',
      createdAt: new Date().toISOString(),
    };

    expect(serviceRequestRepository.create(req)).toBe(true);
    expect(serviceRequestRepository.getById('req-100')?.title).toBe('تسرب مياه');
    expect(serviceRequestRepository.getByClientId('usr-10').length).toBe(1);

    // Cancel open request
    expect(serviceRequestRepository.cancel('req-100', 'usr-10')).toBe(true);
    expect(serviceRequestRepository.getById('req-100')?.status).toBe('cancelled');

    // Cannot cancel if assigned
    serviceRequestRepository.updateStatus('req-100', 'assigned');
    expect(serviceRequestRepository.cancel('req-100', 'usr-10')).toBe(false);
  });

  it('ServiceOfferRepository: create, prevent duplicate, accept single and reject others', () => {
    const offer1: ServiceOffer = {
      id: 'off-1',
      requestId: 'req-100',
      artisanId: 'art-1',
      artisanName: 'Karim',
      proposedPrice: 2500,
      status: 'pending',
      createdAt: new Date().toISOString(),
    };

    const offer2: ServiceOffer = {
      id: 'off-2',
      requestId: 'req-100',
      artisanId: 'art-2',
      artisanName: 'Yacine',
      proposedPrice: 2000,
      status: 'pending',
      createdAt: new Date().toISOString(),
    };

    expect(serviceOfferRepository.create(offer1)).toBe(true);
    expect(serviceOfferRepository.create(offer2)).toBe(true);

    // Duplicate submission by same artisan for same request should be rejected
    const duplicateOffer: ServiceOffer = {
      ...offer1,
      id: 'off-1-dup',
      proposedPrice: 1800,
    };
    expect(serviceOfferRepository.create(duplicateOffer)).toBe(false);

    // Accept offer1
    expect(serviceOfferRepository.accept('off-1', 'req-100')).toBe(true);

    const allOffers = serviceOfferRepository.getByRequestId('req-100');
    const o1 = allOffers.find(o => o.id === 'off-1');
    const o2 = allOffers.find(o => o.id === 'off-2');

    expect(o1?.status).toBe('accepted');
    expect(o2?.status).toBe('not_selected');
  });

  describe('Contact Requests - Repository & Access Security', () => {
    it('saves contact request and retrieves strictly by canonical artisanId', () => {
      // 1. Artisan A has Contact Request
      const reqA = contactRequestRepository.save({
        artisanId: 'art-100',
        artisanName: 'Same Name Artisan',
        customerId: 'usr-cust-1',
        customerName: 'Fatima',
        customerPhone: '0555123456',
        service: 'تركيب صنبور',
        description: 'تسريب في صنبور الحمام',
        preferredContact: 'phone',
      });

      expect(reqA.id).toBeDefined();
      expect(reqA.status).toBe('pending');

      // 2. Artisan B with same name has another request
      const reqB = contactRequestRepository.save({
        artisanId: 'art-200',
        artisanName: 'Same Name Artisan',
        customerId: 'usr-cust-2',
        customerName: 'Amina',
        customerPhone: '0666987654',
        service: 'تسليك مجاري',
        description: 'انسداد في البالوعة',
        preferredContact: 'whatsapp',
      });

      // 3. A sees A's request
      const artisanARequests = contactRequestRepository.getByArtisan('art-100');
      expect(artisanARequests.length).toBe(1);
      expect(artisanARequests[0].id).toBe(reqA.id);
      expect(artisanARequests[0].customerName).toBe('Fatima');

      // 4. B does NOT see A's request
      const artisanBRequests = contactRequestRepository.getByArtisan('art-200');
      expect(artisanBRequests.length).toBe(1);
      expect(artisanBRequests[0].id).toBe(reqB.id);
      expect(artisanBRequests[0].customerName).toBe('Amina');

      // 5. User only sees requests made by their customerId, not artisan inbox
      const customerRequests = contactRequestRepository.getByCustomer('usr-cust-1');
      expect(customerRequests.length).toBe(1);
      expect(customerRequests[0].id).toBe(reqA.id);

      // 6. Guest or empty ID gets empty array
      expect(contactRequestRepository.getByArtisan('')).toEqual([]);
      expect(contactRequestRepository.getByCustomer('')).toEqual([]);

      // 7. Status update works correctly
      expect(contactRequestRepository.updateStatus(reqA.id, 'handled')).toBe(true);
      const updatedA = contactRequestRepository.getByArtisan('art-100');
      expect(updatedA[0].status).toBe('handled');

      expect(contactRequestRepository.updateStatus(reqA.id, 'pending')).toBe(true);
      const revertedA = contactRequestRepository.getByArtisan('art-100');
      expect(revertedA[0].status).toBe('pending');
    });

    it('preserves self-contact guard via isOwnArtisanProfile', () => {
      const artisanA: Artisan = {
        id: 'art-100',
        name: 'Same Name',
        profession: 'Plumber',
        category: 'plumbing',
        city: 'الجزائر',
        wilaya: 'الجزائر',
        rating: 5,
        reviewCount: 1,
        startingPrice: 2000,
        avatar: '',
        verified: true,
        experienceYears: 5,
        bio: '',
        services: [],
        portfolio: [],
        reviews: [],
        availableTimes: '',
        phone: '0550000000',
      };

      const ownerSession: UserSession = {
        id: 'usr-art-100',
        name: 'Same Name',
        email: 'artisan100@test.com',
        role: 'artisan',
        artisanId: 'art-100',
        createdAt: '2026-09-14T10:00:00Z',
      };

      const otherSession: UserSession = {
        id: 'usr-art-200',
        name: 'Same Name',
        email: 'artisan200@test.com',
        role: 'artisan',
        artisanId: 'art-200',
        createdAt: '2026-09-14T10:00:00Z',
      };

      const clientSession: UserSession = {
        id: 'usr-client-1',
        name: 'Client User',
        email: 'client@test.com',
        role: 'user',
        createdAt: '2026-09-14T10:00:00Z',
      };

      // Owner is verified strictly
      expect(isOwnArtisanProfile(artisanA, ownerSession)).toBe(true);

      // Other artisan with same name cannot be identified as owner of artisanA
      expect(isOwnArtisanProfile(artisanA, otherSession)).toBe(false);

      // Regular client is not owner
      expect(isOwnArtisanProfile(artisanA, clientSession)).toBe(false);
    });
  });
});
