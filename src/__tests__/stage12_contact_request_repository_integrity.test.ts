import { describe, it, expect, beforeEach, vi } from 'vitest';
import { contactRequestRepository } from '../repositories/contactRequestRepository';
import { appLocalStorage } from '../repositories/storage';
import { ContactRequestStatus } from '../types';

describe('Stage 12 — ContactRequestRepository Integrity & Honest Persistence', () => {
  const STORAGE_KEY = 'bricojob_contact_requests_v1';

  beforeEach(() => {
    vi.restoreAllMocks();
    appLocalStorage.removeItem(STORAGE_KEY);
  });

  // 1. save() with successful storage -> returns request
  it('1. save() with successful storage returns new request with pending status and id', () => {
    const saved = contactRequestRepository.save({
      artisanId: 'art-10',
      artisanName: 'Karim',
      customerId: 'user-1',
      customerName: 'Ahmed',
      customerPhone: '0550123456',
      service: 'إصلاح تسرب',
      description: 'تسرب في الحمام',
      preferredContact: 'phone',
    });

    expect(saved).toBeDefined();
    expect(saved.id).toBeDefined();
    expect(saved.status).toBe('pending');
    expect(saved.artisanId).toBe('art-10');

    const all = contactRequestRepository.getAll();
    expect(all).toHaveLength(1);
    expect(all[0].id).toBe(saved.id);
  });

  // 2. save() when setItem() returns false -> fails and does not return false success
  it('2. save() when setItem() returns false throws an error and does not report false success', () => {
    vi.spyOn(appLocalStorage, 'setItem').mockReturnValue(false);

    expect(() => {
      contactRequestRepository.save({
        artisanId: 'art-10',
        artisanName: 'Karim',
        customerId: 'user-1',
        customerName: 'Ahmed',
        customerPhone: '0550123456',
        service: 'إصلاح تسرب',
        description: 'تسرب في الحمام',
        preferredContact: 'phone',
      });
    }).toThrow('Failed to persist contact request to storage');
  });

  // 3. updateStatus(id, 'pending') -> success
  it('3. updateStatus(id, "pending") transitions handled request back to pending successfully', () => {
    const saved = contactRequestRepository.save({
      artisanId: 'art-10',
      artisanName: 'Karim',
      customerId: 'user-1',
      customerName: 'Ahmed',
      customerPhone: '0550123456',
      service: 'إصلاح تسرب',
      description: 'تسرب في الحمام',
      preferredContact: 'phone',
    });

    // Mark as handled first
    contactRequestRepository.updateStatus(saved.id, 'handled');
    expect(contactRequestRepository.getAll()[0].status).toBe('handled');

    // Update back to pending
    const result = contactRequestRepository.updateStatus(saved.id, 'pending');
    expect(result).toBe(true);
    expect(contactRequestRepository.getAll()[0].status).toBe('pending');
  });

  // 4. updateStatus(id, 'handled') -> success
  it('4. updateStatus(id, "handled") updates pending request to handled successfully', () => {
    const saved = contactRequestRepository.save({
      artisanId: 'art-10',
      artisanName: 'Karim',
      customerId: 'user-1',
      customerName: 'Ahmed',
      customerPhone: '0550123456',
      service: 'إصلاح تسرب',
      description: 'تسرب في الحمام',
      preferredContact: 'phone',
    });

    const result = contactRequestRepository.updateStatus(saved.id, 'handled');
    expect(result).toBe(true);
    expect(contactRequestRepository.getAll()[0].status).toBe('handled');
  });

  // 5. updateStatus(id, null) -> rejected
  it('5. updateStatus(id, null) is rejected and returns false', () => {
    const saved = contactRequestRepository.save({
      artisanId: 'art-10',
      artisanName: 'Karim',
      customerId: 'user-1',
      customerName: 'Ahmed',
      customerPhone: '0550123456',
      service: 'إصلاح تسرب',
      description: 'تسرب في الحمام',
      preferredContact: 'phone',
    });

    const result = contactRequestRepository.updateStatus(saved.id, null as unknown as ContactRequestStatus);
    expect(result).toBe(false);
    expect(contactRequestRepository.getAll()[0].status).toBe('pending');
  });

  // 6. updateStatus(id, undefined) -> rejected
  it('6. updateStatus(id, undefined) is rejected and returns false', () => {
    const saved = contactRequestRepository.save({
      artisanId: 'art-10',
      artisanName: 'Karim',
      customerId: 'user-1',
      customerName: 'Ahmed',
      customerPhone: '0550123456',
      service: 'إصلاح تسرب',
      description: 'تسرب في الحمام',
      preferredContact: 'phone',
    });

    const result = contactRequestRepository.updateStatus(saved.id, undefined as unknown as ContactRequestStatus);
    expect(result).toBe(false);
    expect(contactRequestRepository.getAll()[0].status).toBe('pending');
  });

  // 7. unknown status -> rejected
  it('7. unknown status is rejected and returns false without modifying storage', () => {
    const saved = contactRequestRepository.save({
      artisanId: 'art-10',
      artisanName: 'Karim',
      customerId: 'user-1',
      customerName: 'Ahmed',
      customerPhone: '0550123456',
      service: 'إصلاح تسرب',
      description: 'تسرب في الحمام',
      preferredContact: 'phone',
    });

    const result = contactRequestRepository.updateStatus(saved.id, 'closed' as unknown as ContactRequestStatus);
    expect(result).toBe(false);
    expect(contactRequestRepository.getAll()[0].status).toBe('pending');
  });

  // 8. عند رفض status غير صالح -> لا يحدث أي persistence
  it('8. on invalid status rejection, setItem is not called for mutation', () => {
    const saved = contactRequestRepository.save({
      artisanId: 'art-10',
      artisanName: 'Karim',
      customerId: 'user-1',
      customerName: 'Ahmed',
      customerPhone: '0550123456',
      service: 'إصلاح تسرب',
      description: 'تسرب في الحمام',
      preferredContact: 'phone',
    });

    const setItemSpy = vi.spyOn(appLocalStorage, 'setItem');
    const result = contactRequestRepository.updateStatus(saved.id, 'invalid_status' as unknown as ContactRequestStatus);

    expect(result).toBe(false);
    expect(setItemSpy).not.toHaveBeenCalled();
  });

  // 9. existing request data لا تتغير عند فشل التحديث
  it('9. existing request fields remain unchanged when updateStatus fails', () => {
    const saved = contactRequestRepository.save({
      artisanId: 'art-10',
      artisanName: 'Karim',
      customerId: 'user-1',
      customerName: 'Ahmed',
      customerPhone: '0550123456',
      service: 'إصلاح تسرب',
      description: 'تسرب في الحمام',
      preferredContact: 'phone',
    });

    // Attempt invalid status update
    contactRequestRepository.updateStatus(saved.id, 'random_status' as unknown as ContactRequestStatus);

    const after = contactRequestRepository.getAll()[0];
    expect(after.id).toBe(saved.id);
    expect(after.artisanId).toBe('art-10');
    expect(after.artisanName).toBe('Karim');
    expect(after.customerId).toBe('user-1');
    expect(after.customerName).toBe('Ahmed');
    expect(after.customerPhone).toBe('0550123456');
    expect(after.service).toBe('إصلاح تسرب');
    expect(after.description).toBe('تسرب في الحمام');
    expect(after.preferredContact).toBe('phone');
    expect(after.status).toBe('pending');
  });

  // 10. legacy "clientId" compatibility تبقى كما هي
  it('10. legacy clientId read compatibility remains intact', () => {
    const legacyItem = {
      id: 'req_legacy_99',
      artisanId: 'art-20',
      artisanName: 'Mustapha',
      clientId: 'legacy-client-xyz',
      customerName: 'Said',
      service: 'صيانة مكيف',
      description: 'تنظيف الوحدة الداخلية',
      preferredContact: 'whatsapp',
      createdAt: '2026-01-01T12:00:00.000Z',
      status: 'pending',
    };

    appLocalStorage.setItem(STORAGE_KEY, [legacyItem]);

    const retrieved = contactRequestRepository.getByCustomer('legacy-client-xyz');
    expect(retrieved).toHaveLength(1);
    expect(retrieved[0].id).toBe('req_legacy_99');
    expect(retrieved[0].customerId).toBe('legacy-client-xyz');
    expect(retrieved[0].artisanId).toBe('art-20');
  });
});
