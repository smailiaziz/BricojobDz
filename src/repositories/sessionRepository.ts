import { UserSession } from '../types';
import { sanitizeUserSession } from '../domain';
import { appLocalStorage } from './storage';

const STORAGE_KEYS = {
  CURRENT_USER: 'bricojob_current_user',
  USERS_REGISTRY: 'bricojob_users',
  LEGACY_CREDENTIALS: 'bricojob_auth_credentials',
} as const;

export { sanitizeUserSession };

export interface ISessionRepository {
  getCurrentUser(): UserSession | null;
  saveCurrentUser(user: UserSession): boolean;
  clearCurrentUser(): boolean;
  getPublicUsers(): UserSession[];
  savePublicUsers(users: UserSession[]): boolean;
  updateUserSession(user: UserSession): boolean;
  purgeLegacyCredentials(): void;
}

export class SessionRepository implements ISessionRepository {
  public purgeLegacyCredentials(): void {
    appLocalStorage.removeItem(STORAGE_KEYS.LEGACY_CREDENTIALS);
  }

  public getCurrentUser(): UserSession | null {
    const raw = appLocalStorage.getItem<UserSession>(STORAGE_KEYS.CURRENT_USER, null);
    if (!raw) return null;
    return sanitizeUserSession(raw);
  }

  public saveCurrentUser(user: UserSession): boolean {
    const clean = sanitizeUserSession(user);
    if (!clean) return false;
    return appLocalStorage.setItem(STORAGE_KEYS.CURRENT_USER, clean);
  }

  public clearCurrentUser(): boolean {
    return appLocalStorage.removeItem(STORAGE_KEYS.CURRENT_USER);
  }

  public getPublicUsers(): UserSession[] {
    const raw = appLocalStorage.getItem<UserSession[]>(STORAGE_KEYS.USERS_REGISTRY, []);
    if (!Array.isArray(raw)) return [];
    const LEGACY_SEED_ARTISAN_IDS = ['art-1', 'art-2', 'art-3', 'art-4', 'art-5', 'art-6', 'art-7', 'art-8'];
    return raw
      .map(u => sanitizeUserSession(u))
      .filter((u): u is UserSession => u !== null)
      .filter(u => !u.artisanId || !LEGACY_SEED_ARTISAN_IDS.includes(u.artisanId));
  }

  public savePublicUsers(users: UserSession[]): boolean {
    const cleanUsers = users
      .map(u => sanitizeUserSession(u))
      .filter((u): u is UserSession => u !== null);
    return appLocalStorage.setItem(STORAGE_KEYS.USERS_REGISTRY, cleanUsers);
  }

  public updateUserSession(user: UserSession): boolean {
    const clean = sanitizeUserSession(user);
    if (!clean) return false;
    this.saveCurrentUser(clean);
    const publicUsers = this.getPublicUsers();
    const index = publicUsers.findIndex(u => u.id === clean.id || u.email.toLowerCase() === clean.email.toLowerCase());
    if (index !== -1) {
      publicUsers[index] = clean;
    } else {
      publicUsers.push(clean);
    }
    return this.savePublicUsers(publicUsers);
  }
}

export const sessionRepository = new SessionRepository();
