import { describe, it, expect, beforeEach } from 'vitest';
import { serviceRequestRepository } from '../repositories/serviceRequestRepository';
import { serviceOfferRepository } from '../repositories/serviceOfferRepository';
import { appLocalStorage } from '../repositories/storage';
import { ServiceRequest, ServiceOffer, ServiceRequestStatus, ServiceOfferStatus } from '../types';

describe('Stage 11 — Repository Update Hardening (ServiceRequest & ServiceOffer)', () => {
  const REQUESTS_KEY = 'bricojob_service_requests';
  const OFFERS_KEY = 'bricojob_service_offers';

  beforeEach(() => {
    appLocalStorage.removeItem(REQUESTS_KEY);
    appLocalStorage.removeItem(OFFERS_KEY);
  });

  const getMockRequest = (overrides: Partial<ServiceRequest> = {}): ServiceRequest => ({
    id: 'req-101',
    clientId: 'client-real-id',
    clientName: 'Aziz',
    category: 'plumbing',
    title: 'Water Leak',
    description: 'Pipe leaking under kitchen sink',
    wilaya: 'الجزائر',
    city: 'باب الزوار',
    urgency: 'now',
    status: 'open',
    createdAt: new Date().toISOString(),
    ...overrides,
  });

  const getMockOffer = (overrides: Partial<ServiceOffer> = {}): ServiceOffer => ({
    id: 'off-101',
    requestId: 'req-101',
    artisanId: 'art-real-id',
    proposedPrice: 2500,
    message: 'I can fix it today',
    status: 'pending',
    createdAt: new Date().toISOString(),
    ...overrides,
  });

  describe('ServiceRequestRepository.updateStatus', () => {
    // 1. valid transition succeeds
    it('1. valid transition succeeds (open -> offers_received)', () => {
      const req = getMockRequest({ status: 'open' });
      serviceRequestRepository.create(req);

      const result = serviceRequestRepository.updateStatus(req.id, 'offers_received');
      expect(result).toBe(true);

      const updated = serviceRequestRepository.getById(req.id);
      expect(updated?.status).toBe('offers_received');
    });

    // 2. invalid transition fails
    it('2. invalid transition fails (open -> completed)', () => {
      const req = getMockRequest({ status: 'open' });
      serviceRequestRepository.create(req);

      const result = serviceRequestRepository.updateStatus(req.id, 'completed');
      expect(result).toBe(false);

      const updated = serviceRequestRepository.getById(req.id);
      expect(updated?.status).toBe('open');
    });

    // 3. "status: null" fails
    it('3. status: null fails', () => {
      const req = getMockRequest({ status: 'open' });
      serviceRequestRepository.create(req);

      const result = serviceRequestRepository.updateStatus(req.id, null as unknown as ServiceRequestStatus);
      expect(result).toBe(false);

      const updated = serviceRequestRepository.getById(req.id);
      expect(updated?.status).toBe('open');
    });

    // 4. "status: undefined" fails
    it('4. status: undefined fails', () => {
      const req = getMockRequest({ status: 'open' });
      serviceRequestRepository.create(req);

      const result = serviceRequestRepository.updateStatus(req.id, undefined as unknown as ServiceRequestStatus);
      expect(result).toBe(false);

      const updated = serviceRequestRepository.getById(req.id);
      expect(updated?.status).toBe('open');
    });

    // 5. unknown status fails
    it('5. unknown status fails', () => {
      const req = getMockRequest({ status: 'open' });
      serviceRequestRepository.create(req);

      const result = serviceRequestRepository.updateStatus(req.id, 'super_assigned' as unknown as ServiceRequestStatus);
      expect(result).toBe(false);

      const updated = serviceRequestRepository.getById(req.id);
      expect(updated?.status).toBe('open');
    });

    // 6. محاولة تغيير "clientId" داخل "extra" لا تغيّر "clientId"
    it('6. attempting to mutate clientId inside extra does not change clientId', () => {
      const req = getMockRequest({ status: 'open', clientId: 'client-real-id' });
      serviceRequestRepository.create(req);

      const result = serviceRequestRepository.updateStatus(req.id, 'offers_received', {
        clientId: 'hijacked-client-id',
      } as Partial<ServiceRequest>);
      expect(result).toBe(true);

      const updated = serviceRequestRepository.getById(req.id);
      expect(updated?.clientId).toBe('client-real-id');
      expect(updated?.status).toBe('offers_received');
    });

    // 7. محاولة تغيير "id" داخل "extra" لا تغيّر "id"
    it('7. attempting to mutate id inside extra does not change id', () => {
      const req = getMockRequest({ status: 'open', id: 'req-101' });
      serviceRequestRepository.create(req);

      const result = serviceRequestRepository.updateStatus(req.id, 'offers_received', {
        id: 'hijacked-request-id',
      } as Partial<ServiceRequest>);
      expect(result).toBe(true);

      const updated = serviceRequestRepository.getById('req-101');
      expect(updated).not.toBeNull();
      expect(updated?.id).toBe('req-101');
      expect(serviceRequestRepository.getById('hijacked-request-id')).toBeNull();
    });

    // 8. عند فشل العملية لا يحدث partial persistence
    it('8. on failed transition or invalid status, no partial persistence occurs from extra', () => {
      const req = getMockRequest({
        status: 'open',
        description: 'Original description',
        assignedArtisanId: undefined,
      });
      serviceRequestRepository.create(req);

      // Attempt invalid transition with extra fields
      const result = serviceRequestRepository.updateStatus(req.id, 'completed', {
        description: 'Modified description during failed attempt',
        assignedArtisanId: 'art-fake',
      });
      expect(result).toBe(false);

      const persisted = serviceRequestRepository.getById(req.id);
      expect(persisted?.status).toBe('open');
      expect(persisted?.description).toBe('Original description');
      expect(persisted?.assignedArtisanId).toBeUndefined();
    });
  });

  describe('ServiceOfferRepository.update', () => {
    // 9. valid status transition succeeds
    it('9. valid status transition succeeds (pending -> withdrawn)', () => {
      const offer = getMockOffer({ status: 'pending' });
      serviceOfferRepository.create(offer);

      const result = serviceOfferRepository.update({
        id: offer.id,
        status: 'withdrawn',
      } as ServiceOffer);
      expect(result).toBe(true);

      const updated = serviceOfferRepository.getById(offer.id);
      expect(updated?.status).toBe('withdrawn');
    });

    // 10. "status: null" fails
    it('10. status: null fails', () => {
      const offer = getMockOffer({ status: 'pending' });
      serviceOfferRepository.create(offer);

      const result = serviceOfferRepository.update({
        id: offer.id,
        status: null as unknown as ServiceOfferStatus,
      } as ServiceOffer);
      expect(result).toBe(false);

      const updated = serviceOfferRepository.getById(offer.id);
      expect(updated?.status).toBe('pending');
    });

    // 11. "status: undefined" fails
    it('11. status: undefined fails', () => {
      const offer = getMockOffer({ status: 'pending' });
      serviceOfferRepository.create(offer);

      const result = serviceOfferRepository.update({
        id: offer.id,
        status: undefined as unknown as ServiceOfferStatus,
      } as ServiceOffer);
      expect(result).toBe(false);

      const updated = serviceOfferRepository.getById(offer.id);
      expect(updated?.status).toBe('pending');
    });

    // 12. unknown status fails
    it('12. unknown status fails', () => {
      const offer = getMockOffer({ status: 'pending' });
      serviceOfferRepository.create(offer);

      const result = serviceOfferRepository.update({
        id: offer.id,
        status: 'accepted_forever' as unknown as ServiceOfferStatus,
      } as ServiceOffer);
      expect(result).toBe(false);

      const updated = serviceOfferRepository.getById(offer.id);
      expect(updated?.status).toBe('pending');
    });

    // 13. "requestId" mutation remains rejected
    it('13. requestId mutation remains rejected', () => {
      const offer = getMockOffer({ requestId: 'req-101' });
      serviceOfferRepository.create(offer);

      const result = serviceOfferRepository.update({
        id: offer.id,
        requestId: 'req-hijacked-999',
        proposedPrice: 3000,
      } as ServiceOffer);
      expect(result).toBe(false);

      const updated = serviceOfferRepository.getById(offer.id);
      expect(updated?.requestId).toBe('req-101');
      expect(updated?.proposedPrice).toBe(2500);
    });

    // 14. "artisanId" mutation remains rejected
    it('14. artisanId mutation remains rejected', () => {
      const offer = getMockOffer({ artisanId: 'art-real-id' });
      serviceOfferRepository.create(offer);

      const result = serviceOfferRepository.update({
        id: offer.id,
        artisanId: 'art-hijacked-999',
        proposedPrice: 3500,
      } as ServiceOffer);
      expect(result).toBe(false);

      const updated = serviceOfferRepository.getById(offer.id);
      expect(updated?.artisanId).toBe('art-real-id');
      expect(updated?.proposedPrice).toBe(2500);
    });

    // 15. "id" remains immutable
    it('15. id remains immutable even if update object contains matching id with valid partial edits', () => {
      const offer = getMockOffer({ id: 'off-101', proposedPrice: 2500 });
      serviceOfferRepository.create(offer);

      const result = serviceOfferRepository.update({
        id: 'off-101',
        proposedPrice: 3200,
      } as ServiceOffer);
      expect(result).toBe(true);

      const updated = serviceOfferRepository.getById('off-101');
      expect(updated?.id).toBe('off-101');
      expect(updated?.proposedPrice).toBe(3200);
    });
  });
});
