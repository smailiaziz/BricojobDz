import { describe, it, expect, beforeEach, vi } from 'vitest';
import { serviceRequestRepository } from '../repositories/serviceRequestRepository';
import { sessionRepository } from '../repositories/sessionRepository';
import { authService } from '../services/authService';
import { appLocalStorage } from '../repositories/storage';
import { ServiceRequest } from '../types';

describe('Stage 18 — Repository and Auth Integrity Fixes', () => {
  const REQUESTS_KEY = 'bricojob_service_requests';
  const CURRENT_USER_KEY = 'bricojob_current_user';
  const USERS_REGISTRY_KEY = 'bricojob_users';

  beforeEach(() => {
    appLocalStorage.removeItem(REQUESTS_KEY);
    appLocalStorage.removeItem(CURRENT_USER_KEY);
    appLocalStorage.removeItem(USERS_REGISTRY_KEY);
    vi.restoreAllMocks();
  });

  describe('serviceRequestRepository.update status: undefined hardening', () => {
    it('rejects update when status is explicitly undefined', () => {
      const original: ServiceRequest = {
        id: 'req-status-test-1',
        clientId: 'usr-client-1',
        clientName: 'أحمد',
        title: 'إصلاح سباكة',
        description: 'تسريب في الحمام',
        wilaya: 'الجزائر',
        city: 'الجزائر الوسطى',
        status: 'open',
        category: 'plumbing',
        urgency: 'now',
        createdAt: '2026-09-18T10:00:00Z',
      };

      serviceRequestRepository.create(original);

      // Attempt update with status: undefined
      const updatePayload: any = {
        id: 'req-status-test-1',
        title: 'عنوان معدل خبيث',
        status: undefined,
      };

      const result = serviceRequestRepository.update(updatePayload);
      expect(result).toBe(false);

      // Verify stored data was not mutated
      const stored = serviceRequestRepository.getById('req-status-test-1');
      expect(stored).not.toBeNull();
      expect(stored?.title).toBe('إصلاح سباكة');
      expect(stored?.status).toBe('open');
    });

    it('rejects update when status is null or invalid', () => {
      const original: ServiceRequest = {
        id: 'req-status-test-2',
        clientId: 'usr-client-2',
        clientName: 'سامي',
        title: 'دهان غرفة',
        description: 'دهان جدران',
        wilaya: 'وهران',
        city: 'وهران',
        status: 'open',
        category: 'painting',
        urgency: 'flexible',
        createdAt: '2026-09-18T10:00:00Z',
      };

      serviceRequestRepository.create(original);

      expect(serviceRequestRepository.update({ id: 'req-status-test-2', status: null } as any)).toBe(false);
      expect(serviceRequestRepository.update({ id: 'req-status-test-2', status: 'unknown_status' } as any)).toBe(false);

      const stored = serviceRequestRepository.getById('req-status-test-2');
      expect(stored?.status).toBe('open');
    });
  });

  describe('authService.register registry persistence guard', () => {
    it('fails registration and does not save current user session if savePublicUsers returns false', async () => {
      // Mock sessionRepository.savePublicUsers to simulate storage failure
      vi.spyOn(sessionRepository, 'savePublicUsers').mockReturnValue(false);

      const registerPayload = {
        name: 'مستخدم تجربة فشل التخزين',
        email: 'fail-storage@example.com',
        password: 'Password123!',
        role: 'user' as const,
        phone: '0550112233',
      };

      await expect(authService.register(registerPayload)).rejects.toThrow('FAILED_TO_SAVE_USER_REGISTRY');

      // Verify no active session was established
      expect(authService.getCurrentUser()).toBeNull();
      expect(sessionRepository.getCurrentUser()).toBeNull();
    });

    it('succeeds registration and establishes session when savePublicUsers returns true', async () => {
      const registerPayload = {
        name: 'مستخدم ناجح',
        email: 'success-user@example.com',
        password: 'Password123!',
        role: 'user' as const,
        phone: '0550112233',
      };

      const result = await authService.register(registerPayload);
      expect(result.user.email).toBe('success-user@example.com');
      expect(authService.getCurrentUser()?.email).toBe('success-user@example.com');
    });
  });
});
