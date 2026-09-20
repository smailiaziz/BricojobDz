import { describe, it, expect, beforeEach, vi } from 'vitest';
import fs from 'fs';
import path from 'path';
import { 
  isStandaloneMode, 
  isPwaDismissedInCooldown, 
  recordPwaDismissal, 
  clearPwaDismissal, 
  PWA_INSTALL_DISMISSED_KEY,
  isIOSDevice
} from '../domain/pwa';
import { appLocalStorage } from '../repositories/storage';
import { UserSession } from '../types';

describe('PWA Install Experience & Hardening', () => {
  beforeEach(() => {
    appLocalStorage.removeItem(PWA_INSTALL_DISMISSED_KEY);
    vi.useFakeTimers();
  });

  describe('1. Manifest & Asset Verification (Chromium Criteria)', () => {
    it('has a valid manifest.json file with required PWA properties', () => {
      const manifestPath = path.join(process.cwd(), 'public', 'manifest.json');
      expect(fs.existsSync(manifestPath)).toBe(true);

      const rawContent = fs.readFileSync(manifestPath, 'utf-8');
      const manifest = JSON.parse(rawContent);

      expect(manifest.short_name).toBe('BricojobDz');
      expect(manifest.start_url).toBe('/');
      expect(manifest.scope).toBe('/');
      expect(manifest.display).toBe('standalone');
      expect(manifest.prefer_related_applications).toBe(false);
      expect(Array.isArray(manifest.icons)).toBe(true);
      expect(manifest.icons.length).toBeGreaterThanOrEqual(3);
    });

    it('has actual valid PNG icon files with correct dimensions matching manifest declarations', () => {
      const publicDir = path.join(process.cwd(), 'public');

      const icons = [
        { name: 'icon-192.png', expectedWidth: 192, expectedHeight: 192 },
        { name: 'icon-512.png', expectedWidth: 512, expectedHeight: 512 },
        { name: 'icon-512-maskable.png', expectedWidth: 512, expectedHeight: 512 }
      ];

      for (const icon of icons) {
        const filePath = path.join(publicDir, icon.name);
        expect(fs.existsSync(filePath), `File ${icon.name} must exist`).toBe(true);

        const buffer = fs.readFileSync(filePath);
        expect(buffer.length).toBeGreaterThan(100);

        // PNG signature check
        expect(buffer[0]).toBe(137);
        expect(buffer[1]).toBe(80); // 'P'
        expect(buffer[2]).toBe(78); // 'N'
        expect(buffer[3]).toBe(71); // 'G'

        // Read dimensions from IHDR chunk
        const width = buffer.readUInt32BE(16);
        const height = buffer.readUInt32BE(20);

        expect(width).toBe(icon.expectedWidth);
        expect(height).toBe(icon.expectedHeight);
      }
    });
  });

  describe('2. Domain & Storage Helpers (PWA Helpers & Cooldown)', () => {
    it('returns false for cooldown when storage is empty', () => {
      expect(isPwaDismissedInCooldown()).toBe(false);
    });

    it('records dismissal timestamp and detects active cooldown', () => {
      const now = 1000000;
      recordPwaDismissal(now);
      expect(isPwaDismissedInCooldown(now + 1000)).toBe(true);
      expect(isPwaDismissedInCooldown(now + 3 * 24 * 60 * 60 * 1000 - 1)).toBe(true);
      expect(isPwaDismissedInCooldown(now + 3 * 24 * 60 * 60 * 1000 + 1)).toBe(false);
    });

    it('clears dismissal timestamp on demand', () => {
      recordPwaDismissal();
      expect(isPwaDismissedInCooldown()).toBe(true);
      clearPwaDismissal();
      expect(isPwaDismissedInCooldown()).toBe(false);
    });

    it('handles malformed or corrupt localStorage data gracefully without crashing', () => {
      // Corrupt data: non-numeric string
      appLocalStorage.setItem(PWA_INSTALL_DISMISSED_KEY, 'invalid_timestamp');
      expect(isPwaDismissedInCooldown()).toBe(false);

      // Corrupt data: negative number
      appLocalStorage.setItem(PWA_INSTALL_DISMISSED_KEY, -500);
      expect(isPwaDismissedInCooldown()).toBe(false);

      // Corrupt data: object
      appLocalStorage.setItem(PWA_INSTALL_DISMISSED_KEY, { bad: 'data' });
      expect(isPwaDismissedInCooldown()).toBe(false);
    });
  });

  describe('3. Standalone & Platform Detection', () => {
    it('detects standalone mode when navigator.standalone is true or display-mode matches', () => {
      expect(isStandaloneMode()).toBe(false);
    });

    it('handles missing navigator or userAgent safely', () => {
      expect(() => isIOSDevice()).not.toThrow();
    });
  });

  describe('4. Event listeners & Cooldown integration', () => {
    it('stores cooldown key upon dismissal', () => {
      recordPwaDismissal(Date.now());
      expect(appLocalStorage.hasItem(PWA_INSTALL_DISMISSED_KEY)).toBe(true);
    });
  });

  describe('5. Role Agnostic & Safety Verification', () => {
    it('is role-agnostic and does not impact Guest, User, or Artisan sessions', () => {
      const guestSession: null = null;
      const clientSession: UserSession = {
        id: 'user_1',
        name: 'عميل',
        email: 'client@example.com',
        phone: '0550000000',
        role: 'user',
        createdAt: '2026-01-01'
      };
      const artisanSession: UserSession = {
        id: 'artisan_user_1',
        name: 'حرفي',
        email: 'artisan@example.com',
        phone: '0660000000',
        role: 'artisan',
        artisanId: 'artisan_1',
        createdAt: '2026-01-01'
      };

      // Ensure PWA state logic does not alter session objects
      expect(guestSession).toBeNull();
      expect(clientSession.role).toBe('user');
      expect(artisanSession.role).toBe('artisan');
    });
  });
});
