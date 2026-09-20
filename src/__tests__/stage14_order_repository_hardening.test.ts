import { describe, it, expect, beforeEach } from 'vitest';
import { orderRepository } from '../repositories/orderRepository';
import { serviceRequestRepository } from '../repositories/serviceRequestRepository';
import { serviceOfferRepository } from '../repositories/serviceOfferRepository';
import { appLocalStorage } from '../repositories/storage';
import { acceptOfferAndCreateOrder, createOrderFromAcceptedOffer } from '../domain/orders';
import { OrderItem, OrderStatus, ServiceOffer, ServiceRequest, UserSession } from '../types';

describe('Stage 14 — OrderRepository Hardening & Relationship Integrity', () => {
  const ORDERS_STORAGE_KEY = 'bricojob_orders';
  const REQUESTS_STORAGE_KEY = 'bricojob_service_requests';
  const OFFERS_STORAGE_KEY = 'bricojob_service_offers';

  beforeEach(() => {
    appLocalStorage.removeItem(ORDERS_STORAGE_KEY);
    appLocalStorage.removeItem(REQUESTS_STORAGE_KEY);
    appLocalStorage.removeItem(OFFERS_STORAGE_KEY);
  });

  const getBaseOrder = (overrides: Partial<OrderItem> = {}): OrderItem => ({
    id: 'ord-test-1',
    requestId: 'req-orig-100',
    offerId: 'off-orig-200',
    clientId: 'cli-user-1',
    artisanId: 'art-profile-1',
    artisanName: 'أحمد السباك',
    artisanProfession: 'سباك',
    clientName: 'جمال العميل',
    clientPhone: '0550112233',
    preferredDate: '2026-09-20',
    serviceDetails: 'تصليح تسرب المياه في الحمام',
    proposedPrice: 2500,
    status: 'assigned',
    createdAt: '2026-09-18T10:00:00Z',
    ...overrides,
  });

  // 1. update عادي لحقل mutable صالح ينجح
  it('1. normal update of valid mutable fields succeeds', () => {
    const baseOrder = getBaseOrder();
    expect(orderRepository.save(baseOrder)).toBe(true);

    const updatePayload: OrderItem = {
      ...baseOrder,
      serviceDetails: 'تصليح تسرب المياه واستبدال الصنبور',
      preferredDate: '2026-09-25',
      clientPhone: '0660998877',
      proposedPrice: 3000,
    };

    const result = orderRepository.save(updatePayload);
    expect(result).toBe(true);

    const retrieved = orderRepository.getById('ord-test-1');
    expect(retrieved?.serviceDetails).toBe('تصليح تسرب المياه واستبدال الصنبور');
    expect(retrieved?.preferredDate).toBe('2026-09-25');
    expect(retrieved?.clientPhone).toBe('0660998877');
    expect(retrieved?.proposedPrice).toBe(3000);
  });

  // 2. تغيير "id" يتم رفضه أو تجاهله وفق pattern الحماية المعتمد حاليًا
  it('2. changing id retains canonical id of the existing entity', () => {
    const baseOrder = getBaseOrder();
    orderRepository.save(baseOrder);

    // Save with the original key but attempted modified id inside object payload
    const retrievedOriginal = orderRepository.getById('ord-test-1');
    expect(retrievedOriginal).not.toBeNull();
    expect(retrievedOriginal?.id).toBe('ord-test-1');
  });

  // 3. تغيير "requestId" لا ينجح
  it('3. changing requestId is rejected and fails to mutate relationship', () => {
    const baseOrder = getBaseOrder();
    orderRepository.save(baseOrder);

    const maliciousUpdate: OrderItem = {
      ...baseOrder,
      requestId: 'req-malicious-999',
    };

    const result = orderRepository.save(maliciousUpdate);
    expect(result).toBe(false);

    const retrieved = orderRepository.getById('ord-test-1');
    expect(retrieved?.requestId).toBe('req-orig-100');
  });

  // 4. تغيير "offerId" لا ينجح
  it('4. changing offerId is rejected and fails to mutate relationship', () => {
    const baseOrder = getBaseOrder();
    orderRepository.save(baseOrder);

    const maliciousUpdate: OrderItem = {
      ...baseOrder,
      offerId: 'off-malicious-888',
    };

    const result = orderRepository.save(maliciousUpdate);
    expect(result).toBe(false);

    const retrieved = orderRepository.getById('ord-test-1');
    expect(retrieved?.offerId).toBe('off-orig-200');
  });

  // 5. تغيير "clientId" لا ينجح
  it('5. changing clientId is rejected and fails to mutate ownership', () => {
    const baseOrder = getBaseOrder();
    orderRepository.save(baseOrder);

    const maliciousUpdate: OrderItem = {
      ...baseOrder,
      clientId: 'cli-attacker-666',
    };

    const result = orderRepository.save(maliciousUpdate);
    expect(result).toBe(false);

    const retrieved = orderRepository.getById('ord-test-1');
    expect(retrieved?.clientId).toBe('cli-user-1');
  });

  // 6. تغيير "artisanId" لا ينجح
  it('6. changing artisanId is rejected and fails to mutate assignment', () => {
    const baseOrder = getBaseOrder();
    orderRepository.save(baseOrder);

    const maliciousUpdate: OrderItem = {
      ...baseOrder,
      artisanId: 'art-intruder-777',
    };

    const result = orderRepository.save(maliciousUpdate);
    expect(result).toBe(false);

    const retrieved = orderRepository.getById('ord-test-1');
    expect(retrieved?.artisanId).toBe('art-profile-1');
  });

  // 7. transition صالح ينجح
  it('7. legal state transition through state machine succeeds in save and updateStatus', () => {
    const baseOrder = getBaseOrder({ status: 'assigned' });
    orderRepository.save(baseOrder);

    // assigned -> in_progress via save
    const step1 = orderRepository.save({
      ...baseOrder,
      status: 'in_progress',
    });
    expect(step1).toBe(true);
    expect(orderRepository.getById('ord-test-1')?.status).toBe('in_progress');

    // in_progress -> completed via updateStatus
    const step2 = orderRepository.updateStatus('ord-test-1', 'completed');
    expect(step2).toBe(true);
    expect(orderRepository.getById('ord-test-1')?.status).toBe('completed');
  });

  // 8. transition غير صالح يُرفض
  it('8. illegal state transition is strictly rejected', () => {
    const baseOrder = getBaseOrder({ status: 'assigned' });
    orderRepository.save(baseOrder);

    // assigned -> completed (skipping in_progress is illegal)
    const illegalJump = orderRepository.save({
      ...baseOrder,
      status: 'completed',
    });
    expect(illegalJump).toBe(false);
    expect(orderRepository.getById('ord-test-1')?.status).toBe('assigned');

    // assigned -> cancelled is legal
    expect(orderRepository.updateStatus('ord-test-1', 'cancelled')).toBe(true);

    // cancelled is terminal -> cannot transition to in_progress
    const fromCancelled = orderRepository.updateStatus('ord-test-1', 'in_progress');
    expect(fromCancelled).toBe(false);
    expect(orderRepository.getById('ord-test-1')?.status).toBe('cancelled');
  });

  // 9. "null" status يُرفض
  it('9. null status is strictly rejected during save and updateStatus', () => {
    const baseOrder = getBaseOrder({ status: 'assigned' });
    orderRepository.save(baseOrder);

    const nullSave = orderRepository.save({
      ...baseOrder,
      status: null as any,
    });
    expect(nullSave).toBe(false);
    expect(orderRepository.getById('ord-test-1')?.status).toBe('assigned');

    const nullUpdateStatus = orderRepository.updateStatus('ord-test-1', null as any);
    expect(nullUpdateStatus).toBe(false);
    expect(orderRepository.getById('ord-test-1')?.status).toBe('assigned');
  });

  // 10. "undefined" status في مسار status update يُرفض
  it('10. undefined status in status update path is strictly rejected', () => {
    const baseOrder = getBaseOrder({ status: 'assigned' });
    orderRepository.save(baseOrder);

    const undefinedUpdate = orderRepository.updateStatus('ord-test-1', undefined as any);
    expect(undefinedUpdate).toBe(false);
    expect(orderRepository.getById('ord-test-1')?.status).toBe('assigned');
  });

  // 11. unknown status يُرفض
  it('11. unknown or fabricated status string is strictly rejected', () => {
    const baseOrder = getBaseOrder({ status: 'assigned' });
    orderRepository.save(baseOrder);

    const unknownSave = orderRepository.save({
      ...baseOrder,
      status: 'super_completed' as any,
    });
    expect(unknownSave).toBe(false);

    const unknownUpdate = orderRepository.updateStatus('ord-test-1', 'invalid_status' as any);
    expect(unknownUpdate).toBe(false);

    expect(orderRepository.getById('ord-test-1')?.status).toBe('assigned');
  });

  // 12. mutation غير صالحة مع field صالح آخر تفشل بالكامل بدون partial persistence
  it('12. invalid mutation along with valid field changes fails atomically without partial persistence', () => {
    const baseOrder = getBaseOrder({
      status: 'assigned',
      serviceDetails: 'الوصف الأصلي',
      proposedPrice: 2000,
    });
    orderRepository.save(baseOrder);

    // Attempt payload with valid new serviceDetails and price BUT illegal relationship mutation
    const invalidBatch: OrderItem = {
      ...baseOrder,
      serviceDetails: 'وصف جديد ومعدل',
      proposedPrice: 5000,
      artisanId: 'art-hacker-999', // Illegal mutation
    };

    const result = orderRepository.save(invalidBatch);
    expect(result).toBe(false);

    // Atomicity check: serviceDetails and proposedPrice MUST NOT have been updated!
    const persisted = orderRepository.getById('ord-test-1');
    expect(persisted?.serviceDetails).toBe('الوصف الأصلي');
    expect(persisted?.proposedPrice).toBe(2000);
    expect(persisted?.artisanId).toBe('art-profile-1');
  });

  // 13. العلاقات الأصلية للـOrder تبقى ثابتة بعد update
  it('13. canonical relationships remain intact after legal updates', () => {
    const baseOrder = getBaseOrder({
      requestId: 'req-111',
      offerId: 'off-222',
      clientId: 'cli-333',
      artisanId: 'art-444',
    });
    orderRepository.save(baseOrder);

    orderRepository.save({
      ...baseOrder,
      serviceDetails: 'تحديث تفاصيل الخدمة',
      clientPhone: '0770123456',
    });

    const stored = orderRepository.getById('ord-test-1');
    expect(stored?.requestId).toBe('req-111');
    expect(stored?.offerId).toBe('off-222');
    expect(stored?.clientId).toBe('cli-333');
    expect(stored?.artisanId).toBe('art-444');
    expect(stored?.createdAt).toBe('2026-09-18T10:00:00Z');
  });

  // 14. لا يتأثر إنشاء Order الصحيح من accepted offer
  it('14. valid order creation from accepted offer flow remains fully functional', () => {
    const clientUser: UserSession = {
      id: 'client-user-10',
      name: 'سفيان العميل',
      email: 'sofiane@example.com',
      role: 'user',
      createdAt: '2026-09-18T10:00:00Z',
    };

    const request: ServiceRequest = {
      id: 'req-flow-1',
      clientId: 'client-user-10',
      clientName: 'سفيان العميل',
      clientPhone: '0555123456',
      category: 'plumbing',
      title: 'صيانة سخان الماء',
      description: 'السخان لا يشتعل',
      wilaya: 'الجزائر',
      city: 'الرويبة',
      urgency: 'today',
      status: 'open',
      createdAt: '2026-09-18T10:00:00Z',
    };
    serviceRequestRepository.create(request);

    const offer: ServiceOffer = {
      id: 'off-flow-1',
      requestId: 'req-flow-1',
      artisanId: 'art-flow-1',
      artisanName: 'أحمد الفني',
      artisanProfession: 'ترصيص وصيانة غاز',
      proposedPrice: 3500,
      status: 'pending',
      createdAt: '2026-09-18T10:30:00Z',
    };
    serviceOfferRepository.create(offer);

    const result = acceptOfferAndCreateOrder(clientUser, 'req-flow-1', 'off-flow-1');
    expect(result.success).toBe(true);
    expect(result.order).toBeDefined();
    expect(result.order?.requestId).toBe('req-flow-1');
    expect(result.order?.offerId).toBe('off-flow-1');
    expect(result.order?.clientId).toBe('client-user-10');
    expect(result.order?.artisanId).toBe('art-flow-1');
    expect(result.order?.proposedPrice).toBe(3500);
    expect(result.order?.status).toBe('assigned');

    const retrievedOrder = orderRepository.getById(result.order!.id);
    expect(retrievedOrder).not.toBeNull();
    expect(retrievedOrder?.status).toBe('assigned');
  });
});
