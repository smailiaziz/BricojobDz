import { describe, it, expect, beforeEach } from 'vitest';
import { serviceOfferRepository, serviceRequestRepository, orderRepository } from '../repositories';
import { appLocalStorage } from '../repositories/storage';
import { isValidServiceOfferTransition } from '../domain/serviceRequests';
import { acceptOfferAndCreateOrder } from '../domain/orders';
import { ServiceOffer, ServiceRequest, UserSession } from '../types';

describe('Stage 10 — Service Offer Lifecycle & not_selected Hardening', () => {
  const OFFERS_KEY = 'bricojob_service_offers';
  const REQUESTS_KEY = 'bricojob_service_requests';
  const ORDERS_KEY = 'bricojob_orders';

  const mockUser: UserSession = {
    id: 'client-1',
    name: 'العميل',
    email: 'client@test.com',
    role: 'user',
    createdAt: new Date().toISOString(),
  };

  const mockRequest: ServiceRequest = {
    id: 'req-1',
    clientId: 'client-1',
    category: 'plumbing',
    title: 'تصليح تسرب',
    description: 'تسرب في الحمام',
    wilaya: 'الجزائر',
    city: 'باب الزوار',
    urgency: 'now',
    status: 'open',
    createdAt: new Date().toISOString(),
  };

  beforeEach(() => {
    appLocalStorage.removeItem(OFFERS_KEY);
    appLocalStorage.removeItem(REQUESTS_KEY);
    appLocalStorage.removeItem(ORDERS_KEY);
  });

  // 1 & 2 & 3 & 4: Offer selection, not_selected for competitors, withdrawn untouched, no new rejected
  it('Requirement 1, 2, 3, 4: accept() transitions target to accepted, competitors to not_selected, leaves withdrawn untouched, and creates no rejected', () => {
    const offerA: ServiceOffer = {
      id: 'off-A',
      requestId: 'req-1',
      artisanId: 'art-1',
      proposedPrice: 2000,
      status: 'pending',
      createdAt: new Date().toISOString(),
    };
    const offerB: ServiceOffer = {
      id: 'off-B',
      requestId: 'req-1',
      artisanId: 'art-2',
      proposedPrice: 2500,
      status: 'pending',
      createdAt: new Date().toISOString(),
    };
    const offerC: ServiceOffer = {
      id: 'off-C',
      requestId: 'req-1',
      artisanId: 'art-3',
      proposedPrice: 3000,
      status: 'withdrawn',
      createdAt: new Date().toISOString(),
    };

    serviceOfferRepository.create(offerA);
    serviceOfferRepository.create(offerB);
    serviceOfferRepository.create(offerC);

    const success = serviceOfferRepository.accept('off-A', 'req-1');
    expect(success).toBe(true);

    const all = serviceOfferRepository.getByRequestId('req-1');
    const updatedA = all.find(o => o.id === 'off-A');
    const updatedB = all.find(o => o.id === 'off-B');
    const updatedC = all.find(o => o.id === 'off-C');

    // 1: pending -> accepted
    expect(updatedA?.status).toBe('accepted');
    // 2: pending -> not_selected
    expect(updatedB?.status).toBe('not_selected');
    // 3: withdrawn -> withdrawn
    expect(updatedC?.status).toBe('withdrawn');
    // 4: No new rejected created
    expect(all.some(o => o.status === 'rejected')).toBe(false);
  });

  // 5: Legacy rejected records remain readable
  it('Requirement 5: legacy records with status rejected remain readable and intact', () => {
    const legacyOffer: ServiceOffer = {
      id: 'off-legacy',
      requestId: 'req-1',
      artisanId: 'art-legacy',
      proposedPrice: 1500,
      status: 'rejected',
      createdAt: '2026-01-01T00:00:00Z',
    };
    const activeOffer: ServiceOffer = {
      id: 'off-active',
      requestId: 'req-1',
      artisanId: 'art-active',
      proposedPrice: 1800,
      status: 'pending',
      createdAt: new Date().toISOString(),
    };

    appLocalStorage.setItem(OFFERS_KEY, [legacyOffer, activeOffer]);

    const retrievedLegacy = serviceOfferRepository.getById('off-legacy');
    expect(retrievedLegacy).not.toBeNull();
    expect(retrievedLegacy?.status).toBe('rejected');

    // Accepting active offer does not mutate legacy rejected offer
    serviceOfferRepository.accept('off-active', 'req-1');
    const afterAcceptLegacy = serviceOfferRepository.getById('off-legacy');
    expect(afterAcceptLegacy?.status).toBe('rejected');
  });

  // 6: Cannot have two accepted offers for the same request through accept()
  it('Requirement 6: cannot accept another offer if target is not pending / request already assigned', () => {
    const offer1: ServiceOffer = {
      id: 'off-1',
      requestId: 'req-1',
      artisanId: 'art-1',
      proposedPrice: 1000,
      status: 'pending',
      createdAt: new Date().toISOString(),
    };
    const offer2: ServiceOffer = {
      id: 'off-2',
      requestId: 'req-1',
      artisanId: 'art-2',
      proposedPrice: 1200,
      status: 'pending',
      createdAt: new Date().toISOString(),
    };

    serviceOfferRepository.create(offer1);
    serviceOfferRepository.create(offer2);

    expect(serviceOfferRepository.accept('off-1', 'req-1')).toBe(true);
    // offer2 is now 'not_selected', which cannot transition to 'accepted'
    expect(serviceOfferRepository.accept('off-2', 'req-1')).toBe(false);

    const all = serviceOfferRepository.getByRequestId('req-1');
    const acceptedCount = all.filter(o => o.status === 'accepted').length;
    expect(acceptedCount).toBe(1);
  });

  // 7: not_selected cannot be transitioned back to pending via normal transition
  it('Requirement 7: not_selected is a terminal state and cannot transition back to pending or any other status', () => {
    expect(isValidServiceOfferTransition('not_selected', 'pending')).toBe(false);
    expect(isValidServiceOfferTransition('not_selected', 'accepted')).toBe(false);
    expect(isValidServiceOfferTransition('not_selected', 'rejected')).toBe(false);
    expect(isValidServiceOfferTransition('not_selected', 'withdrawn')).toBe(false);
    expect(isValidServiceOfferTransition('not_selected', 'not_selected')).toBe(true);
  });

  // 8: withdrawn remains terminal
  it('Requirement 8: withdrawn remains terminal', () => {
    expect(isValidServiceOfferTransition('withdrawn', 'pending')).toBe(false);
    expect(isValidServiceOfferTransition('withdrawn', 'accepted')).toBe(false);
    expect(isValidServiceOfferTransition('withdrawn', 'not_selected')).toBe(false);
    expect(isValidServiceOfferTransition('withdrawn', 'rejected')).toBe(false);
    expect(isValidServiceOfferTransition('withdrawn', 'withdrawn')).toBe(true);
  });

  // 9: Offer not belonging to request has its acceptance rejected
  it('Requirement 9: offer not belonging to the request is rejected by accept()', () => {
    const offerOtherReq: ServiceOffer = {
      id: 'off-other',
      requestId: 'req-2-different',
      artisanId: 'art-1',
      proposedPrice: 2000,
      status: 'pending',
      createdAt: new Date().toISOString(),
    };
    serviceOfferRepository.create(offerOtherReq);

    const result = serviceOfferRepository.accept('off-other', 'req-1');
    expect(result).toBe(false);
    expect(serviceOfferRepository.getById('off-other')?.status).toBe('pending');
  });

  // 10: IDs do not change during status updates (id, requestId, artisanId)
  it('Requirement 10: IDs remain immutable during accept() and rollbackAcceptance()', () => {
    const offer: ServiceOffer = {
      id: 'off-immutable-1',
      requestId: 'req-1',
      artisanId: 'art-immutable-1',
      proposedPrice: 3000,
      status: 'pending',
      createdAt: new Date().toISOString(),
    };
    serviceOfferRepository.create(offer);

    serviceOfferRepository.accept('off-immutable-1', 'req-1');
    const accepted = serviceOfferRepository.getById('off-immutable-1');
    expect(accepted?.id).toBe('off-immutable-1');
    expect(accepted?.requestId).toBe('req-1');
    expect(accepted?.artisanId).toBe('art-immutable-1');

    serviceOfferRepository.rollbackAcceptance('off-immutable-1', 'req-1');
    const rolledBack = serviceOfferRepository.getById('off-immutable-1');
    expect(rolledBack?.id).toBe('off-immutable-1');
    expect(rolledBack?.requestId).toBe('req-1');
    expect(rolledBack?.artisanId).toBe('art-immutable-1');
  });

  // 11: Rollback test
  it('Requirement 11: rollbackAcceptance reverts accepted -> pending and not_selected -> pending, while preserving withdrawn and legacy rejected', () => {
    const offerA: ServiceOffer = {
      id: 'off-A',
      requestId: 'req-1',
      artisanId: 'art-1',
      proposedPrice: 1000,
      status: 'pending',
      createdAt: new Date().toISOString(),
    };
    const offerB: ServiceOffer = {
      id: 'off-B',
      requestId: 'req-1',
      artisanId: 'art-2',
      proposedPrice: 1500,
      status: 'pending',
      createdAt: new Date().toISOString(),
    };
    const offerC: ServiceOffer = {
      id: 'off-C',
      requestId: 'req-1',
      artisanId: 'art-3',
      proposedPrice: 2000,
      status: 'withdrawn',
      createdAt: new Date().toISOString(),
    };
    const offerD: ServiceOffer = {
      id: 'off-D',
      requestId: 'req-1',
      artisanId: 'art-4',
      proposedPrice: 2500,
      status: 'rejected', // legacy rejected
      createdAt: '2026-01-01T00:00:00Z',
    };

    serviceOfferRepository.create(offerA);
    serviceOfferRepository.create(offerB);
    serviceOfferRepository.create(offerC);
    serviceOfferRepository.create(offerD);

    // Accept A
    expect(serviceOfferRepository.accept('off-A', 'req-1')).toBe(true);
    expect(serviceOfferRepository.getById('off-A')?.status).toBe('accepted');
    expect(serviceOfferRepository.getById('off-B')?.status).toBe('not_selected');
    expect(serviceOfferRepository.getById('off-C')?.status).toBe('withdrawn');
    expect(serviceOfferRepository.getById('off-D')?.status).toBe('rejected');

    // Rollback acceptance of A
    expect(serviceOfferRepository.rollbackAcceptance('off-A', 'req-1')).toBe(true);
    expect(serviceOfferRepository.getById('off-A')?.status).toBe('pending');
    expect(serviceOfferRepository.getById('off-B')?.status).toBe('pending');
    expect(serviceOfferRepository.getById('off-C')?.status).toBe('withdrawn');
    expect(serviceOfferRepository.getById('off-D')?.status).toBe('rejected');
  });

  it('Precise Rollback: only reverts offers converted to not_selected during the current accept(), preserving pre-existing not_selected, withdrawn, and rejected', () => {
    // Before accept:
    // A = pending
    // B = not_selected (pre-existing)
    // C = pending
    // D = withdrawn
    // E = rejected
    const offerA: ServiceOffer = {
      id: 'off-A',
      requestId: 'req-1',
      artisanId: 'art-1',
      proposedPrice: 1000,
      status: 'pending',
      createdAt: new Date().toISOString(),
    };
    const offerB: ServiceOffer = {
      id: 'off-B',
      requestId: 'req-1',
      artisanId: 'art-2',
      proposedPrice: 1500,
      status: 'not_selected',
      createdAt: '2026-01-01T00:00:00Z',
    };
    const offerC: ServiceOffer = {
      id: 'off-C',
      requestId: 'req-1',
      artisanId: 'art-3',
      proposedPrice: 2000,
      status: 'pending',
      createdAt: new Date().toISOString(),
    };
    const offerD: ServiceOffer = {
      id: 'off-D',
      requestId: 'req-1',
      artisanId: 'art-4',
      proposedPrice: 2500,
      status: 'withdrawn',
      createdAt: new Date().toISOString(),
    };
    const offerE: ServiceOffer = {
      id: 'off-E',
      requestId: 'req-1',
      artisanId: 'art-5',
      proposedPrice: 3000,
      status: 'rejected',
      createdAt: '2026-01-01T00:00:00Z',
    };

    // Store in repo
    appLocalStorage.setItem(OFFERS_KEY, [offerA, offerB, offerC, offerD, offerE]);

    // After accept(A):
    // A = accepted
    // B = not_selected
    // C = not_selected
    // D = withdrawn
    // E = rejected
    expect(serviceOfferRepository.accept('off-A', 'req-1')).toBe(true);
    expect(serviceOfferRepository.getById('off-A')?.status).toBe('accepted');
    expect(serviceOfferRepository.getById('off-B')?.status).toBe('not_selected');
    expect(serviceOfferRepository.getById('off-C')?.status).toBe('not_selected');
    expect(serviceOfferRepository.getById('off-D')?.status).toBe('withdrawn');
    expect(serviceOfferRepository.getById('off-E')?.status).toBe('rejected');

    // After rollback:
    // A = pending
    // B = not_selected (CRITICAL: remains not_selected because it was not changed by accept(A))
    // C = pending (reverted because accept(A) changed it from pending -> not_selected)
    // D = withdrawn
    // E = rejected
    expect(serviceOfferRepository.rollbackAcceptance('off-A', 'req-1')).toBe(true);
    expect(serviceOfferRepository.getById('off-A')?.status).toBe('pending');
    expect(serviceOfferRepository.getById('off-B')?.status).toBe('not_selected');
    expect(serviceOfferRepository.getById('off-C')?.status).toBe('pending');
    expect(serviceOfferRepository.getById('off-D')?.status).toBe('withdrawn');
    expect(serviceOfferRepository.getById('off-E')?.status).toBe('rejected');
  });

  it('Requirement 11 (atomic domain integration): acceptOfferAndCreateOrder rolls back cleanly on downstream failure', () => {
    serviceRequestRepository.create(mockRequest);

    const offerA: ServiceOffer = {
      id: 'off-A',
      requestId: 'req-1',
      artisanId: 'art-1',
      proposedPrice: 1000,
      status: 'pending',
      createdAt: new Date().toISOString(),
    };
    const offerB: ServiceOffer = {
      id: 'off-B',
      requestId: 'req-1',
      artisanId: 'art-2',
      proposedPrice: 1200,
      status: 'pending',
      createdAt: new Date().toISOString(),
    };
    const offerC: ServiceOffer = {
      id: 'off-C',
      requestId: 'req-1',
      artisanId: 'art-3',
      proposedPrice: 1400,
      status: 'withdrawn',
      createdAt: new Date().toISOString(),
    };

    serviceOfferRepository.create(offerA);
    serviceOfferRepository.create(offerB);
    serviceOfferRepository.create(offerC);

    // Break request state machine so assigning fails
    // (e.g. setting request status to 'completed' which is terminal, right before assign)
    // Here we can test rollback by trying to accept when request transition is disallowed
    // Or we test rollback directly with a mocked failure
    const originalUpdateStatus = serviceRequestRepository.updateStatus;
    serviceRequestRepository.updateStatus = () => false;

    const result = acceptOfferAndCreateOrder(mockUser, 'req-1', 'off-A');
    expect(result.success).toBe(false);
    expect(result.error).toBe('FAILED_TO_ASSIGN_REQUEST');

    // Verify atomic rollback
    expect(serviceOfferRepository.getById('off-A')?.status).toBe('pending');
    expect(serviceOfferRepository.getById('off-B')?.status).toBe('pending');
    expect(serviceOfferRepository.getById('off-C')?.status).toBe('withdrawn');

    // Restore method
    serviceRequestRepository.updateStatus = originalUpdateStatus;
  });

  // 12: Artisan who did not submit an offer does not get not_selected
  it('Requirement 12: artisans without an offer for the request are not affected', () => {
    const offerForReq1: ServiceOffer = {
      id: 'off-req1',
      requestId: 'req-1',
      artisanId: 'art-1',
      proposedPrice: 1000,
      status: 'pending',
      createdAt: new Date().toISOString(),
    };
    const offerForReq2: ServiceOffer = {
      id: 'off-req2',
      requestId: 'req-2',
      artisanId: 'art-2',
      proposedPrice: 2000,
      status: 'pending',
      createdAt: new Date().toISOString(),
    };

    serviceOfferRepository.create(offerForReq1);
    serviceOfferRepository.create(offerForReq2);

    serviceOfferRepository.accept('off-req1', 'req-1');

    // Offer for req-2 (artisan 2) remains pending and untouched
    expect(serviceOfferRepository.getById('off-req2')?.status).toBe('pending');
    expect(serviceOfferRepository.getByArtisanId('art-3')).toEqual([]);
  });
});
