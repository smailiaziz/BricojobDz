import { describe, it, expect, beforeEach } from 'vitest';
import { orderRepository, serviceRequestRepository, serviceOfferRepository } from '../repositories';
import { appLocalStorage } from '../repositories/storage';
import {
  createOrderFromAcceptedOffer,
  filterUserOrders,
  filterArtisanOrders,
  isOrderEligibleForReview,
  hasCompletedOrderWithArtisan,
  isValidOrderStateTransition,
  isValidOrderPrice,
  acceptOfferAndCreateOrder
} from '../domain/orders';
import { canViewOrder, canStartJob, canCompleteJob, canAccessOrder } from '../domain/authorization';
import { ServiceOffer, ServiceRequest, UserSession, Artisan, OrderStatus } from '../types';

describe('Stage 6 — Order / Job Lifecycle Integrity & Hardening', () => {
  const STORAGE_KEY = 'bricojob_orders';

  const mockUserClient: UserSession = {
    id: 'client_user_1',
    name: 'أحمد علي',
    email: 'ahmed@example.com',
    phone: '0550123456',
    role: 'user',
    createdAt: '2026-09-17T10:00:00Z'
  };

  const mockUserArtisan: UserSession = {
    id: 'artisan_user_1',
    name: 'كريم السباك',
    email: 'kareem@example.com',
    phone: '0660987654',
    role: 'artisan',
    artisanId: 'artisan_profile_1',
    createdAt: '2026-09-17T10:00:00Z'
  };

  const mockArtisan: Artisan = {
    id: 'artisan_profile_1',
    name: 'كريم السباك',
    profession: 'سباك',
    category: 'plumbing',
    wilaya: 'الجزائر',
    city: 'باب الزوار',
    phone: '0660987654',
    rating: 4.8,
    reviewCount: 12,
    startingPrice: 2000,
    avatar: 'https://images.unsplash.com/photo-1540569014015-19a7be504e3a',
    verified: true,
    experienceYears: 5,
    bio: 'خبرة طويلة في السباكة',
    services: ['تصليح التسربات'],
    portfolio: [],
    reviews: [],
    availableTimes: 'طوال اليوم',
    availableNow: true
  };

  const mockRequest: ServiceRequest = {
    id: 'req_100',
    clientId: 'client_user_1',
    clientName: 'أحمد علي',
    clientPhone: '0550123456',
    title: 'تصليح تسرب في المطبخ',
    category: 'plumbing',
    description: 'يوجد تسرب في أنبوب المياه تحت الحوض',
    wilaya: 'الجزائر',
    city: 'باب الزوار',
    urgency: 'today',
    status: 'assigned',
    createdAt: '2026-09-17T10:00:00Z'
  };

  const mockOffer: ServiceOffer = {
    id: 'offer_200',
    requestId: 'req_100',
    artisanId: 'artisan_profile_1',
    artisanName: 'كريم السباك',
    artisanProfession: 'سباك',
    proposedPrice: 3500,
    status: 'accepted',
    createdAt: '2026-09-17T10:15:00Z'
  };

  beforeEach(() => {
    appLocalStorage.removeItem(STORAGE_KEY);
    appLocalStorage.removeItem('bricojob_service_requests');
    appLocalStorage.removeItem('bricojob_service_offers');
  });

  describe('1. State Transition Matrix', () => {
    const transitionMatrix: Array<{ from: OrderStatus; to: OrderStatus; expected: boolean }> = [
      { from: 'assigned', to: 'in_progress', expected: true },
      { from: 'in_progress', to: 'completed', expected: true },
      { from: 'assigned', to: 'completed', expected: false },
      { from: 'assigned', to: 'assigned', expected: false },
      { from: 'in_progress', to: 'assigned', expected: false },
      { from: 'completed', to: 'assigned', expected: false },
      { from: 'completed', to: 'in_progress', expected: false },
      { from: 'completed', to: 'completed', expected: false },
      { from: 'cancelled', to: 'assigned', expected: false },
      { from: 'cancelled', to: 'in_progress', expected: false },
      { from: 'cancelled', to: 'completed', expected: false },
      { from: 'pending' as OrderStatus, to: 'in_progress', expected: true },
    ];

    transitionMatrix.forEach(({ from, to, expected }) => {
      it(`transition from ${from} to ${to} should be ${expected ? 'ALLOWED' : 'DENIED'}`, () => {
        expect(isValidOrderStateTransition(from, to)).toBe(expected);
      });
    });

    it('denies transition for unknown/invalid statuses', () => {
      expect(isValidOrderStateTransition('unknown' as OrderStatus, 'assigned')).toBe(false);
      expect(isValidOrderStateTransition('assigned', 'unknown' as OrderStatus)).toBe(false);
    });

    it('enforces transition rules at orderRepository.updateStatus level', () => {
      const order = createOrderFromAcceptedOffer(mockRequest, mockOffer)!;
      expect(order.status).toBe('assigned');

      // Illegal transition assigned -> completed at repository level MUST be DENIED
      const directComplete = orderRepository.updateStatus(order.id, 'completed');
      expect(directComplete).toBe(false);
      expect(orderRepository.getById(order.id)?.status).toBe('assigned');

      // Legal transition assigned -> in_progress MUST succeed
      const startJob = orderRepository.updateStatus(order.id, 'in_progress');
      expect(startJob).toBe(true);
      expect(orderRepository.getById(order.id)?.status).toBe('in_progress');

      // Illegal transition in_progress -> assigned MUST be DENIED
      const revertAssigned = orderRepository.updateStatus(order.id, 'assigned');
      expect(revertAssigned).toBe(false);
      expect(orderRepository.getById(order.id)?.status).toBe('in_progress');

      // Legal transition in_progress -> completed MUST succeed
      const completeJob = orderRepository.updateStatus(order.id, 'completed');
      expect(completeJob).toBe(true);
      expect(orderRepository.getById(order.id)?.status).toBe('completed');

      // Terminal state check: completed -> any transition MUST be DENIED
      const completeToInProgress = orderRepository.updateStatus(order.id, 'in_progress');
      expect(completeToInProgress).toBe(false);
      expect(orderRepository.getById(order.id)?.status).toBe('completed');
    });
  });

  describe('2. Legacy "pending" Handling', () => {
    it('allows reading legacy pending orders safely', () => {
      const legacyOrder = {
        id: 'ord-legacy-1',
        artisanId: 'artisan_profile_1',
        clientId: 'client_user_1',
        status: 'pending',
        proposedPrice: 1500,
        createdAt: '2026-01-01T00:00:00Z',
      };
      appLocalStorage.setItem(STORAGE_KEY, [legacyOrder]);

      const retrieved = orderRepository.getById('ord-legacy-1');
      expect(retrieved).not.toBeNull();
      expect(retrieved?.status).toBe('pending');
      expect(retrieved?.proposedPrice).toBe(1500);
    });

    it('prevents creating NEW orders with pending status', () => {
      const newPendingOrder = {
        id: 'ord-new-pending',
        artisanId: 'artisan_profile_1',
        artisanName: 'كريم السباك',
        clientId: 'client_user_1',
        status: 'pending' as OrderStatus,
        proposedPrice: 2000,
        createdAt: new Date().toISOString(),
      };
      const saved = orderRepository.save(newPendingOrder);
      expect(saved).toBe(false);
      expect(orderRepository.getById('ord-new-pending')).toBeNull();
    });

    it('creates new orders from accepted offers as "assigned"', () => {
      const order = createOrderFromAcceptedOffer(mockRequest, mockOffer)!;
      expect(order.status).toBe('assigned');
    });
  });

  describe('3. Price Integrity', () => {
    it('validates prices correctly according to domain rules', () => {
      expect(isValidOrderPrice(0)).toBe(true);
      expect(isValidOrderPrice(1000)).toBe(true);
      expect(isValidOrderPrice(3500.50)).toBe(true);
      expect(isValidOrderPrice(-1)).toBe(false);
      expect(isValidOrderPrice(NaN)).toBe(false);
      expect(isValidOrderPrice(Infinity)).toBe(false);
      expect(isValidOrderPrice('-invalid')).toBe(false);
      expect(isValidOrderPrice(null)).toBe(false);
      expect(isValidOrderPrice(undefined)).toBe(false);
    });

    it('preserves proposedPrice === 0 and does not convert to null or fallback', () => {
      const freeOffer: ServiceOffer = { ...mockOffer, proposedPrice: 0 };
      const order = createOrderFromAcceptedOffer(mockRequest, freeOffer)!;

      expect(order).not.toBeNull();
      expect(order.proposedPrice).toBe(0);
      expect(order.proposedPrice).not.toBeNull();
      expect(order.proposedPrice).not.toBe(3500);
    });

    it('rejects order creation if proposedPrice is invalid (no silent zero conversion)', () => {
      const invalidOffer1: ServiceOffer = { ...mockOffer, proposedPrice: -500 };
      const order1 = createOrderFromAcceptedOffer(mockRequest, invalidOffer1);
      expect(order1).toBeNull();

      const invalidOffer2: ServiceOffer = { ...mockOffer, proposedPrice: NaN };
      const order2 = createOrderFromAcceptedOffer(mockRequest, invalidOffer2);
      expect(order2).toBeNull();
    });
  });

  describe('4. Order Creation & Idempotency', () => {
    it('creates exactly one Order from an accepted offer and is idempotent on repeat calls', () => {
      const order1 = createOrderFromAcceptedOffer(mockRequest, mockOffer)!;
      expect(order1).not.toBeNull();
      expect(orderRepository.getAll().length).toBe(1);

      const order2 = createOrderFromAcceptedOffer(mockRequest, mockOffer)!;
      expect(order2.id).toBe(order1.id);
      expect(orderRepository.getAll().length).toBe(1);
    });
  });

  describe('5. Cross-Resource Mismatch & Canonical Relationships', () => {
    it('denies order creation if offer.requestId does not match request.id', () => {
      const mismatchedOffer: ServiceOffer = { ...mockOffer, requestId: 'req_999_wrong' };
      const order = createOrderFromAcceptedOffer(mockRequest, mismatchedOffer);
      expect(order).toBeNull();
    });

    it('denies order creation if request is not in assigned state', () => {
      const openRequest: ServiceRequest = { ...mockRequest, status: 'open' };
      const order = createOrderFromAcceptedOffer(openRequest, mockOffer);
      expect(order).toBeNull();
    });

    it('denies order creation if offer is not in accepted state', () => {
      const pendingOffer: ServiceOffer = { ...mockOffer, status: 'pending' };
      const order = createOrderFromAcceptedOffer(mockRequest, pendingOffer);
      expect(order).toBeNull();
    });
  });

  describe('6. Ownership & Authorization Guards', () => {
    it('enforces strict ID-only ownership for orders', () => {
      const order = createOrderFromAcceptedOffer(mockRequest, mockOffer)!;

      // Client owner can access order
      expect(canAccessOrder(mockUserClient, order)).toBe(true);

      // Foreign client with matching name/email cannot access order
      const fraudClient: UserSession = {
        id: 'client_user_fraud',
        name: 'أحمد علي', // Same name
        email: 'ahmed@example.com', // Same email
        role: 'user',
        createdAt: '2026-09-17T10:00:00Z'
      };
      expect(canAccessOrder(fraudClient, order)).toBe(false);
      expect(filterUserOrders([order], fraudClient.id, fraudClient.email).length).toBe(0);
    });

    it('only permits designated artisan to manage job lifecycle', () => {
      const order = createOrderFromAcceptedOffer(mockRequest, mockOffer)!;

      const foreignArtisanUser: UserSession = {
        id: 'artisan_user_2',
        name: 'حسن الكهربائي',
        email: 'hassan@example.com',
        role: 'artisan',
        artisanId: 'artisan_profile_2',
        createdAt: '2026-09-17T10:00:00Z'
      };
      const foreignArtisanProfile: Artisan = { ...mockArtisan, id: 'artisan_profile_2' };

      expect(canStartJob(foreignArtisanUser, order, foreignArtisanProfile)).toBe(false);
      expect(canStartJob(mockUserArtisan, order, mockArtisan)).toBe(true);
    });
  });

  describe('7. Atomic Offer Acceptance & Partial Failure Handling', () => {
    it('executes atomic offer acceptance successfully with re-fetched fresh data', () => {
      const openReq: ServiceRequest = { ...mockRequest, status: 'open' };
      const pendingOff: ServiceOffer = { ...mockOffer, status: 'pending' };

      serviceRequestRepository.create(openReq);
      serviceOfferRepository.create(pendingOff);

      const result = acceptOfferAndCreateOrder(mockUserClient, openReq.id, pendingOff.id);

      expect(result.success).toBe(true);
      expect(result.order).toBeDefined();
      expect(result.order?.requestId).toBe(openReq.id);
      expect(result.order?.offerId).toBe(pendingOff.id);
      expect(result.order?.status).toBe('assigned');

      // Verify DB state
      const updatedReq = serviceRequestRepository.getById(openReq.id);
      expect(updatedReq?.status).toBe('assigned');
      expect(updatedReq?.assignedOfferId).toBe(pendingOff.id);

      const updatedOffer = serviceOfferRepository.getById(pendingOff.id);
      expect(updatedOffer?.status).toBe('accepted');
    });

    it('denies atomic acceptance if client is not the owner of the request', () => {
      const openReq: ServiceRequest = { ...mockRequest, status: 'open' };
      const pendingOff: ServiceOffer = { ...mockOffer, status: 'pending' };

      serviceRequestRepository.create(openReq);
      serviceOfferRepository.create(pendingOff);

      const otherUser: UserSession = { ...mockUserClient, id: 'user_other' };
      const result = acceptOfferAndCreateOrder(otherUser, openReq.id, pendingOff.id);

      expect(result.success).toBe(false);
      expect(result.error).toBe('NOT_REQUEST_OWNER');
    });

    it('denies atomic acceptance if offer proposedPrice is negative or NaN', () => {
      const openReq: ServiceRequest = { ...mockRequest, status: 'open' };
      const invalidOff: ServiceOffer = { ...mockOffer, status: 'pending', proposedPrice: -100 };

      serviceRequestRepository.create(openReq);
      serviceOfferRepository.create(invalidOff);

      const result = acceptOfferAndCreateOrder(mockUserClient, openReq.id, invalidOff.id);

      expect(result.success).toBe(false);
      expect(result.error).toBe('INVALID_PROPOSED_PRICE');
    });
  });
});
