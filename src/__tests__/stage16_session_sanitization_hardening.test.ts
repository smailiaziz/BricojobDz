import { describe, it, expect, beforeEach } from 'vitest';
import { sanitizeUserSession, isValidUserSession } from '../domain/session';
import { sessionRepository } from '../repositories/sessionRepository';
import { authService } from '../services/authService';
import { appLocalStorage } from '../repositories/storage';
import { UserSession } from '../types';

describe('Stage 16 — Session Sanitization & Corrupted Session Rejection', () => {
  const CURRENT_USER_KEY = 'bricojob_current_user';
  const USERS_REGISTRY_KEY = 'bricojob_users';

  beforeEach(() => {
    appLocalStorage.removeItem(CURRENT_USER_KEY);
    appLocalStorage.removeItem(USERS_REGISTRY_KEY);
  });

  // 1. valid user session → authenticated
  it('1. valid user session is recognized as authenticated and sanitized properly', () => {
    const validUser: UserSession = {
      id: 'usr-valid-10',
      name: 'كريم بلعيد',
      email: 'karim@example.com',
      phone: '0550112233',
      role: 'user',
      createdAt: '2026-09-18T10:00:00Z',
    };

    expect(isValidUserSession(validUser)).toBe(true);
    const sanitized = sanitizeUserSession(validUser);
    expect(sanitized).not.toBeNull();
    expect(sanitized?.id).toBe('usr-valid-10');
    expect(sanitized?.role).toBe('user');
  });

  // 2. valid artisan session → authenticated
  it('2. valid artisan session is recognized as authenticated', () => {
    const validArtisan: UserSession = {
      id: 'usr-artisan-20',
      name: 'مراد الكهربائي',
      email: 'mourad@example.com',
      role: 'artisan',
      artisanId: 'art-mourad-20',
      profession: 'كهربائي',
      createdAt: '2026-09-18T10:00:00Z',
    };

    expect(isValidUserSession(validArtisan)).toBe(true);
    const sanitized = sanitizeUserSession(validArtisan);
    expect(sanitized).not.toBeNull();
    expect(sanitized?.id).toBe('usr-artisan-20');
    expect(sanitized?.role).toBe('artisan');
    expect(sanitized?.artisanId).toBe('art-mourad-20');
  });

  // 3. missing id → unauthenticated
  it('3. missing id results in null/unauthenticated session', () => {
    const noId = {
      name: 'بدون معرف',
      email: 'noid@example.com',
      role: 'user',
    };

    expect(isValidUserSession(noId)).toBe(false);
    expect(sanitizeUserSession(noId as any)).toBeNull();
  });

  // 4. empty id → unauthenticated
  it('4. empty string id results in null/unauthenticated session', () => {
    const emptyId = {
      id: '',
      name: 'معرف فارغ',
      email: 'empty@example.com',
      role: 'user',
    };

    expect(isValidUserSession(emptyId)).toBe(false);
    expect(sanitizeUserSession(emptyId as any)).toBeNull();
  });

  // 5. whitespace id → unauthenticated
  it('5. whitespace-only id results in null/unauthenticated session', () => {
    const wsId = {
      id: '   \t  \n  ',
      name: 'معرف مسافات',
      email: 'ws@example.com',
      role: 'user',
    };

    expect(isValidUserSession(wsId)).toBe(false);
    expect(sanitizeUserSession(wsId as any)).toBeNull();
  });

  // 6. missing role → unauthenticated
  it('6. missing role results in null/unauthenticated session', () => {
    const noRole = {
      id: 'usr-norole-1',
      name: 'بدون رتبة',
      email: 'norole@example.com',
    };

    expect(isValidUserSession(noRole)).toBe(false);
    expect(sanitizeUserSession(noRole as any)).toBeNull();
  });

  // 7. invalid role → unauthenticated
  it('7. invalid role (e.g. admin, superuser, unknown) results in null/unauthenticated session', () => {
    const badRole = {
      id: 'usr-badrole-1',
      name: 'مستخدم برتبة غير صالحة',
      email: 'admin@example.com',
      role: 'admin',
    };

    expect(isValidUserSession(badRole)).toBe(false);
    expect(sanitizeUserSession(badRole as any)).toBeNull();
  });

  // 8. empty object → unauthenticated
  it('8. empty object results in null/unauthenticated session', () => {
    expect(isValidUserSession({})).toBe(false);
    expect(sanitizeUserSession({})).toBeNull();
  });

  // 9. array → unauthenticated
  it('9. array structure results in null/unauthenticated session', () => {
    expect(isValidUserSession([])).toBe(false);
    expect(sanitizeUserSession([] as any)).toBeNull();
  });

  // 10. primitive → unauthenticated
  it('10. primitive values result in null/unauthenticated session', () => {
    expect(isValidUserSession('invalid-string-session')).toBe(false);
    expect(sanitizeUserSession('invalid-string-session' as any)).toBeNull();
    expect(isValidUserSession(12345)).toBe(false);
    expect(sanitizeUserSession(12345 as any)).toBeNull();
    expect(isValidUserSession(true)).toBe(false);
    expect(sanitizeUserSession(true as any)).toBeNull();
    expect(isValidUserSession(null)).toBe(false);
    expect(sanitizeUserSession(null)).toBeNull();
    expect(isValidUserSession(undefined)).toBe(false);
    expect(sanitizeUserSession(undefined)).toBeNull();
  });

  // 11. malformed JSON in localStorage → unauthenticated
  it('11. corrupted or malformed JSON in localStorage returns null from sessionRepository and authService', () => {
    // Write invalid raw data directly into storage
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(CURRENT_USER_KEY, '{"id": "", "role": "user"}');
    } else {
      appLocalStorage.setItem(CURRENT_USER_KEY, { id: '', role: 'user' } as any);
    }

    const current = sessionRepository.getCurrentUser();
    expect(current).toBeNull();
    expect(authService.getCurrentUser()).toBeNull();
  });

  // 12. session تالفة لا يتم تحويلها إلى "role: user"
  it('12. corrupted session is NOT converted to a fallback default user with role: user', () => {
    const corruptRole = {
      id: 'usr-corrupt-1',
      role: 'invalid_hacked_role',
    };

    const sanitized = sanitizeUserSession(corruptRole as any);
    expect(sanitized).toBeNull();
  });

  // 13. session تالفة لا تنشئ ID
  it('13. corrupted session with empty/missing id NEVER generates or fabricates a synthetic ID', () => {
    const missingId = {
      name: 'علي',
      email: 'ali@example.com',
      role: 'user',
    };

    const sanitized = sanitizeUserSession(missingId as any);
    expect(sanitized).toBeNull();
  });

  // 14. valid legacy-compatible session remains readable
  it('14. valid legacy-compatible session format remains readable and correctly sanitized', () => {
    const legacySession = {
      id: 'usr-legacy-55',
      name: 'كمال العاصمي',
      email: 'kamal@example.com',
      role: 'user' as const,
      phone: '0555998877',
      wilaya: 'الجزائر',
      city: 'الحراش',
      createdAt: '2026-01-01T00:00:00.000Z',
    };

    sessionRepository.saveCurrentUser(legacySession);
    const retrieved = sessionRepository.getCurrentUser();
    expect(retrieved).not.toBeNull();
    expect(retrieved?.id).toBe('usr-legacy-55');
    expect(retrieved?.name).toBe('كمال العاصمي');
    expect(retrieved?.wilaya).toBe('الجزائر');
  });

  // 15. logout behavior remains correct
  it('15. logout clears the current user session completely', async () => {
    const validUser: UserSession = {
      id: 'usr-logout-test',
      name: 'مستخدم تسجيل خروج',
      email: 'logout@example.com',
      role: 'user',
      createdAt: '2026-09-18T10:00:00Z',
    };

    sessionRepository.saveCurrentUser(validUser);
    expect(sessionRepository.getCurrentUser()).not.toBeNull();

    await authService.logout();
    expect(sessionRepository.getCurrentUser()).toBeNull();
    expect(authService.getCurrentUser()).toBeNull();
  });

  // 16. refresh/session persistence remains correct for valid session
  it('16. session persistence across reads remains deterministic for valid session', () => {
    const validUser: UserSession = {
      id: 'usr-persist-1',
      name: 'يوسف المستمر',
      email: 'youssef@example.com',
      role: 'user',
      createdAt: '2026-09-18T10:00:00Z',
    };

    authService.saveCurrentUserSession(validUser);

    const firstRead = authService.getCurrentUser();
    const secondRead = authService.getCurrentUser();

    expect(firstRead).toEqual(secondRead);
    expect(firstRead?.id).toBe('usr-persist-1');
  });

  // 17. password is not introduced into persisted/sanitized session
  it('17. password field is strictly stripped and never introduced into sanitized session', () => {
    const payloadWithPassword = {
      id: 'usr-secure-1',
      name: 'مستخدم محمي',
      email: 'secure@example.com',
      role: 'user' as const,
      password: 'SuperSecretPlainTextPassword123!',
      createdAt: '2026-09-18T10:00:00Z',
    };

    const sanitized = sanitizeUserSession(payloadWithPassword);
    expect(sanitized).not.toBeNull();
    expect('password' in (sanitized as any)).toBe(false);

    sessionRepository.saveCurrentUser(payloadWithPassword as any);
    const fromStorage = sessionRepository.getCurrentUser();
    expect(fromStorage).not.toBeNull();
    expect('password' in (fromStorage as any)).toBe(false);
  });
});
