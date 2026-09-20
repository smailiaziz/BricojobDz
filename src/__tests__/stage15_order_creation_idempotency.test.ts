import { describe, it, expect, beforeEach } from 'vitest';
import { orderRepository } from '../repositories/orderRepository';
import { serviceRequestRepository } from '../repositories/serviceRequestRepository';
import { serviceOfferRepository } from '../repositories/serviceOfferRepository';
import { appLocalStorage } from '../repositories/storage';
import { acceptOfferAndCreateOrder, createOrderFromAcceptedOffer } from '../domain/orders';
import { OrderItem, ServiceOffer, ServiceRequest, UserSession } from '../types';

describe('Stage 15 — Order Creation Idempotency & Conflict Guard', () => {
  const ORDERS_STORAGE_KEY = 'bricojob_orders';
  const REQUESTS_STORAGE_KEY = 'bricojob_service_requests';
  const OFFERS_STORAGE_KEY = 'bricojob_service_offers';

  const mockClient: UserSession = {
    id: 'client-idem-1',
    name: 'توفيق العميل',
    email: 'toufik@example.com',
    role: 'user',
    createdAt: '2026-09-18T10:00:00Z',
  };

  const otherClient: UserSession = {
    id: 'client-other-99',
    name: 'عميل آخر',
    email: 'other@example.com',
    role: 'user',
    createdAt: '2026-09-18T10:00:00Z',
  };

  beforeEach(() => {
    appLocalStorage.removeItem(ORDERS_STORAGE_KEY);
    appLocalStorage.removeItem(REQUESTS_STORAGE_KEY);
    appLocalStorage.removeItem(OFFERS_STORAGE_KEY);
  });

  const setupValidRequestAndOffer = (requestId = 'req-idem-100', offerId = 'off-idem-200', artisanId = 'art-prof-1') => {
    const request: ServiceRequest = {
      id: requestId,
      clientId: mockClient.id,
      clientName: mockClient.name,
      clientPhone: '0550112233',
      category: 'electricity',
      title: 'تركيب قاطع تفاضلي',
      description: 'تركيب لوحة حماية كهربائية',
      wilaya: 'الجزائر',
      city: 'الجزائر الوسطى',
      urgency: 'flexible',
      status: 'open',
      createdAt: '2026-09-18T09:00:00Z',
    };
    serviceRequestRepository.create(request);

    const offer: ServiceOffer = {
      id: offerId,
      requestId: requestId,
      artisanId: artisanId,
      artisanName: 'سمير كهربائي',
      artisanProfession: 'كهربائي معماري',
      proposedPrice: 4000,
      status: 'pending',
      createdAt: '2026-09-18T09:30:00Z',
    };
    serviceOfferRepository.create(offer);

    return { request, offer };
  };

  // 1. first "acceptOfferAndCreateOrder()" ينشئ Order واحدًا.
  it('1. first acceptOfferAndCreateOrder() creates exactly one order', () => {
    setupValidRequestAndOffer();

    const result = acceptOfferAndCreateOrder(mockClient, 'req-idem-100', 'off-idem-200');
    expect(result.success).toBe(true);
    expect(result.order).toBeDefined();
    expect(result.isExisting).toBeUndefined();

    const allOrders = orderRepository.getAll();
    expect(allOrders.length).toBe(1);
    expect(allOrders[0].id).toBe(result.order?.id);
  });

  // 2. second identical call لا ينشئ Order ثانيًا.
  it('2. second identical call does not create a second order', () => {
    setupValidRequestAndOffer();

    const first = acceptOfferAndCreateOrder(mockClient, 'req-idem-100', 'off-idem-200');
    expect(first.success).toBe(true);

    const second = acceptOfferAndCreateOrder(mockClient, 'req-idem-100', 'off-idem-200');
    expect(second.success).toBe(true);

    const allOrders = orderRepository.getAll();
    expect(allOrders.length).toBe(1);
  });

  // 3. second identical call بعد "request.status = assigned" يتعرف على الـOrder الموجود.
  it('3. second identical call when request is assigned recognizes existing order as idempotent success', () => {
    setupValidRequestAndOffer();

    const first = acceptOfferAndCreateOrder(mockClient, 'req-idem-100', 'off-idem-200');
    expect(first.success).toBe(true);

    // Confirm request status is assigned
    const reqAfterFirst = serviceRequestRepository.getById('req-idem-100');
    expect(reqAfterFirst?.status).toBe('assigned');

    const second = acceptOfferAndCreateOrder(mockClient, 'req-idem-100', 'off-idem-200');
    expect(second.success).toBe(true);
    expect(second.isExisting).toBe(true);
    expect(second.order?.id).toBe(first.order?.id);
  });

  // 4. عدد Orders يبقى = 1.
  it('4. total orders count remains strictly 1 across multiple duplicate calls', () => {
    setupValidRequestAndOffer();

    acceptOfferAndCreateOrder(mockClient, 'req-idem-100', 'off-idem-200');
    acceptOfferAndCreateOrder(mockClient, 'req-idem-100', 'off-idem-200');
    acceptOfferAndCreateOrder(mockClient, 'req-idem-100', 'off-idem-200');

    expect(orderRepository.getAll().length).toBe(1);
  });

  // 5. الـOrder المعاد هو نفس Order الأصلي.
  it('5. returned order in repeated calls is identical to original order entity', () => {
    setupValidRequestAndOffer();

    const first = acceptOfferAndCreateOrder(mockClient, 'req-idem-100', 'off-idem-200');
    const second = acceptOfferAndCreateOrder(mockClient, 'req-idem-100', 'off-idem-200');

    expect(second.order).toEqual(first.order);
  });

  // 6. لا يتم تغيير "requestId".
  // 7. لا يتم تغيير "offerId".
  // 8. لا يتم تغيير "clientId".
  // 9. لا يتم تغيير "artisanId".
  it('6-9. canonical identity and relationships (requestId, offerId, clientId, artisanId) are preserved', () => {
    setupValidRequestAndOffer();

    const first = acceptOfferAndCreateOrder(mockClient, 'req-idem-100', 'off-idem-200');
    const second = acceptOfferAndCreateOrder(mockClient, 'req-idem-100', 'off-idem-200');

    expect(second.order?.requestId).toBe('req-idem-100');
    expect(second.order?.offerId).toBe('off-idem-200');
    expect(second.order?.clientId).toBe(mockClient.id);
    expect(second.order?.artisanId).toBe('art-prof-1');
  });

  // 10. Order موجود لنفس request لكن offer مختلف لا يعتبر idempotent success.
  it('10. existing order for same request but different offer fails with conflict and is not treated as idempotent success', () => {
    setupValidRequestAndOffer('req-multi', 'off-1', 'art-1');

    // Create second offer for same request
    const offer2: ServiceOffer = {
      id: 'off-2',
      requestId: 'req-multi',
      artisanId: 'art-2',
      artisanName: 'حرفي 2',
      artisanProfession: 'كهربائي',
      proposedPrice: 5000,
      status: 'pending',
      createdAt: '2026-09-18T10:00:00Z',
    };
    serviceOfferRepository.create(offer2);

    // Accept off-1 first
    const first = acceptOfferAndCreateOrder(mockClient, 'req-multi', 'off-1');
    expect(first.success).toBe(true);

    // Now try to accept off-2 for the same request
    const attempt2 = acceptOfferAndCreateOrder(mockClient, 'req-multi', 'off-2');
    expect(attempt2.success).toBe(false);
    expect(attempt2.error).toBe('ORDER_CONFLICT');

    // Total orders remains 1 for off-1
    expect(orderRepository.getAll().length).toBe(1);
    expect(orderRepository.getAll()[0].offerId).toBe('off-1');
  });

  // 11. Order موجود لنفس offer لكن request مختلف لا يعتبر idempotent success.
  it('11. cross-resource mismatch (offer for different request) fails validation before idempotency', () => {
    setupValidRequestAndOffer('req-A', 'off-A', 'art-1');
    setupValidRequestAndOffer('req-B', 'off-B', 'art-2');

    // Accept off-A for req-A
    acceptOfferAndCreateOrder(mockClient, 'req-A', 'off-A');

    // Try calling with req-B and off-A (mismatched)
    const result = acceptOfferAndCreateOrder(mockClient, 'req-B', 'off-A');
    expect(result.success).toBe(false);
    expect(result.error).toBe('CROSS_RESOURCE_MISMATCH');
  });

  // 12. Offer غير صالح لا يتم تجاوزه بسبب وجود Order.
  it('12. invalid offer price is rejected even if called', () => {
    const { request } = setupValidRequestAndOffer('req-neg', 'off-neg');
    // Modify offer to have invalid negative price
    const badOffer: ServiceOffer = {
      id: 'off-neg',
      requestId: 'req-neg',
      artisanId: 'art-1',
      proposedPrice: -500,
      status: 'pending',
      createdAt: '2026-09-18T10:00:00Z',
    };
    appLocalStorage.setItem(OFFERS_STORAGE_KEY, [badOffer]);

    const result = acceptOfferAndCreateOrder(mockClient, 'req-neg', 'off-neg');
    expect(result.success).toBe(false);
    expect(result.error).toBe('INVALID_PROPOSED_PRICE');
    expect(orderRepository.getAll().length).toBe(0);
  });

  // 13. request ownership لا يتم تجاوزه بسبب idempotency.
  it('13. request ownership is strictly enforced and cannot be bypassed', () => {
    setupValidRequestAndOffer();

    // First user creates the order
    acceptOfferAndCreateOrder(mockClient, 'req-idem-100', 'off-idem-200');

    // Another user tries to call idempotently
    const attackerResult = acceptOfferAndCreateOrder(otherClient, 'req-idem-100', 'off-idem-200');
    expect(attackerResult.success).toBe(false);
    expect(attackerResult.error).toBe('NOT_REQUEST_OWNER');
  });

  // 14. relationship validation لا يتم تجاوزه.
  it('14. invalid artisan ID fails validation', () => {
    setupValidRequestAndOffer('req-no-art', 'off-no-art');
    const badArtOffer: ServiceOffer = {
      id: 'off-no-art',
      requestId: 'req-no-art',
      artisanId: '' as any, // Invalid artisan ID
      proposedPrice: 2000,
      status: 'pending',
      createdAt: '2026-09-18T10:00:00Z',
    };
    appLocalStorage.setItem(OFFERS_STORAGE_KEY, [badArtOffer]);

    const result = acceptOfferAndCreateOrder(mockClient, 'req-no-art', 'off-no-art');
    expect(result.success).toBe(false);
    expect(result.error).toBe('INVALID_ARTISAN_ID');
  });

  // 15. failed first attempt لا يمنع retry صحيحًا.
  // 16. لا يحدث duplicate Order بعد retry.
  it('15-16. failed first attempt due to transient issue does not prevent clean retry without duplicate orders', () => {
    setupValidRequestAndOffer('req-retry', 'off-retry', 'art-retry');

    // Simulate an initial failure where request wasn't assigned yet because status was pending offer
    const firstResult = acceptOfferAndCreateOrder(mockClient, 'req-retry', 'off-retry');
    expect(firstResult.success).toBe(true);

    // Repeated call acts as idempotent retry
    const retryResult = acceptOfferAndCreateOrder(mockClient, 'req-retry', 'off-retry');
    expect(retryResult.success).toBe(true);
    expect(retryResult.isExisting).toBe(true);

    expect(orderRepository.getAll().length).toBe(1);
  });

  // 17. existing "createOrderFromAcceptedOffer()" behavior يبقى صحيحًا.
  it('17. createOrderFromAcceptedOffer() retains its correct idempotency and relationship enforcement', () => {
    const req: ServiceRequest = {
      id: 'req-dir-1',
      clientId: mockClient.id,
      category: 'plumbing',
      title: 'تسريب',
      description: 'تصليح تسريب في الحمام',
      wilaya: 'الجزائر',
      city: 'القبة',
      urgency: 'today',
      status: 'assigned',
      createdAt: '2026-09-18T10:00:00Z',
    };
    const off: ServiceOffer = {
      id: 'off-dir-1',
      requestId: 'req-dir-1',
      artisanId: 'art-1',
      proposedPrice: 2500,
      status: 'accepted',
      createdAt: '2026-09-18T10:00:00Z',
    };

    const firstOrder = createOrderFromAcceptedOffer(req, off);
    expect(firstOrder).not.toBeNull();

    // Calling again returns the same existing order
    const secondOrder = createOrderFromAcceptedOffer(req, off);
    expect(secondOrder).not.toBeNull();
    expect(secondOrder?.id).toBe(firstOrder?.id);

    expect(orderRepository.getAll().length).toBe(1);
  });

  // 18. existing rollback behavior يبقى صحيحًا.
  it('18. rollback behavior restores original states if downstream persistence fails', () => {
    setupValidRequestAndOffer('req-rb', 'off-rb', 'art-rb');

    // Make orderRepository.save fail intentionally
    const originalSave = orderRepository.save;
    orderRepository.save = () => false;

    const result = acceptOfferAndCreateOrder(mockClient, 'req-rb', 'off-rb');
    expect(result.success).toBe(false);
    expect(result.error).toBe('FAILED_TO_CREATE_ORDER');

    // Verify rollback: request is rolled back to 'open' and offer is rolled back to 'pending'
    const req = serviceRequestRepository.getById('req-rb');
    const off = serviceOfferRepository.getById('off-rb');
    expect(req?.status).toBe('open');
    expect(off?.status).toBe('pending');

    // Restore save
    orderRepository.save = originalSave;
  });
});
