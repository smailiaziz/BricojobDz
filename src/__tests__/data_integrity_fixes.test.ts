import { describe, it, expect, beforeEach } from 'vitest';
import { orderRepository } from '../repositories/orderRepository';
import { serviceOfferRepository } from '../repositories/serviceOfferRepository';
import { serviceRequestRepository } from '../repositories/serviceRequestRepository';
import { appLocalStorage } from '../repositories/storage';
import { OrderItem, OrderStatus, ServiceRequest, ServiceOffer } from '../types';

describe('BricojobDz - Data Integrity & Isolation Regression Tests', () => {
  beforeEach(() => {
    // Clear relevant storage keys to isolate tests
    appLocalStorage.removeItem('bricojob_orders');
    appLocalStorage.removeItem('bricojob_service_offers');
    appLocalStorage.removeItem('bricojob_service_requests');
  });

  describe('Fix 1 & 2: Order Price and Status Parsing', () => {
    it('preserves valid price (0) and positive prices, and skips malformed/negative prices entirely without silent 0 fallbacks', () => {
      const rawRecords = [
        {
          id: 'ord-1',
          status: 'assigned',
          proposedPrice: 0, // Valid free consultation
          artisanId: 'art-1',
          createdAt: new Date().toISOString()
        },
        {
          id: 'ord-2',
          status: 'in_progress',
          proposedPrice: 2500, // Valid positive price
          artisanId: 'art-1',
          createdAt: new Date().toISOString()
        },
        {
          id: 'ord-3',
          status: 'completed',
          proposedPrice: -500, // Invalid negative price
          artisanId: 'art-1',
          createdAt: new Date().toISOString()
        },
        {
          id: 'ord-4',
          status: 'completed',
          proposedPrice: -100, // Invalid negative price (survives JSON stringify)
          artisanId: 'art-1',
          createdAt: new Date().toISOString()
        },
        {
          id: 'ord-5',
          status: 'completed',
          proposedPrice: 'invalid-price-value', // Invalid string format (survives JSON stringify)
          artisanId: 'art-1',
          createdAt: new Date().toISOString()
        },
        {
          id: 'ord-6',
          status: 'completed',
          proposedPrice: 'invalid-string', // Invalid malformed value
          artisanId: 'art-1',
          createdAt: new Date().toISOString()
        }
      ];

      // Store malformed raw records
      appLocalStorage.setItem('bricojob_orders', rawRecords);

      const parsed = orderRepository.getAll();
      expect(parsed.length).toBe(2);

      const ord1 = parsed.find(o => o.id === 'ord-1');
      expect(ord1).toBeDefined();
      expect(ord1?.proposedPrice).toBe(0);

      const ord2 = parsed.find(o => o.id === 'ord-2');
      expect(ord2).toBeDefined();
      expect(ord2?.proposedPrice).toBe(2500);

      // Verify invalid items were filtered/skipped completely rather than silently default to 0
      expect(parsed.find(o => o.id === 'ord-3')).toBeUndefined();
      expect(parsed.find(o => o.id === 'ord-4')).toBeUndefined();
      expect(parsed.find(o => o.id === 'ord-5')).toBeUndefined();
      expect(parsed.find(o => o.id === 'ord-6')).toBeUndefined();
    });

    it('preserves valid order statuses, and skips unknown/malformed statuses without silent assigned fallback', () => {
      const rawRecords = [
        {
          id: 'ord-10',
          status: 'assigned',
          proposedPrice: 1500,
          artisanId: 'art-1',
          createdAt: new Date().toISOString()
        },
        {
          id: 'ord-11',
          status: 'in_progress',
          proposedPrice: 1500,
          artisanId: 'art-1',
          createdAt: new Date().toISOString()
        },
        {
          id: 'ord-12',
          status: 'completed',
          proposedPrice: 1500,
          artisanId: 'art-1',
          createdAt: new Date().toISOString()
        },
        {
          id: 'ord-13',
          status: 'cancelled',
          proposedPrice: 1500,
          artisanId: 'art-1',
          createdAt: new Date().toISOString()
        },
        {
          id: 'ord-14',
          status: 'pending',
          proposedPrice: 1500,
          artisanId: 'art-1',
          createdAt: new Date().toISOString()
        },
        {
          id: 'ord-15',
          status: 'unknown_and_invalid', // Invalid status
          proposedPrice: 1500,
          artisanId: 'art-1',
          createdAt: new Date().toISOString()
        },
        {
          id: 'ord-16',
          status: null, // Missing status
          proposedPrice: 1500,
          artisanId: 'art-1',
          createdAt: new Date().toISOString()
        }
      ];

      appLocalStorage.setItem('bricojob_orders', rawRecords);

      const parsed = orderRepository.getAll();
      expect(parsed.length).toBe(5);

      expect(parsed.find(o => o.id === 'ord-10')?.status).toBe('assigned');
      expect(parsed.find(o => o.id === 'ord-11')?.status).toBe('in_progress');
      expect(parsed.find(o => o.id === 'ord-12')?.status).toBe('completed');
      expect(parsed.find(o => o.id === 'ord-13')?.status).toBe('cancelled');
      expect(parsed.find(o => o.id === 'ord-14')?.status).toBe('pending');

      // Invalid and missing status records must be completely skipped, not silently assigned
      expect(parsed.find(o => o.id === 'ord-15')).toBeUndefined();
      expect(parsed.find(o => o.id === 'ord-16')).toBeUndefined();
    });
  });

  describe('Fix 3: Service Offer / Request Integrity', () => {
    it('enforces request status transition rules at repository level', () => {
      const request: ServiceRequest = {
        id: 'req-test',
        clientId: 'client-1',
        category: 'plumbing',
        title: 'Title',
        description: 'Desc',
        wilaya: 'الجزائر',
        city: 'الجزائر الوسطى',
        urgency: 'now',
        status: 'open',
        createdAt: new Date().toISOString()
      };

      serviceRequestRepository.create(request);

      // open -> completed is invalid (cannot skip in-between flow)
      const successInvalid = serviceRequestRepository.updateStatus('req-test', 'completed');
      expect(successInvalid).toBe(false);
      expect(serviceRequestRepository.getById('req-test')?.status).toBe('open');

      // open -> offers_received is valid
      const successValid = serviceRequestRepository.updateStatus('req-test', 'offers_received');
      expect(successValid).toBe(true);
      expect(serviceRequestRepository.getById('req-test')?.status).toBe('offers_received');
    });

    it('enforces offer relationship and status constraints in update and accept operations', () => {
      const offer: ServiceOffer = {
        id: 'off-test',
        requestId: 'req-test',
        artisanId: 'art-test',
        artisanName: 'Artisan',
        proposedPrice: 3000,
        status: 'pending',
        createdAt: new Date().toISOString()
      };

      serviceOfferRepository.create(offer);

      // Attempting to update to a different requestId must be rejected (relationship integrity)
      const updateMismatchedRequest = serviceOfferRepository.update({
        ...offer,
        requestId: 'req-mismatched'
      });
      expect(updateMismatchedRequest).toBe(false);

      // Attempting to update to a different artisanId must be rejected (relationship integrity)
      const updateMismatchedArtisan = serviceOfferRepository.update({
        ...offer,
        artisanId: 'art-mismatched'
      });
      expect(updateMismatchedArtisan).toBe(false);

      // Attempting to accept with mismatched requestId must be rejected
      const acceptMismatched = serviceOfferRepository.accept('off-test', 'req-mismatched');
      expect(acceptMismatched).toBe(false);

      // Invalid status transition (e.g. pending -> withdrawn -> pending)
      const withdrawSuccess = serviceOfferRepository.updateStatus('off-test', 'withdrawn');
      expect(withdrawSuccess).toBe(true);

      const restorePending = serviceOfferRepository.updateStatus('off-test', 'pending');
      expect(restorePending).toBe(false); // withdrawn is terminal, cannot restore
    });
  });

  describe('Fix 4: Storage Persistence & Status tracking', () => {
    it('correctly tracks and returns persistence status for writes', () => {
      // 1. Standard success write (when mock storage exists)
      const saveSuccess = appLocalStorage.setItem('test_persistence', { foo: 'bar' });
      expect(saveSuccess).toBe(true);
      expect(appLocalStorage.getLastWriteStatus()).toBe('persisted');

      // 2. Failed write (quota exceeded / storage exception)
      const badStorage: Storage = {
        getItem: () => null,
        setItem: () => { throw new Error('QuotaExceededError'); },
        removeItem: () => {},
        clear: () => {},
        key: () => null,
        length: 0
      };

      const originalStorage = (appLocalStorage as any).storage;
      (appLocalStorage as any).storage = badStorage;

      const saveFailed = appLocalStorage.setItem('test_exception', { data: 'boom' });
      expect(saveFailed).toBe(false);
      expect(appLocalStorage.getLastWriteStatus()).toBe('failed');

      // 3. Memory fallback write (storage unavailable / null)
      (appLocalStorage as any).storage = null;

      const saveFallback = appLocalStorage.setItem('test_fallback', { data: 'fallback' });
      expect(saveFallback).toBe(false);
      expect(appLocalStorage.getLastWriteStatus()).toBe('memory_fallback');

      // Restore original mock state
      delete (appLocalStorage as any).storage;
    });
  });
});
