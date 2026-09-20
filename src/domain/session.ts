import { UserSession } from '../types';

/**
 * Pure predicate: Validates whether a given value is a structurally valid and non-corrupted UserSession.
 * 
 * Rules:
 * - Must be a non-null, non-array object.
 * - `id` must be a string, not empty, and not whitespace-only.
 * - `role` must be strictly 'user' or 'artisan'.
 * - Must not be a synthetic/default placeholder with empty ID.
 */
export function isValidUserSession(user: unknown): user is UserSession {
  if (!user || typeof user !== 'object' || Array.isArray(user)) {
    return false;
  }

  const candidate = user as Record<string, unknown>;

  // ID validation: must be string, not empty, not whitespace
  if (typeof candidate.id !== 'string' || candidate.id.trim().length === 0) {
    return false;
  }

  // Role validation: must be strictly 'user' or 'artisan'
  if (candidate.role !== 'user' && candidate.role !== 'artisan') {
    return false;
  }

  return true;
}

/**
 * Pure domain transformation: Strips sensitive fields (like password) from user object
 * and guarantees that only valid, non-corrupted user profile data is handled or persisted.
 * 
 * Returns null for invalid, corrupted, empty, or unauthenticated session inputs.
 * Never fabricates synthetic IDs or default user identities.
 */
export function sanitizeUserSession(
  user: (Partial<UserSession> & { password?: string; [key: string]: any }) | null | undefined
): UserSession | null {
  if (!isValidUserSession(user)) {
    return null;
  }

  // Strip password and any other sensitive/untyped fields
  const { password: _, ...cleanUser } = user as any;

  const sanitized: UserSession = {
    id: cleanUser.id.trim(),
    name: typeof cleanUser.name === 'string' ? cleanUser.name.trim() : '',
    email: typeof cleanUser.email === 'string' ? cleanUser.email.trim() : '',
    role: cleanUser.role,
    createdAt: typeof cleanUser.createdAt === 'string' && cleanUser.createdAt.trim().length > 0
      ? cleanUser.createdAt
      : new Date().toISOString(),
  };

  if (typeof cleanUser.artisanId === 'string' && cleanUser.artisanId.trim().length > 0) {
    sanitized.artisanId = cleanUser.artisanId.trim();
  }
  if (typeof cleanUser.wilaya === 'string' && cleanUser.wilaya.trim().length > 0) {
    sanitized.wilaya = cleanUser.wilaya.trim();
  }
  if (typeof cleanUser.city === 'string' && cleanUser.city.trim().length > 0) {
    sanitized.city = cleanUser.city.trim();
  }
  if (typeof cleanUser.phone === 'string' && cleanUser.phone.trim().length > 0) {
    sanitized.phone = cleanUser.phone.trim();
  }
  if (typeof cleanUser.profession === 'string' && cleanUser.profession.trim().length > 0) {
    sanitized.profession = cleanUser.profession.trim();
  }
  if (typeof cleanUser.avatar === 'string' && cleanUser.avatar.trim().length > 0) {
    sanitized.avatar = cleanUser.avatar.trim();
  }

  return sanitized;
}

