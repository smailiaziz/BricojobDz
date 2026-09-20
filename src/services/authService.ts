import { UserSession, Artisan } from '../types';
import { sanitizeUserSession } from '../domain';
import { sessionRepository } from '../repositories';

/**
 * Authentication Service Interface (Contract)
 * 
 * Defines the contract for all authentication operations.
 * Allows seamless substitution of local client-side persistence with a secure 
 * Backend API (REST / GraphQL / Firebase / Supabase) without modifying UI components.
 */
export interface IAuthService {
  login(email: string, password: string): Promise<UserSession>;
  register(payload: RegisterPayload, artisanData?: Artisan): Promise<{ user: UserSession; newArtisan?: Artisan }>;
  logout(): Promise<void>;
  getCurrentUser(): UserSession | null;
  requestPasswordReset(email: string): Promise<boolean>;
  updateUserSession(user: UserSession): void;
}

export interface RegisterPayload {
  name: string;
  email: string;
  password?: string;
  role: 'user' | 'artisan';
  wilaya?: string;
  city?: string;
  phone?: string;
  profession?: string;
}

export { sanitizeUserSession };

/**
 * AuthService Implementation
 * 
 * SECURITY DIRECTIVE:
 * 1. ZERO PASSWORDS STORED ON CLIENT: Passwords must NEVER be stored in localStorage,
 *    sessionStorage, IndexedDB, cookies, or client caches.
 * 2. In a production system with a backend server, credentials are sent over HTTPS and
 *    hashed with Argon2/Bcrypt on the server.
 * 3. This client-side service acts as a clean contract adapter: it manages session state
 *    and user profiles without ever retaining or persisting passwords.
 */
class AuthService implements IAuthService {
  constructor() {
    sessionRepository.purgeLegacyCredentials();
  }

  /**
   * Retrieves the currently authenticated user from session repository.
   */
  public getCurrentUser(): UserSession | null {
    return sessionRepository.getCurrentUser();
  }

  /**
   * Saves sanitized user session to session repository.
   */
  public saveCurrentUserSession(user: UserSession): void {
    sessionRepository.saveCurrentUser(user);
  }

  /**
   * Clears the current user session on logout.
   */
  public async logout(): Promise<void> {
    sessionRepository.clearCurrentUser();
  }

  /**
   * Performs user login verification.
   * 
   * NOTE ON CLIENT-SIDE LIMITATION:
   * Because passwords are NOT persisted anywhere on the client (for security),
   * this frontend service validates the existence of the registered user profile
   * and verifies that a non-empty password was supplied.
   * Real password hash validation will occur when connected to a Backend Auth API.
   */
  public async login(email: string, password: string): Promise<UserSession> {
    const cleanEmail = email.trim().toLowerCase();

    if (!cleanEmail || !password) {
      throw new Error('INVALID_CREDENTIALS');
    }

    // 1. Fetch registered user profiles from public registry (no passwords stored here)
    const registeredUsers = sessionRepository.getPublicUsers();
    const matchedUser = registeredUsers.find(u => u.email.toLowerCase() === cleanEmail);

    if (!matchedUser) {
      throw new Error('NOT_FOUND');
    }

    // 2. Prepare and save sanitized session
    const userSession = sanitizeUserSession(matchedUser);
    if (!userSession) {
      throw new Error('INVALID_SESSION');
    }
    this.saveCurrentUserSession(userSession);
    return userSession;
  }

  /**
   * Registers a new user or artisan account.
   * NOTE: The password argument is accepted for API contract compatibility with future
   * backend authentication endpoints, but is intentionally DISCARDED and NEVER persisted locally.
   */
  public async register(
    payload: RegisterPayload,
    artisanData?: Artisan
  ): Promise<{ user: UserSession; newArtisan?: Artisan }> {
    const cleanEmail = payload.email.trim().toLowerCase();
    const cleanName = payload.name.trim();

    // Check if email already exists in public users registry
    const publicUsers = sessionRepository.getPublicUsers();
    const existingUser = publicUsers.find(
      u => u.email.trim().toLowerCase() === cleanEmail
    );
    if (existingUser) {
      throw new Error('EMAIL_EXISTS');
    }

    const userId = `user-${Date.now()}`;
    const userSession: UserSession = {
      id: userId,
      name: cleanName,
      email: cleanEmail,
      role: payload.role,
      artisanId: artisanData?.id,
      wilaya: payload.wilaya || undefined,
      city: payload.city || undefined,
      phone: payload.phone || undefined,
      profession: payload.profession || undefined,
      createdAt: new Date().toISOString(),
    };

    // Update public profiles registry (strictly sanitized, zero credentials)
    const usersSaved = sessionRepository.savePublicUsers([...publicUsers, userSession]);
    if (!usersSaved) {
      throw new Error('FAILED_TO_SAVE_USER_REGISTRY');
    }

    // Save active session (strictly sanitized)
    this.saveCurrentUserSession(userSession);

    return {
      user: userSession,
      newArtisan: artisanData,
    };
  }

  /**
   * Requests a password reset link for the specified email.
   */
  public async requestPasswordReset(email: string): Promise<boolean> {
    const cleanEmail = email.trim().toLowerCase();
    const publicUsers = sessionRepository.getPublicUsers();
    return publicUsers.some(u => u.email.toLowerCase() === cleanEmail);
  }

  /**
   * Updates user session both in active session and public users registry.
   */
  public updateUserSession(user: UserSession): void {
    sessionRepository.updateUserSession(user);
  }
}

export const authService = new AuthService();

