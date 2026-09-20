import { describe, it, expect } from 'vitest';
import {
  normalizePhoneNumber,
  isValidAlgerianPhone,
  cleanPhoneForWhatsApp,
  parseStartingPrice,
  formatStartingPrice,
} from '../utils';

describe('Validation - Phone Numbers', () => {
  it('normalizePhoneNumber converts Eastern Arabic & Persian digits to ASCII', () => {
    // ٠٥٥٢١٤٧٨٩٦ (0552147896 in Eastern Arabic)
    expect(normalizePhoneNumber('٠٥٥٢١٤٧٨٩٦')).toBe('0552147896');
    // ۰۶۶۱۲۳۴۵۹۸ (0661234598 in Persian)
    expect(normalizePhoneNumber('۰۶۶۱۲۳۴۵۹۸')).toBe('0661234598');
  });

  it('normalizePhoneNumber strips spaces, symbols, and country code prefixes (+213, 00213)', () => {
    expect(normalizePhoneNumber('+213 552 14 78 96')).toBe('0552147896');
    expect(normalizePhoneNumber('00213661234598')).toBe('0661234598');
    expect(normalizePhoneNumber('213770987654')).toBe('0770987654');
    expect(normalizePhoneNumber('0552-14-78-96')).toBe('0552147896');
  });

  it('isValidAlgerianPhone validates mobile (05, 06, 07) and landline numbers', () => {
    expect(isValidAlgerianPhone('0552147896')).toBe(true);
    expect(isValidAlgerianPhone('0661234598')).toBe(true);
    expect(isValidAlgerianPhone('0770987654')).toBe(true);
    expect(isValidAlgerianPhone('+213 552 14 78 96')).toBe(true);

    // Landline
    expect(isValidAlgerianPhone('021123456')).toBe(true);

    // Invalid numbers
    expect(isValidAlgerianPhone('12345')).toBe(false);
    expect(isValidAlgerianPhone('0123456789')).toBe(false);
    expect(isValidAlgerianPhone('')).toBe(false);
    expect(isValidAlgerianPhone(null)).toBe(false);
  });

  it('cleanPhoneForWhatsApp formats number as 213XXXXXXXXX', () => {
    expect(cleanPhoneForWhatsApp('0552147896')).toBe('213552147896');
    expect(cleanPhoneForWhatsApp('+213 661 23 45 98')).toBe('213661234598');
    expect(cleanPhoneForWhatsApp('')).toBe('');
  });
});

describe('Validation - Price Parsing & Formatting', () => {
  it('parseStartingPrice parses numbers, clean strings, and legacy strings', () => {
    expect(parseStartingPrice(2000)).toBe(2000);
    expect(parseStartingPrice('2000')).toBe(2000);
    expect(parseStartingPrice('2000 دج')).toBe(2000);
    expect(parseStartingPrice('يبدأ من 3500 DA')).toBe(3500);
    expect(parseStartingPrice('٢٥٠٠')).toBe(2500);

    // Valid 0 (free / free consultation)
    expect(parseStartingPrice(0)).toBe(0);
    expect(parseStartingPrice('0')).toBe(0);
    expect(parseStartingPrice('0 دج')).toBe(0);

    // Invalid / empty / legacy edge cases (must return null, NOT 0)
    expect(parseStartingPrice(null)).toBeNull();
    expect(parseStartingPrice(undefined)).toBeNull();
    expect(parseStartingPrice('undefined')).toBeNull();
    expect(parseStartingPrice('null')).toBeNull();
    expect(parseStartingPrice('حسب المعاينة')).toBeNull();
    expect(parseStartingPrice(-500)).toBeNull();
    expect(parseStartingPrice('-500')).toBeNull();
    expect(parseStartingPrice('-500 دج')).toBeNull();
    expect(parseStartingPrice(NaN)).toBeNull();
    expect(parseStartingPrice(Infinity)).toBeNull();
    expect(parseStartingPrice(-Infinity)).toBeNull();
    expect(parseStartingPrice('abc')).toBeNull();
  });

  it('formatStartingPrice formats valid prices with "دج" or returns "حسب المعاينة"', () => {
    expect(formatStartingPrice(2000)).toBe('2000 دج');
    expect(formatStartingPrice('1800')).toBe('1800 دج');
    expect(formatStartingPrice(null)).toBe('حسب المعاينة');
    expect(formatStartingPrice(undefined)).toBe('حسب المعاينة');
    expect(formatStartingPrice(0)).toBe('مجاني / استشارة مجانية');
    expect(formatStartingPrice('0')).toBe('مجاني / استشارة مجانية');
    expect(formatStartingPrice(-500)).toBe('حسب المعاينة');
    expect(formatStartingPrice(NaN)).toBe('حسب المعاينة');
    expect(formatStartingPrice(Infinity)).toBe('حسب المعاينة');
    expect(formatStartingPrice('حسب المعاينة')).toBe('حسب المعاينة');
  });
});
