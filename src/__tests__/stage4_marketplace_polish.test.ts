// Provide lightweight window.localStorage mock for Node environment tests BEFORE importing storage/repositories
const memoryStorage = new Map<string, string>();
const localStorageMock = {
  getItem: (key: string) => memoryStorage.get(key) ?? null,
  setItem: (key: string, value: string) => { memoryStorage.set(key, String(value)); },
  removeItem: (key: string) => { memoryStorage.delete(key); },
  clear: () => { memoryStorage.clear(); },
  length: 0,
  key: () => null,
};

if (typeof window === 'undefined') {
  (globalThis as any).window = {
    localStorage: localStorageMock,
  };
}

import { describe, it, expect, beforeEach } from 'vitest';
import { 
  getStatusBadgeInfo, 
  formatOffersCountLabel, 
  matchRequestsForArtisan,
  validateServiceOfferPrice
} from '../domain/serviceRequests';
import { 
  canSubmitOffer, 
  canAcceptOffer, 
  canCancelServiceRequest, 
  canEditServiceRequest 
} from '../domain/authorization';
import { serviceRequestRepository, serviceOfferRepository } from '../repositories';
import { appLocalStorage } from '../repositories/storage';
import { ServiceRequest, ServiceOffer, UserSession, Artisan } from '../types';

describe('STAGE 4 — Marketplace Polish & UX Hardening Test Suite', () => {
  beforeEach(() => {
    memoryStorage.clear();
  });

  // ==========================================
  // SECTION 1: USER VIEW & OFFER COUNT GRAMMAR
  // ==========================================
  describe('User View & Offer Grammar', () => {
    it('formats offer counts accurately in Arabic grammar', () => {
      expect(formatOffersCountLabel(0)).toBe('لا توجد عروض بعد');
      expect(formatOffersCountLabel(1)).toBe('عرض واحد');
      expect(formatOffersCountLabel(2)).toBe('عرضان');
      expect(formatOffersCountLabel(3)).toBe('3 عروض');
      expect(formatOffersCountLabel(7)).toBe('7 عروض');
      expect(formatOffersCountLabel(10)).toBe('10 عروض');
      expect(formatOffersCountLabel(11)).toBe('11 عرضاً');
      expect(formatOffersCountLabel(25)).toBe('25 عرضاً');
    });

    it('provides accurate Arabic status badges for all marketplace statuses', () => {
      expect(getStatusBadgeInfo('open').label).toBe('بانتظار العروض');
      expect(getStatusBadgeInfo('offers_received').label).toBe('وصلت عروض');
      expect(getStatusBadgeInfo('assigned').label).toBe('تم اختيار حرفي');
      expect(getStatusBadgeInfo('completed').label).toBe('مكتمل');
      expect(getStatusBadgeInfo('cancelled').label).toBe('ملغى');
    });
  });

  // ==========================================
  // SECTION 2: ACCEPT OFFER & DOUBLE SAFETY
  // ==========================================
  describe('Accept Offer & Double Safety', () => {
    const userA: UserSession = { id: 'u1', name: 'Karim', email: 'karim@test.com', role: 'user', phone: '0555112233', wilaya: 'الجزائر', city: 'الجزائر الوسطى', createdAt: new Date().toISOString() };
    const userB: UserSession = { id: 'u2', name: 'Amine', email: 'amine@test.com', role: 'user', phone: '0555445566', wilaya: 'وهران', city: 'وهران', createdAt: new Date().toISOString() };
    
    const requestA: ServiceRequest = {
      id: 'req-1',
      clientId: 'u1',
      clientName: 'Karim',
      category: 'plumbing',
      title: 'تسرب مياه في المطبخ',
      description: 'يوجد تسرب تحت الحنفية الرئيسية',
      wilaya: 'الجزائر',
      city: 'الجزائر الوسطى',
      urgency: 'today',
      status: 'open',
      createdAt: new Date().toISOString(),
    };

    const offerA: ServiceOffer = {
      id: 'off-1',
      requestId: 'req-1',
      artisanId: 'art-1',
      artisanName: 'Mourad Plombier',
      proposedPrice: 2500,
      status: 'pending',
      createdAt: new Date().toISOString(),
    };

    const offerB: ServiceOffer = {
      id: 'off-2',
      requestId: 'req-1',
      artisanId: 'art-2',
      artisanName: 'Redouane Plombier',
      proposedPrice: 3000,
      status: 'pending',
      createdAt: new Date().toISOString(),
    };

    it('allows request owner to accept a pending offer on an open request', () => {
      expect(canAcceptOffer(userA, requestA, offerA)).toBe(true);
    });

    it('denies non-owner users from accepting offers', () => {
      expect(canAcceptOffer(userB, requestA, offerA)).toBe(false);
      expect(canAcceptOffer(null, requestA, offerA)).toBe(false);
    });

    it('denies accepting an offer if the request is already assigned or cancelled', () => {
      const assignedReq: ServiceRequest = { ...requestA, status: 'assigned', assignedArtisanId: 'art-2' };
      const cancelledReq: ServiceRequest = { ...requestA, status: 'cancelled' };

      expect(canAcceptOffer(userA, assignedReq, offerA)).toBe(false);
      expect(canAcceptOffer(userA, cancelledReq, offerA)).toBe(false);
    });

    it('correctly executes accept offer flow in repositories and auto-rejects competing offers', () => {
      serviceRequestRepository.create(requestA);
      serviceOfferRepository.create(offerA);
      serviceOfferRepository.create(offerB);

      // Verify initial repository state
      expect(serviceRequestRepository.getById('req-1')?.status).toBe('open');

      // Execute accept offer
      serviceOfferRepository.accept('off-1', 'req-1');
      serviceRequestRepository.updateStatus('req-1', 'assigned', {
        assignedArtisanId: 'art-1',
        assignedOfferId: 'off-1',
      });

      // Verify updated request
      const updatedReq = serviceRequestRepository.getById('req-1');
      expect(updatedReq?.status).toBe('assigned');
      expect(updatedReq?.assignedArtisanId).toBe('art-1');
      expect(updatedReq?.assignedOfferId).toBe('off-1');

      // Verify offer statuses (accepted for off-1, not_selected for off-2)
      const updatedOfferA = serviceOfferRepository.getById('off-1');
      const updatedOfferB = serviceOfferRepository.getById('off-2');
      expect(updatedOfferA?.status).toBe('accepted');
      expect(updatedOfferB?.status).toBe('not_selected');

      // Verify double-safety: fresh check on assigned request now returns false for any remaining offers
      expect(canAcceptOffer(userA, updatedReq!, updatedOfferB!)).toBe(false);
    });
  });

  // ==========================================
  // SECTION 3: ARTISAN MATCHING & OFFER RULES
  // ==========================================
  describe('Artisan Category Matching & Offer Validation', () => {
    const plumberArtisan: Artisan = {
      id: 'art-plumber',
      name: 'Yacine Plombier',
      profession: 'سباك (Plombier)',
      category: 'plumbing',
      wilaya: 'الجزائر',
      city: 'الجزائر الوسطى',
      phone: '0550112233',
      rating: 4.8,
      reviewCount: 15,
      startingPrice: 2000,
      avatar: '',
      availableTimes: '08:00 - 18:00',
      verified: true,
      experienceYears: 7,
      services: [],
      portfolio: [],
      reviews: [],
      bio: '',
    };

    const reqPlumbing: ServiceRequest = {
      id: 'req-p1',
      clientId: 'u-10',
      clientName: 'Sami',
      category: 'plumbing',
      title: 'إصلاح خزان المياه',
      description: 'تسريب في صمام الخزان العلوي',
      wilaya: 'الجزائر',
      city: 'الجزائر الوسطى',
      urgency: 'today',
      status: 'open',
      createdAt: new Date().toISOString(),
    };

    const reqElectrical: ServiceRequest = {
      id: 'req-e1',
      clientId: 'u-11',
      clientName: 'Nadia',
      category: 'electrical',
      title: 'عطل في القاطع الكهربائي',
      description: 'انقطاع التيار عن كامل الشقة',
      wilaya: 'الجزائر',
      city: 'الجزائر الوسطى',
      urgency: 'now',
      status: 'open',
      createdAt: new Date().toISOString(),
    };

    it('enforces category matching as a hard constraint for suitable artisan requests', () => {
      const allRequests = [reqPlumbing, reqElectrical];
      const matchedSuitable = matchRequestsForArtisan(allRequests, plumberArtisan, 'suitable');

      // Plumber must ONLY receive plumbing requests, electrical requests must be excluded
      expect(matchedSuitable.length).toBe(1);
      expect(matchedSuitable[0].id).toBe('req-p1');
      expect(matchedSuitable[0].category).toBe('plumbing');
    });

    it('allows artisans to view all platform requests when explicitly switching tab to all', () => {
      const allRequests = [reqPlumbing, reqElectrical];
      const matchedAll = matchRequestsForArtisan(allRequests, plumberArtisan, 'all');

      expect(matchedAll.length).toBe(2);
    });

    it('validates proposed offer prices correctly (price=0 for free consultation, price>0 valid, negative/invalid rejected)', () => {
      expect(validateServiceOfferPrice(0).isValid).toBe(true);
      expect(validateServiceOfferPrice(0).parsedPrice).toBe(0);

      expect(validateServiceOfferPrice('1500').isValid).toBe(true);
      expect(validateServiceOfferPrice('1500').parsedPrice).toBe(1500);

      expect(validateServiceOfferPrice('-500').isValid).toBe(false);
      expect(validateServiceOfferPrice('abc').isValid).toBe(false);
      expect(validateServiceOfferPrice('').isValid).toBe(false);
    });

    it('prevents artisan from submitting duplicate offers on the same request', () => {
      const artisanSession: UserSession = { id: 'art-plumber', name: 'Yacine Plombier', email: 'yacine@test.com', role: 'artisan', phone: '0550112233', wilaya: 'الجزائر', city: 'الجزائر الوسطى', createdAt: new Date().toISOString() };

      // No existing offer -> can submit
      expect(canSubmitOffer(artisanSession, reqPlumbing, plumberArtisan, [])).toBe(true);

      // Existing offer by same artisan -> cannot submit duplicate offer
      const existingOffer: ServiceOffer = {
        id: 'off-exist',
        requestId: 'req-p1',
        artisanId: 'art-plumber',
        artisanName: 'Yacine Plombier',
        proposedPrice: 2000,
        status: 'pending',
        createdAt: new Date().toISOString(),
      };

      expect(canSubmitOffer(artisanSession, reqPlumbing, plumberArtisan, [existingOffer])).toBe(false);
    });
  });

  // ==========================================
  // SECTION 4: AUTHORIZATION & CANCEL GUARDS
  // ==========================================
  describe('Authorization & Lifecycle Guards', () => {
    const owner: UserSession = { id: 'user-owner', name: 'Brahim', email: 'brahim@test.com', role: 'user', phone: '0555000000', wilaya: 'الجزائر', city: 'الشراقة', createdAt: new Date().toISOString() };
    const stranger: UserSession = { id: 'user-stranger', name: 'Omar', email: 'omar@test.com', role: 'user', phone: '0555111111', wilaya: 'الجزائر', city: 'الشراقة', createdAt: new Date().toISOString() };

    const openRequest: ServiceRequest = {
      id: 'req-life',
      clientId: 'user-owner',
      clientName: 'Brahim',
      category: 'carpentry',
      title: 'إصلاح باب خشب',
      description: 'الباب لا يغلق بشكل جيد',
      wilaya: 'الجزائر',
      city: 'الشراقة',
      urgency: 'flexible',
      status: 'open',
      createdAt: new Date().toISOString(),
    };

    it('allows owner to cancel or edit request when open or offers_received', () => {
      expect(canCancelServiceRequest(owner, openRequest)).toBe(true);
      expect(canEditServiceRequest(owner, openRequest)).toBe(true);

      const offersReceivedReq: ServiceRequest = { ...openRequest, status: 'offers_received' };
      expect(canCancelServiceRequest(owner, offersReceivedReq)).toBe(true);
      expect(canEditServiceRequest(owner, offersReceivedReq)).toBe(true);
    });

    it('denies strangers from cancelling or editing request', () => {
      expect(canCancelServiceRequest(stranger, openRequest)).toBe(false);
      expect(canEditServiceRequest(stranger, openRequest)).toBe(false);
    });

    it('denies cancelling assigned, completed, or cancelled requests', () => {
      expect(canCancelServiceRequest(owner, { ...openRequest, status: 'assigned' })).toBe(false);
      expect(canCancelServiceRequest(owner, { ...openRequest, status: 'completed' })).toBe(false);
      expect(canCancelServiceRequest(owner, { ...openRequest, status: 'cancelled' })).toBe(false);
    });
  });
});
