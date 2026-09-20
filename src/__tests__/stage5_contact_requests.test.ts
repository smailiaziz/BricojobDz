import { describe, it, expect, beforeEach } from 'vitest';
import { contactRequestRepository } from '../repositories/contactRequestRepository';
import { appLocalStorage } from '../repositories/storage';
import {
  canCreateContactRequest,
  canViewCustomerContactHistory,
  canViewCustomerContactRequest,
  canViewArtisanContactRequest,
  canHandleContactRequest,
} from '../domain/authorization';
import { UserSession, Artisan, ServiceContactRequest } from '../types';

describe('Stage 5 — Contact Requests 2.0 Hardening & Isolation', () => {
  const STORAGE_KEY = 'bricojob_contact_requests_v1';

  beforeEach(() => {
    appLocalStorage.removeItem(STORAGE_KEY);
  });

  describe('Domain Authorization Predicates', () => {
    const userA: UserSession = {
      id: 'user_1',
      name: 'Ahmed',
      email: 'ahmed1@example.com',
      phone: '0550000001',
      role: 'user',
      createdAt: '2026-01-01T00:00:00.000Z',
    };

    const userB: UserSession = {
      id: 'user_2',
      name: 'Ahmed', // Same name, different ID
      email: 'ahmed1@example.com', // Same email, different ID
      phone: '0550000001', // Same phone, different ID
      role: 'user',
      createdAt: '2026-01-01T00:00:00.000Z',
    };

    const artisanA: Artisan = {
      id: 'artisan_100',
      name: 'Karim',
      profession: 'سباك',
      category: 'plumbing',
      wilaya: 'الجزائر',
      city: 'الجزائر الوسطى',
      phone: '0661112233',
      verified: true,
      experienceYears: 5,
      rating: 4.8,
      reviewCount: 12,
      startingPrice: 1500,
      avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d',
      bio: 'سباك محترف',
      services: ['تركيب شبكات المياه', 'إصلاح تسربات المياه'],
      portfolio: [],
      reviews: [],
      availableTimes: 'طوال الأسبوع',
    };

    const artisanUserA: UserSession = {
      id: 'user_artisan_100',
      artisanId: 'artisan_100',
      name: 'Karim',
      email: 'karim@example.com',
      phone: '0661112233',
      role: 'artisan',
      createdAt: '2026-01-01T00:00:00.000Z',
    };

    const artisanUserB: UserSession = {
      id: 'user_artisan_200',
      artisanId: 'artisan_200',
      name: 'Omar',
      email: 'omar@example.com',
      phone: '0661112244',
      role: 'artisan',
      createdAt: '2026-01-01T00:00:00.000Z',
    };

    const sampleRequest: ServiceContactRequest = {
      id: 'req_1',
      artisanId: 'artisan_100',
      artisanName: 'Karim',
      customerId: 'user_1',
      customerName: 'Ahmed',
      customerPhone: '0550000001',
      service: 'إصلاح تسرب المياه',
      description: 'أحتاج إلى إصلاح تسرب في المطبخ',
      preferredContact: 'phone',
      createdAt: '2026-09-17T10:00:00.000Z',
      status: 'pending',
    };

    it('prevents artisan from sending contact request to self', () => {
      expect(canCreateContactRequest(artisanUserA, artisanA)).toBe(false);
      expect(canCreateContactRequest(userA, artisanA)).toBe(true);
      expect(canCreateContactRequest(null, artisanA)).toBe(true);
    });

    it('allows only authenticated users with valid IDs to view customer history', () => {
      expect(canViewCustomerContactHistory(userA)).toBe(true);
      expect(canViewCustomerContactHistory(null)).toBe(false);
      expect(canViewCustomerContactHistory(undefined)).toBe(false);
      expect(canViewCustomerContactHistory({ id: '', name: 'Guest', email: '', phone: '', role: 'user', createdAt: '' })).toBe(false);
    });

    it('strictly enforces ID ownership for customer contact requests without relying on name or phone', () => {
      // Owner matches userA
      expect(canViewCustomerContactRequest(userA, sampleRequest)).toBe(true);

      // UserB has SAME name and phone but DIFFERENT id -> MUST BE DENIED
      expect(canViewCustomerContactRequest(userB, sampleRequest)).toBe(false);

      // Unauthenticated guest -> DENIED
      expect(canViewCustomerContactRequest(null, sampleRequest)).toBe(false);
    });

    it('enforces horizontal isolation between artisans for contact request inbox', () => {
      // Artisan A owns profile artisan_100 -> CAN VIEW
      expect(canViewArtisanContactRequest(artisanUserA, sampleRequest, artisanA)).toBe(true);

      // Artisan B trying to view Artisan A request -> DENIED
      expect(canViewArtisanContactRequest(artisanUserB, sampleRequest, artisanA)).toBe(false);

      // Unauthenticated user -> DENIED
      expect(canViewArtisanContactRequest(null, sampleRequest, artisanA)).toBe(false);
    });

    it('enforces status handling authorization strictly for request owner artisan', () => {
      expect(canHandleContactRequest(artisanUserA, sampleRequest, artisanA)).toBe(true);
      expect(canHandleContactRequest(artisanUserB, sampleRequest, artisanA)).toBe(false);
      expect(canHandleContactRequest(userA, sampleRequest, artisanA)).toBe(false);
    });
  });

  describe('Repository & Isolation Operations', () => {
    it('creates, saves and retrieves customer contact requests by ID', () => {
      const req = contactRequestRepository.save({
        artisanId: 'art_10',
        artisanName: 'مصطفى',
        customerId: 'cust_1',
        customerName: 'أيمن',
        customerPhone: '0770112233',
        service: 'تركيب صنبور',
        description: 'طلب تفاصيل الموعد',
        preferredContact: 'whatsapp',
      });

      expect(req.id).toBeDefined();
      expect(req.status).toBe('pending');

      const cust1Requests = contactRequestRepository.getByCustomer('cust_1');
      expect(cust1Requests).toHaveLength(1);
      expect(cust1Requests[0].id).toBe(req.id);

      // Customer 2 gets empty list (Horizontal isolation)
      const cust2Requests = contactRequestRepository.getByCustomer('cust_2');
      expect(cust2Requests).toHaveLength(0);
    });

    it('updates status strictly between pending and handled', () => {
      const req = contactRequestRepository.save({
        artisanId: 'art_10',
        artisanName: 'مصطفى',
        customerId: 'cust_1',
        customerName: 'أيمن',
        customerPhone: '0770112233',
        service: 'تركيب صنبور',
        description: 'طلب تفاصيل الموعد',
        preferredContact: 'phone',
      });

      // Update status to handled
      const success = contactRequestRepository.updateStatus(req.id, 'handled');
      expect(success).toBe(true);

      const updatedList = contactRequestRepository.getByCustomer('cust_1');
      expect(updatedList[0].status).toBe('handled');
    });

    it('handles legacy clientId mapping seamlessly for backward compatibility', () => {
      // Simulate raw storage containing legacy `clientId` instead of `customerId`
      const legacyRaw = [
        {
          id: 'req_legacy_1',
          artisanId: 'art_10',
          artisanName: 'مصطفى',
          clientId: 'cust_legacy_99',
          customerName: 'سعيد',
          service: 'صيانة مكيف',
          description: '',
          preferredContact: 'phone',
          createdAt: '2026-09-17T08:00:00.000Z',
          status: 'pending',
        },
      ];

      appLocalStorage.setItem(STORAGE_KEY, legacyRaw);

      const results = contactRequestRepository.getByCustomer('cust_legacy_99');
      expect(results).toHaveLength(1);
      expect(results[0].customerId).toBe('cust_legacy_99');
    });

    it('handles malformed localStorage contents gracefully without throwing', () => {
      // Corrupt non-array data
      appLocalStorage.setItem(STORAGE_KEY, { corrupt: 'data' });
      expect(contactRequestRepository.getAll()).toEqual([]);
      expect(contactRequestRepository.getByCustomer('cust_1')).toEqual([]);
      expect(contactRequestRepository.getByArtisan('art_1')).toEqual([]);

      // Array with null, undefined, or missing fields
      appLocalStorage.setItem(STORAGE_KEY, [null, undefined, {}, { id: 123 }, { id: 'valid_1' }]);
      const all = contactRequestRepository.getAll();
      expect(all).toHaveLength(1);
      expect(all[0].id).toBe('valid_1');
      expect(all[0].status).toBe('pending');
    });
  });
});
