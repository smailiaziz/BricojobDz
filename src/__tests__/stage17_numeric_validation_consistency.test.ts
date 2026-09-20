import { describe, it, expect, beforeEach } from 'vitest';
import { validateServiceRequestBudget, validateServiceOfferPrice } from '../domain/serviceRequests';
import { parseStartingPrice, formatStartingPrice, getCleanStartingPrice } from '../utils';
import { isValidRating } from '../domain/reviews';
import { isPwaDismissedInCooldown, PWA_INSTALL_DISMISSED_KEY } from '../domain/pwa';
import { appLocalStorage } from '../repositories/storage';

describe('Stage 17 — Numeric Validation Consistency (Task 8)', () => {
  beforeEach(() => {
    appLocalStorage.removeItem(PWA_INSTALL_DISMISSED_KEY);
  });

  describe('validateServiceRequestBudget', () => {
    it('rejects Infinity, -Infinity, and NaN', () => {
      expect(validateServiceRequestBudget(Infinity).isValid).toBe(false);
      expect(validateServiceRequestBudget(-Infinity).isValid).toBe(false);
      expect(validateServiceRequestBudget(NaN).isValid).toBe(false);
    });

    it('accepts 0 as valid budget', () => {
      const res = validateServiceRequestBudget(0);
      expect(res.isValid).toBe(true);
      expect(res.parsedBudget).toBe(0);
    });

    it('accepts null, undefined, and empty string as undefined budget', () => {
      expect(validateServiceRequestBudget(null).isValid).toBe(true);
      expect(validateServiceRequestBudget(null).parsedBudget).toBeUndefined();
      expect(validateServiceRequestBudget(undefined).isValid).toBe(true);
      expect(validateServiceRequestBudget(undefined).parsedBudget).toBeUndefined();
      expect(validateServiceRequestBudget('').isValid).toBe(true);
      expect(validateServiceRequestBudget('').parsedBudget).toBeUndefined();
      expect(validateServiceRequestBudget('   ').isValid).toBe(true);
      expect(validateServiceRequestBudget('   ').parsedBudget).toBeUndefined();
    });

    it('accepts positive numbers and valid Arabic/Persian strings', () => {
      const res = validateServiceRequestBudget(5000);
      expect(res.isValid).toBe(true);
      expect(res.parsedBudget).toBe(5000);

      const strRes = validateServiceRequestBudget('٥٠٠٠ دج');
      expect(strRes.isValid).toBe(true);
      expect(strRes.parsedBudget).toBe(5000);
    });
  });

  describe('validateServiceOfferPrice', () => {
    it('rejects Infinity, -Infinity, and NaN', () => {
      expect(validateServiceOfferPrice(Infinity).isValid).toBe(false);
      expect(validateServiceOfferPrice(-Infinity).isValid).toBe(false);
      expect(validateServiceOfferPrice(NaN).isValid).toBe(false);
    });

    it('accepts 0 as valid offer price', () => {
      const res = validateServiceOfferPrice(0);
      expect(res.isValid).toBe(true);
      expect(res.parsedPrice).toBe(0);
    });

    it('rejects negative numbers and empty inputs', () => {
      expect(validateServiceOfferPrice(-100).isValid).toBe(false);
      expect(validateServiceOfferPrice('-500').isValid).toBe(false);
      expect(validateServiceOfferPrice(null).isValid).toBe(false);
      expect(validateServiceOfferPrice(undefined).isValid).toBe(false);
      expect(validateServiceOfferPrice('').isValid).toBe(false);
    });

    it('accepts positive numbers and valid Arabic/Persian strings', () => {
      const res = validateServiceOfferPrice(2500);
      expect(res.isValid).toBe(true);
      expect(res.parsedPrice).toBe(2500);

      const strRes = validateServiceOfferPrice('٢٥٠٠ DA');
      expect(strRes.isValid).toBe(true);
      expect(strRes.parsedPrice).toBe(2500);
    });
  });

  describe('parseStartingPrice and related formatters in utils.ts', () => {
    it('returns null for Infinity, -Infinity, and NaN in parseStartingPrice', () => {
      expect(parseStartingPrice(Infinity)).toBeNull();
      expect(parseStartingPrice(-Infinity)).toBeNull();
      expect(parseStartingPrice(NaN)).toBeNull();
    });

    it('preserves 0 as a valid price in parseStartingPrice', () => {
      expect(parseStartingPrice(0)).toBe(0);
      expect(parseStartingPrice('0')).toBe(0);
      expect(parseStartingPrice('0 دج')).toBe(0);
      expect(parseStartingPrice('٠')).toBe(0);
    });

    it('formats price correctly with Infinity, -Infinity, and NaN in formatStartingPrice', () => {
      expect(formatStartingPrice(Infinity)).toBe('حسب المعاينة');
      expect(formatStartingPrice(-Infinity)).toBe('حسب المعاينة');
      expect(formatStartingPrice(NaN)).toBe('حسب المعاينة');
      expect(formatStartingPrice(0)).toBe('مجاني / استشارة مجانية');
      expect(formatStartingPrice(1500)).toBe('1500 دج');
    });

    it('formats clean price correctly with Infinity, -Infinity, and NaN in getCleanStartingPrice', () => {
      expect(getCleanStartingPrice(Infinity)).toBeNull();
      expect(getCleanStartingPrice(-Infinity)).toBeNull();
      expect(getCleanStartingPrice(NaN)).toBeNull();
      expect(getCleanStartingPrice(0)).toBe('مجاني / استشارة مجانية');
      expect(getCleanStartingPrice(2000)).toBe('2000 دج');
    });
  });

  describe('isValidRating in reviews.ts', () => {
    it('rejects Infinity, -Infinity, and NaN', () => {
      expect(isValidRating(Infinity)).toBe(false);
      expect(isValidRating(-Infinity)).toBe(false);
      expect(isValidRating(NaN)).toBe(false);
    });

    it('rejects numbers outside [1, 5]', () => {
      expect(isValidRating(0)).toBe(false);
      expect(isValidRating(0.9)).toBe(false);
      expect(isValidRating(5.1)).toBe(false);
      expect(isValidRating(-3)).toBe(false);
    });

    it('accepts valid finite numbers between 1 and 5', () => {
      expect(isValidRating(1)).toBe(true);
      expect(isValidRating(3)).toBe(true);
      expect(isValidRating(4.5)).toBe(true);
      expect(isValidRating(5)).toBe(true);
    });
  });

  describe('isPwaDismissedInCooldown in pwa.ts', () => {
    it('treats Infinity, -Infinity, and NaN as corrupt and clears storage', () => {
      appLocalStorage.setItem(PWA_INSTALL_DISMISSED_KEY, Infinity as any);
      expect(isPwaDismissedInCooldown()).toBe(false);
      expect(appLocalStorage.getItem(PWA_INSTALL_DISMISSED_KEY)).toBeNull();

      appLocalStorage.setItem(PWA_INSTALL_DISMISSED_KEY, -Infinity as any);
      expect(isPwaDismissedInCooldown()).toBe(false);
      expect(appLocalStorage.getItem(PWA_INSTALL_DISMISSED_KEY)).toBeNull();

      appLocalStorage.setItem(PWA_INSTALL_DISMISSED_KEY, NaN as any);
      expect(isPwaDismissedInCooldown()).toBe(false);
      expect(appLocalStorage.getItem(PWA_INSTALL_DISMISSED_KEY)).toBeNull();
    });

    it('correctly handles valid recent timestamp within cooldown', () => {
      const now = Date.now();
      appLocalStorage.setItem(PWA_INSTALL_DISMISSED_KEY, now - 1000 * 60); // 1 minute ago
      expect(isPwaDismissedInCooldown(now)).toBe(true);
    });
  });
});
