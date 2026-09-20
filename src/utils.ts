// Utility functions for text normalization, phone formatting, price parsing, and UI hooks

/**
 * Normalizes Arabic text for robust search matching.
 * Removes diacritics, unifies Alef variants, Ta Marbuta, Ya, etc.
 */
export const normalizeArabicText = (text: string): string => {
  if (!text) return '';
  return text
    .toLowerCase()
    .replace(/[\u064B-\u065F\u0670]/g, '') // remove diacritics
    .replace(/[أإآا]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/[يى]/g, 'ي')
    .replace(/[ؤئ]/g, 'ء')
    .replace(/[\s\-_,.]+/g, ' ')
    .trim();
};

/**
 * Normalizes Algerian phone numbers into a standard clean format.
 * - Converts Eastern Arabic (٠-٩) and Persian (۰-۹) digits to ASCII digits (0-9)
 * - Removes spaces, dashes, dots, parentheses, and prefixes (+213, 00213, 213)
 * - Returns a standard 10-digit number starting with 0 (e.g., "0552147896")
 */
export const normalizePhoneNumber = (phone?: string | null): string => {
  if (!phone || typeof phone !== 'string') return '';

  // 1. Convert Eastern Arabic (٠-٩) and Persian (۰-۹) digits to standard ASCII digits (0-9)
  const normalized = phone
    .replace(/[٠۰]/g, '0')
    .replace(/[١۱]/g, '1')
    .replace(/[٢۲]/g, '2')
    .replace(/[٣۳]/g, '3')
    .replace(/[٤۴]/g, '4')
    .replace(/[٥۵]/g, '5')
    .replace(/[٦۶]/g, '6')
    .replace(/[٧۷]/g, '7')
    .replace(/[٨۸]/g, '8')
    .replace(/[٩۹]/g, '9');

  // 2. Extract digits only
  let digits = normalized.replace(/\D/g, '');
  if (!digits) return '';

  // 3. Handle country code prefix (00213 or 213)
  if (digits.startsWith('00213')) {
    digits = digits.substring(5);
  } else if (digits.startsWith('213')) {
    digits = digits.substring(3);
  }

  // 4. If standard 9 mobile digits starting with 5, 6, 7 or landline digits, ensure leading 0
  if (digits.length === 9 && /^[2-7]/.test(digits)) {
    digits = '0' + digits;
  }

  return digits;
};

/**
 * Validates Algerian phone numbers using the normalized phone representation.
 * Supports:
 * - Mobile lines (10 digits starting with 05, 06, 07)
 * - Fixed landlines (9-10 digits starting with 02, 03, 04)
 */
export const isValidAlgerianPhone = (phone?: string | null): boolean => {
  const normalized = normalizePhoneNumber(phone);
  if (!normalized) return false;
  return (
    (normalized.length === 10 && /^0[567]\d{8}$/.test(normalized)) ||
    ((normalized.length === 9 || normalized.length === 10) && /^0[234]\d{7,8}$/.test(normalized))
  );
};

/**
 * Formats Algerian phone number for WhatsApp direct link (wa.me/213xxxxxxxxx).
 * Guaranteed to use standard clean 213XXXXXXXXX format.
 */
export const cleanPhoneForWhatsApp = (phone?: string | null): string => {
  const normalized = normalizePhoneNumber(phone);
  if (!normalized) return '';
  const digitsWithoutLeadingZero = normalized.startsWith('0') ? normalized.substring(1) : normalized;
  return '213' + digitsWithoutLeadingZero;
};

/**
 * Formats Algerian phone number for clean human UI display (e.g. 0552 14 78 96).
 */
export const formatPhoneNumber = (phone?: string | null): string => {
  const normalized = normalizePhoneNumber(phone);
  if (normalized.length === 10) {
    return `${normalized.slice(0, 4)} ${normalized.slice(4, 6)} ${normalized.slice(6, 8)} ${normalized.slice(8, 10)}`;
  }
  return phone || '';
};

/**
 * Primary presentation formatter for startingPrice (e.g. 2000 -> "2000 دج").
 * Returns "حسب المعاينة" when price is null or undefined.
 * Returns "مجاني / استشارة مجانية" when price is 0.
 */
export const formatStartingPrice = (price?: number | string | null): string => {
  if (price === null || price === undefined) return 'حسب المعاينة';
  const numeric = typeof price === 'number' ? (!Number.isFinite(price) || price < 0 ? null : price) : parseStartingPrice(price);
  if (numeric === null) {
    return 'حسب المعاينة';
  }
  if (numeric === 0) {
    return 'مجاني / استشارة مجانية';
  }
  return `${numeric} دج`;
};

/**
 * Safely parses any price input (string or number) into a clean numeric value or null.
 * Strictly preserves 0 as valid (meaning free / free consultation).
 * Rejects negative numbers, NaN, Infinity, and invalid non-numeric strings.
 */
export const parseStartingPrice = (val: unknown): number | null => {
  if (val === null || val === undefined) return null;
  if (typeof val === 'number') {
    return !Number.isFinite(val) || val < 0 ? null : val;
  }
  if (typeof val === 'string') {
    const trimmed = val.trim();
    if (!trimmed || trimmed.toLowerCase() === 'undefined' || trimmed.toLowerCase() === 'null') {
      return null;
    }
    // Convert Arabic/Persian digits
    const normalized = trimmed
      .replace(/[٠۰]/g, '0')
      .replace(/[١۱]/g, '1')
      .replace(/[٢۲]/g, '2')
      .replace(/[٣۳]/g, '3')
      .replace(/[٤۴]/g, '4')
      .replace(/[٥۵]/g, '5')
      .replace(/[٦۶]/g, '6')
      .replace(/[٧۷]/g, '7')
      .replace(/[٨۸]/g, '8')
      .replace(/[٩۹]/g, '9');

    // Reject negative numbers
    if (normalized.includes('-')) {
      return null;
    }

    // Strip currency symbols and text (e.g. "دج", "DA", "DZD", "يبدأ من")
    const cleaned = normalized.replace(/\s*(د\.?ج|da|dzd)\s*/gi, '').trim();

    // Match digits group
    const match = cleaned.match(/\d+(\.\d+)?/);
    if (!match) return null;

    const parsed = parseFloat(match[0]);
    if (!Number.isFinite(parsed) || parsed < 0) return null;
    return parsed;
  }
  return null;
};

/**
 * Formats starting price cleanly for display or returns null if unavailable.
 * Backward compatible helper that accepts number or string.
 */
export const getCleanStartingPrice = (price?: number | string | null): string | null => {
  if (price === null || price === undefined) return null;
  const numeric = typeof price === 'number' ? (!Number.isFinite(price) || price < 0 ? null : price) : parseStartingPrice(price);
  if (numeric === null) return null;
  if (numeric === 0) return 'مجاني / استشارة مجانية';
  return `${numeric} دج`;
};

/**
 * Returns the formatted starting price reminder message for service request forms.
 * Follows the required pattern: "السعر التقديري المبدئي لهذا الحرفي: XXX دج"
 * Handles missing/invalid cases gracefully.
 */
export const getStartingPriceReminderText = (price?: number | string | null): string => {
  const cleanPrice = getCleanStartingPrice(price);
  if (cleanPrice) {
    return `السعر التقديري المبدئي لهذا الحرفي: ${cleanPrice}`;
  }
  return 'السعر التقديري المبدئي لهذا الحرفي: يحدد حسب المعاينة والاتفاق';
};

/**
 * Validates email format with a standard regex.
 */
export const isValidEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email.trim());
};

/**
 * Migrates any raw artisan object (e.g. from legacy localStorage) to the strictly typed Artisan model.
 * Ensures startingPrice is number | null, phone is normalized, experienceYears is clamped, and verified is boolean.
 */
export const migrateArtisan = (artisan: any): any => {
  if (!artisan) return artisan;
  return {
    ...artisan,
    startingPrice: parseStartingPrice(artisan.startingPrice),
    phone: normalizePhoneNumber(artisan.phone) || artisan.phone || '',
    experienceYears: clampExperienceYears(artisan.experienceYears, 0),
    verified: Boolean(artisan.verified),
  };
};

/**
 * Validates password complexity according to security requirements:
 * - Minimum 8 characters
 * - Must contain at least one digit (0-9)
 * - Must contain at least one special symbol (e.g., @, #, $, !, %, etc.)
 */
export interface PasswordRequirementsStatus {
  hasMinLength: boolean;
  hasNumber: boolean;
  hasSymbol: boolean;
  count: number;
  score: 'none' | 'weak' | 'medium' | 'strong';
  isValid: boolean;
}

export const getPasswordRequirementsStatus = (password: string): PasswordRequirementsStatus => {
  const p = password || '';
  const hasMinLength = p.length >= 8;
  const hasNumber = /\d/.test(p);
  const hasSymbol = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?~`]/.test(p);

  const count = (hasMinLength ? 1 : 0) + (hasNumber ? 1 : 0) + (hasSymbol ? 1 : 0);

  let score: 'none' | 'weak' | 'medium' | 'strong' = 'none';
  if (p.length > 0) {
    if (count === 1) score = 'weak';
    else if (count === 2) score = 'medium';
    else if (count === 3) score = 'strong';
  }

  return {
    hasMinLength,
    hasNumber,
    hasSymbol,
    count,
    score,
    isValid: count === 3,
  };
};

export const validatePasswordComplexity = (password: string): { isValid: boolean; errorMsg?: string } => {
  const status = getPasswordRequirementsStatus(password);
  if (!status.hasMinLength) {
    return {
      isValid: false,
      errorMsg: 'كلمة المرور يجب أن تتكون من 8 أحرف على الأقل.'
    };
  }

  if (!status.hasNumber) {
    return {
      isValid: false,
      errorMsg: 'كلمة المرور يجب أن تحتوي على رقم واحد على الأقل (0-9).'
    };
  }

  if (!status.hasSymbol) {
    return {
      isValid: false,
      errorMsg: 'كلمة المرور يجب أن تحتوي على رمز خاص واحد على الأقل (مثل @, #, $, !, %).'
    };
  }

  return { isValid: true };
};

/**
 * Checks if an artisan has true, continuous 24/7 emergency availability.
 * Rejects artisans who have limited/restricted working hours (e.g. 08:00 - 18:00).
 */
export const isArtisan247 = (artisan: { availableTimes?: string; availableNow?: boolean }): boolean => {
  if (!artisan) return false;

  const times = (artisan.availableTimes || '').toLowerCase();

  // Check if availableTimes explicitly indicates 24/7 or 24h continuous emergency availability
  const has247Text = times.includes('24/7') || 
                     times.includes('24/24') || 
                     times.includes('24 ساعة') || 
                     times.includes('على مدار 24') || 
                     times.includes('طوارئ 24');

  // Check if availableTimes specifies limited/restricted working hours (e.g. "08:00 - 18:00", "08:30 - 20:00")
  const hasSpecificTimeRange = /\d{1,2}:\d{2}\s*[-–—]\s*\d{1,2}:\d{2}/.test(times);

  // If the artisan has specific restricted hours, they are NOT 24/7 emergency available
  if (hasSpecificTimeRange) {
    return false;
  }

  // Must have 24/7 indicator in availableTimes and be availableNow
  return has247Text && Boolean(artisan.availableNow);
};

/**
 * Returns today's date formatted as YYYY-MM-DD according to local timezone.
 * Avoids UTC offset issues where late evening local time might shift to tomorrow UTC or vice versa.
 */
export const getTodayLocalDateString = (): string => {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

/**
 * Validates whether a date string (YYYY-MM-DD) is today or in the future.
 * Returns true if valid (today or future), false if in the past or invalid.
 */
export const isTodayOrFutureDate = (dateStr: string): boolean => {
  if (!dateStr || typeof dateStr !== 'string') return false;
  const todayStr = getTodayLocalDateString();
  return dateStr >= todayStr;
};

/**
 * Validates request date input.
 * Returns empty string if valid, or a human-readable Arabic error message if invalid.
 */
export const validateServiceRequestDate = (dateStr: string): string => {
  if (!dateStr || !dateStr.trim()) {
    return 'يرجى تحديد تاريخ طلب الخدمة المفضل.';
  }
  const todayStr = getTodayLocalDateString();
  if (dateStr.trim() < todayStr) {
    return 'لا يمكن اختيار تاريخ سابق! يرجى اختيار تاريخ اليوم أو تاريخ مستقبلي.';
  }
  return '';
};

/**
 * Validates artisan experience years according to business rules:
 * - Must be an integer number (whole years, no decimals)
 * - Must be within 0 to 60 years
 * - Disallows negative values, decimals, and values over 60
 * - Returns an empty string '' if valid, or a descriptive Arabic error message.
 */
export const validateExperienceYears = (val: string | number | null | undefined): string => {
  if (val === '' || val === undefined || val === null) {
    return 'يرجى إدخال عدد سنوات الخبرة.';
  }

  // Convert Arabic/Persian digits to standard ASCII digits
  const normalized = String(val)
    .trim()
    .replace(/[٠۰]/g, '0')
    .replace(/[١۱]/g, '1')
    .replace(/[٢۲]/g, '2')
    .replace(/[٣۳]/g, '3')
    .replace(/[٤۴]/g, '4')
    .replace(/[٥۵]/g, '5')
    .replace(/[٦۶]/g, '6')
    .replace(/[٧۷]/g, '7')
    .replace(/[٨۸]/g, '8')
    .replace(/[٩۹]/g, '9');

  if (!normalized) {
    return 'يرجى إدخال عدد سنوات الخبرة.';
  }

  // Check for negative numbers
  if (normalized.startsWith('-')) {
    return 'سنوات الخبرة لا يمكن أن تكون قيمة سالبة (الحد الأدنى هو 0).';
  }

  // Check for decimal numbers or fractions
  if (normalized.includes('.') || normalized.includes(',')) {
    return 'يرجى إدخال عدد صحيح لسنوات الخبرة بالأعوام الكاملة بدون فواصل عشرية (مثال: 5).';
  }

  // Check for non-digit characters
  if (!/^\d+$/.test(normalized)) {
    return 'يرجى إدخال رقم صحيح لسنوات الخبرة (بين 0 و 60 سنة).';
  }

  const num = parseInt(normalized, 10);
  if (isNaN(num)) {
    return 'يرجى إدخال رقم صحيح لسنوات الخبرة (بين 0 و 60 سنة).';
  }

  if (num < 0) {
    return 'سنوات الخبرة لا يمكن أن تكون قيمة سالبة (الحد الأدنى هو 0).';
  }

  if (num > 60) {
    return 'سنوات الخبرة لا يمكن أن تتجاوز 60 سنة كحد أقصى.';
  }

  return '';
};

/**
 * Safely parses and clamps experience years to the allowed [0, 60] range.
 * Used before saving or updating artisan profiles to prevent corrupt data even if client validation is bypassed.
 */
export const clampExperienceYears = (val: string | number | null | undefined, fallback = 0): number => {
  if (val === null || val === undefined || val === '') return fallback;
  const normalized = String(val)
    .trim()
    .replace(/[٠۰]/g, '0')
    .replace(/[١۱]/g, '1')
    .replace(/[٢۲]/g, '2')
    .replace(/[٣۳]/g, '3')
    .replace(/[٤۴]/g, '4')
    .replace(/[٥۵]/g, '5')
    .replace(/[٦۶]/g, '6')
    .replace(/[٧۷]/g, '7')
    .replace(/[٨۸]/g, '8')
    .replace(/[٩۹]/g, '9');

  const parsed = parseInt(normalized, 10);
  if (isNaN(parsed)) return fallback;
  return Math.min(60, Math.max(0, parsed));
};

/**
 * Formats experience years with proper Arabic grammar and terminology.
 * e.g. 0 -> 'خبرة أقل من سنة (مبتدئ)'
 *      1 -> 'خبرة سنة واحدة'
 *      2 -> 'خبرة سنتين'
 *      3-10 -> 'خبرة X سنوات'
 *      11-60 -> 'خبرة X سنة'
 */
export const formatExperienceYears = (years: number): string => {
  const safeYears = Math.min(60, Math.max(0, Math.floor(years || 0)));
  if (safeYears === 0) return 'خبرة أقل من سنة (مبتدئ)';
  if (safeYears === 1) return 'خبرة سنة واحدة';
  if (safeYears === 2) return 'خبرة سنتين';
  if (safeYears >= 3 && safeYears <= 10) return `خبرة ${safeYears} سنوات`;
  return `خبرة ${safeYears} سنة`;
};

/**
 * Resizes and compresses an image file using browser Canvas API to fit within localStorage quota.
 * Downscales dimensions to maxDimension (e.g., 800px) and compresses to JPEG format.
 */
export const compressImageFile = (
  file: File,
  maxDimension = 800,
  quality = 0.75
): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Failed to read image file'));
    reader.onload = (event) => {
      const img = new Image();
      img.onerror = () => reject(new Error('Failed to load image'));
      img.onload = () => {
        let { width, height } = img;
        if (width > maxDimension || height > maxDimension) {
          if (width > height) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          } else {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Failed to get canvas context'));
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);
        const compressedBase64 = canvas.toDataURL('image/jpeg', quality);
        resolve(compressedBase64);
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  });
};

