import { ServiceRequest, ServiceOffer, Artisan, RequestUrgency, ServiceRequestStatus, ServiceOfferStatus } from '../types';

export interface UrgencyOption {
  value: RequestUrgency;
  label: string;
  sublabel: string;
  badgeColor: string;
}

export const URGENCY_OPTIONS: UrgencyOption[] = [
  { value: 'now', label: 'الآن (مستعجل)', sublabel: 'خلال ساعات قليلة اليوم', badgeColor: 'bg-rose-50 text-rose-700 border-rose-200' },
  { value: 'today', label: 'اليوم', sublabel: 'في أي وقت مناسب اليوم', badgeColor: 'bg-amber-50 text-amber-700 border-amber-200' },
  { value: 'scheduled', label: 'موعد محدد', sublabel: 'تحديد تاريخ لاحق', badgeColor: 'bg-blue-50 text-blue-700 border-blue-200' },
  { value: 'flexible', label: 'مرن', sublabel: 'حسب توافر الحرفي', badgeColor: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
];

export function getUrgencyInfo(urgency: RequestUrgency): UrgencyOption {
  const found = URGENCY_OPTIONS.find(o => o.value === urgency);
  return found || { value: urgency, label: urgency, sublabel: '', badgeColor: 'bg-stone-50 text-stone-700 border-stone-200' };
}

export function getStatusBadgeInfo(status: ServiceRequestStatus): { label: string; bg: string; text: string; border: string; dot: string } {
  switch (status) {
    case 'open':
      return {
        label: 'بانتظار العروض',
        bg: 'bg-amber-50',
        text: 'text-amber-800',
        border: 'border-amber-200/80',
        dot: 'bg-amber-500',
      };
    case 'offers_received':
      return {
        label: 'وصلت عروض',
        bg: 'bg-blue-50',
        text: 'text-blue-800',
        border: 'border-blue-200/80',
        dot: 'bg-blue-500',
      };
    case 'assigned':
      return {
        label: 'تم اختيار حرفي',
        bg: 'bg-emerald-50',
        text: 'text-emerald-800',
        border: 'border-emerald-200/80',
        dot: 'bg-emerald-600',
      };
    case 'completed':
      return {
        label: 'مكتمل',
        bg: 'bg-stone-100',
        text: 'text-stone-700',
        border: 'border-stone-200',
        dot: 'bg-stone-500',
      };
    case 'cancelled':
      return {
        label: 'ملغى',
        bg: 'bg-rose-50',
        text: 'text-rose-700',
        border: 'border-rose-200',
        dot: 'bg-rose-500',
      };
    default:
      return {
        label: status,
        bg: 'bg-stone-50',
        text: 'text-stone-700',
        border: 'border-stone-200',
        dot: 'bg-stone-400',
      };
  }
}

/**
 * Formats offer count in Arabic grammar
 */
export function formatOffersCountLabel(count: number): string {
  if (count <= 0) return 'لا توجد عروض بعد';
  if (count === 1) return 'عرض واحد';
  if (count === 2) return 'عرضان';
  if (count >= 3 && count <= 10) return `${count} عروض`;
  return `${count} عرضاً`;
}

/**
 * Deterministic Matching Logic for Artisan:
 * 1. Matching category is prioritized highest.
 * 2. Matching wilaya within that category is boosted.
 * 3. Urgency 'now' / 'today' prioritized.
 * 4. Active requests (open or offers_received) shown first.
 */
/**
 * Pure selector: Filters and matches service requests for an artisan.
 * In 'suitable' mode:
 * - Professional/category compatibility is a MANDATORY prerequisite; non-matching categories are strictly excluded.
 * - Geographic proximity (Wilaya/City) and urgency boost relevance ordering, but cannot compensate for profession mismatch.
 * In 'all' mode:
 * - Shows all active non-cancelled requests chronologically.
 */
export function matchRequestsForArtisan(
  requests: ServiceRequest[],
  artisan: Artisan,
  filterType: 'all' | 'suitable' = 'suitable'
): ServiceRequest[] {
  if (!Array.isArray(requests) || requests.length === 0) return [];

  // Filter out cancelled requests
  const visible = requests.filter(r => r.status !== 'cancelled');

  if (filterType === 'all') {
    return [...visible].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  // Mandatory prerequisite: professional/category compatibility
  const matchingCategory = visible.filter(
    req => req.category && artisan.category && req.category.toLowerCase() === artisan.category.toLowerCase()
  );

  // Score matching category requests for relevance ordering
  const scored = matchingCategory.map(req => {
    let score = 50; // Base score for exact category match
    const isExactWilaya = req.wilaya === artisan.wilaya;
    const isExactCity = !!(artisan.city && req.city === artisan.city);

    if (isExactWilaya) score += 20;
    if (isExactCity) score += 10;
    if (req.urgency === 'now') score += 15;
    else if (req.urgency === 'today') score += 10;
    if (req.status === 'open' || req.status === 'offers_received') score += 10;

    return { req, score };
  });

  return scored
    .sort((a, b) => b.score - a.score || new Date(b.req.createdAt).getTime() - new Date(a.req.createdAt).getTime())
    .map(item => item.req);
}

/**
 * Validates and parses service request budget:
 * - empty / null / undefined -> valid (unspecified budget)
 * - 0 -> valid (free / volunteer / consultation)
 * - >0 -> valid (specified budget)
 * - <0 -> invalid
 * - invalid input (non-numeric) -> invalid
 */
export function validateServiceRequestBudget(val: unknown): {
  isValid: boolean;
  parsedBudget?: number;
  error?: string;
} {
  if (val === undefined || val === null) {
    return { isValid: true, parsedBudget: undefined };
  }

  if (typeof val === 'number') {
    if (!Number.isFinite(val) || val < 0) {
      return { isValid: false, error: 'يرجى إدخال ميزانية صحيحة (0 أو أكثر) أو ترك الحقل فارغاً.' };
    }
    return { isValid: true, parsedBudget: val };
  }

  if (typeof val === 'string') {
    const trimmed = val.trim();
    if (!trimmed) {
      return { isValid: true, parsedBudget: undefined };
    }
    if (trimmed.startsWith('-')) {
      return { isValid: false, error: 'يرجى إدخال ميزانية صحيحة (0 أو أكثر) أو ترك الحقل فارغاً.' };
    }

    // Normalize Eastern Arabic and Persian digits
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

    const cleaned = normalized.replace(/\s*(د\.?ج|da|dzd)\s*/gi, '').trim();
    if (!/^\d+$/.test(cleaned)) {
      return { isValid: false, error: 'يرجى إدخال ميزانية صحيحة (0 أو أكثر) أو ترك الحقل فارغاً.' };
    }

    const num = parseInt(cleaned, 10);
    if (!Number.isFinite(num) || num < 0) {
      return { isValid: false, error: 'يرجى إدخال ميزانية صحيحة (0 أو أكثر) أو ترك الحقل فارغاً.' };
    }

    return { isValid: true, parsedBudget: num };
  }

  return { isValid: false, error: 'يرجى إدخال ميزانية صحيحة (0 أو أكثر) أو ترك الحقل فارغاً.' };
}

/**
 * Validates and parses service offer proposed price:
 * - 0 -> valid (free consultation / service)
 * - >0 -> valid (specified offer price)
 * - <0 -> invalid
 * - NaN / invalid string -> invalid
 * - empty -> invalid (price is mandatory for offer)
 */
export function validateServiceOfferPrice(val: unknown): {
  isValid: boolean;
  parsedPrice?: number;
  error?: string;
} {
  if (val === undefined || val === null) {
    return { isValid: false, error: 'يرجى إدخال السعر المقترح.' };
  }

  if (typeof val === 'number') {
    if (!Number.isFinite(val) || val < 0) {
      return { isValid: false, error: 'يرجى إدخال سعر مقترح صحيح (0 أو أكثر) بالدينار الجزائري.' };
    }
    return { isValid: true, parsedPrice: val };
  }

  if (typeof val === 'string') {
    const trimmed = val.trim();
    if (!trimmed) {
      return { isValid: false, error: 'يرجى إدخال السعر المقترح.' };
    }
    if (trimmed.startsWith('-')) {
      return { isValid: false, error: 'يرجى إدخال سعر مقترح صحيح (0 أو أكثر) بالدينار الجزائري.' };
    }

    // Normalize Eastern Arabic and Persian digits
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

    const cleaned = normalized.replace(/\s*(د\.?ج|da|dzd)\s*/gi, '').trim();
    if (!/^\d+$/.test(cleaned)) {
      return { isValid: false, error: 'يرجى إدخال سعر مقترح صحيح بالدينار الجزائري.' };
    }

    const num = parseInt(cleaned, 10);
    if (!Number.isFinite(num) || num < 0) {
      return { isValid: false, error: 'يرجى إدخال سعر مقترح صحيح (0 أو أكثر) بالدينار الجزائري.' };
    }

    return { isValid: true, parsedPrice: num };
  }

  return { isValid: false, error: 'يرجى إدخال سعر مقترح صحيح بالدينار الجزائري.' };
}

/**
 * ServiceRequest state transition validation rule.
 * Statuses: 'open' | 'offers_received' | 'assigned' | 'completed' | 'cancelled'
 */
export function isValidServiceRequestTransition(fromStatus: ServiceRequestStatus, toStatus: ServiceRequestStatus): boolean {
  if (fromStatus === toStatus) return true;

  // Completed requests are terminal states and cannot change to anything else
  if (fromStatus === 'completed') {
    return false;
  }

  if (fromStatus === 'cancelled') {
    // Allows request re-opening/re-assignment (and ensures legacy test compatibility)
    return toStatus === 'open' || toStatus === 'offers_received' || toStatus === 'assigned';
  }

  if (fromStatus === 'open') {
    return toStatus === 'offers_received' || toStatus === 'assigned' || toStatus === 'cancelled';
  }

  if (fromStatus === 'offers_received') {
    return toStatus === 'open' || toStatus === 'assigned' || toStatus === 'cancelled';
  }

  if (fromStatus === 'assigned') {
    // Can go to completed, cancelled, or open/offers_received (for atomic assignment rollback support)
    return toStatus === 'completed' || toStatus === 'cancelled' || toStatus === 'open' || toStatus === 'offers_received';
  }

  return false;
}

/**
 * ServiceOffer state transition validation rule.
 * Statuses: 'pending' | 'accepted' | 'not_selected' | 'rejected' | 'withdrawn'
 */
export function isValidServiceOfferTransition(
  fromStatus: ServiceOfferStatus,
  toStatus: ServiceOfferStatus
): boolean {
  if (fromStatus === toStatus) return true;

  // Withdrawn and not_selected are terminal states.
  if (fromStatus === 'withdrawn' || fromStatus === 'not_selected') {
    return false;
  }

  if (fromStatus === 'pending') {
    return (
      toStatus === 'accepted' ||
      toStatus === 'not_selected' ||
      toStatus === 'rejected' ||
      toStatus === 'withdrawn'
    );
  }

  if (fromStatus === 'accepted') {
    // Pending is required only for internal assignment rollback.
    return (
      toStatus === 'pending' ||
      toStatus === 'withdrawn' ||
      toStatus === 'rejected'
    );
  }

  // Legacy rejected records remain readable and reversible
  // only according to the existing rollback behavior.
  if (fromStatus === 'rejected') {
    return toStatus === 'pending';
  }

  return false;
}
