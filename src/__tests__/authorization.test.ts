/**
 * ============================================================================
 * BRICOJOBDZ — STAGE 3: AUTHORIZATION REGRESSION MATRIX & SECURITY HARDENING
 * ============================================================================
 * These tests intentionally protect authorization invariants.
 * Any future change to marketplace workflows must update the
 * authorization policy and these regression expectations together.
 *
 * Invariants Enforced:
 * 1. Ownership: Only canonical owner ID may mutate owned resource.
 * 2. Role: Wrong role cannot perform role-restricted actions.
 * 3. Relationship: Resource A cannot be operated on through unrelated Resource B.
 * 4. State: Invalid resource state cannot bypass authorization (e.g., assigned/completed locks).
 * 5. Identity: Name, email, and phone cannot establish ownership or bypass checks.
 * 6. Self-action: Self-restricted actions remain strictly denied.
 * 7. Missing identity / Malformed: Unknown actor/resource -> DENY BY DEFAULT.
 * ============================================================================
 */

import { describe, it, expect } from 'vitest';
import {
  canEditServiceRequest,
  canCancelServiceRequest,
  canSubmitOffer,
  canAcceptOffer,
  canRejectOffer,
  canEditOffer,
  canHandleContactRequest,
  canCreateContactRequest,
  canEditArtisanProfile,
  canFavoriteArtisan,
  canReviewArtisan,
  canEditReview,
  canDeleteReview,
  canAccessOrder,
  canViewUserOrders,
  canViewServiceRequest,
  resolveCurrentArtisan,
  isOwnArtisanProfile,
  filterUserOrders,
  hasUserReviewedArtisan,
  countUserReviews,
} from '../domain';
import {
  UserSession,
  Artisan,
  ServiceRequest,
  ServiceOffer,
  ServiceContactRequest,
  OrderItem,
  Review,
  ServiceRequestStatus,
} from '../types';

/* ============================================================================
 * CANONICAL FIXTURES: ACTOR MATRIX
 * ============================================================================ */
const GUEST = null;

const USER_A: UserSession = {
  id: 'user-a',
  name: 'أحمد بن علي',
  email: 'ahmed.benali@example.com',
  phone: '0550111111',
  role: 'user',
  createdAt: '2026-01-01T00:00:00.000Z',
};

const USER_B: UserSession = {
  id: 'user-b',
  name: 'سليم عماري',
  email: 'salim.amari@example.com',
  phone: '0660222222',
  role: 'user',
  createdAt: '2026-01-01T00:00:00.000Z',
};

// Same Name Trap: identical name to USER_A, but completely different canonical id
const USER_IMPOSTER_SAME_NAME: UserSession = {
  id: 'user-imposter-name',
  name: 'أحمد بن علي', // Same name
  email: 'imposter.name@example.com',
  role: 'user',
  createdAt: '2026-01-01T00:00:00.000Z',
};

// Same Email Trap: identical email to USER_A, but completely different canonical id
const USER_IMPOSTER_SAME_EMAIL: UserSession = {
  id: 'user-imposter-email',
  name: 'مستخدم آخر',
  email: 'ahmed.benali@example.com', // Same email
  role: 'user',
  createdAt: '2026-01-01T00:00:00.000Z',
};

// Same Name AND Same Email Trap: wrong ID
const USER_IMPOSTER_SAME_ALL: UserSession = {
  id: 'user-imposter-all',
  name: 'أحمد بن علي',
  email: 'ahmed.benali@example.com',
  role: 'user',
  createdAt: '2026-01-01T00:00:00.000Z',
};

// Artisan Actor A: Plumber
const ARTISAN_ACTOR_A: UserSession = {
  id: 'user-artisan-a',
  name: 'كريم بلومبي',
  email: 'karim.plumber@artisan.com',
  role: 'artisan',
  artisanId: 'artisan-profile-a',
  createdAt: '2026-01-01T00:00:00.000Z',
};

// Artisan Actor B: Electrician
const ARTISAN_ACTOR_B: UserSession = {
  id: 'user-artisan-b',
  name: 'مصطفى كهربائي',
  email: 'mustapha.elec@artisan.com',
  role: 'artisan',
  artisanId: 'artisan-profile-b',
  createdAt: '2026-01-01T00:00:00.000Z',
};

// Artisan Imposter: same name as ARTISAN_ACTOR_A but different id & artisanId
const ARTISAN_IMPOSTER_SAME_NAME: UserSession = {
  id: 'user-imposter-artisan',
  name: 'كريم بلومبي',
  email: 'imposter.artisan@artisan.com',
  role: 'artisan',
  artisanId: 'artisan-profile-imposter',
  createdAt: '2026-01-01T00:00:00.000Z',
};

/* ============================================================================
 * CANONICAL FIXTURES: RESOURCE MATRIX
 * ============================================================================ */
const ARTISAN_PROFILE_A: Artisan = {
  id: 'artisan-profile-a',
  name: 'كريم بلومبي',
  profession: 'سباك صحي',
  category: 'plumbing',
  wilaya: 'الجزائر',
  city: 'باب الوادي',
  phone: '0555123456',
  startingPrice: 1500,
  rating: 4.8,
  reviewCount: 10,
  avatar: 'https://images.unsplash.com/photo-avatar-a.jpg',
  verified: true,
  experienceYears: 8,
  bio: 'سباك صحي مؤهل وخبير في تصليح التسربات',
  services: ['تصليح تسربات', 'تركيب شبكات المياه'],
  portfolio: [],
  availableTimes: '8:00 - 18:00',
  availableNow: true,
  reviews: [],
};

const ARTISAN_PROFILE_B: Artisan = {
  id: 'artisan-profile-b',
  name: 'مصطفى كهربائي',
  profession: 'كهربائي منازل',
  category: 'electricity',
  wilaya: 'الجزائر',
  city: 'باب الوادي',
  phone: '0666123456',
  startingPrice: 2000,
  rating: 4.9,
  reviewCount: 15,
  avatar: 'https://images.unsplash.com/photo-avatar-b.jpg',
  verified: true,
  experienceYears: 12,
  bio: 'كهربائي معتمد للتركيبات المنزلية والصناعية',
  services: ['تركيب لوحات التوزيع', 'إصلاح القواطع'],
  portfolio: [],
  availableTimes: '8:00 - 20:00',
  availableNow: false,
  reviews: [],
};

const REQUEST_A: ServiceRequest = {
  id: 'req-a',
  clientId: 'user-a',
  clientName: 'أحمد بن علي',
  clientPhone: '0550111111',
  category: 'plumbing',
  title: 'إصلاح تسرب مياه تحت حوض المطبخ',
  description: 'تسرب مياه مستمر يحتاج سباكاً فورياً اليوم.',
  wilaya: 'الجزائر',
  city: 'باب الوادي',
  urgency: 'today',
  status: 'open',
  createdAt: '2026-03-01T10:00:00.000Z',
};

const REQUEST_B: ServiceRequest = {
  id: 'req-b',
  clientId: 'user-b',
  clientName: 'سليم عماري',
  clientPhone: '0660222222',
  category: 'electricity',
  title: 'تركيب لوحة قواطع جديدة',
  description: 'تجديد كامل للأسلاك واللوحة الكهربائية.',
  wilaya: 'الجزائر',
  city: 'باب الوادي',
  urgency: 'scheduled',
  status: 'open',
  createdAt: '2026-03-01T11:00:00.000Z',
};

const OFFER_A: ServiceOffer = {
  id: 'offer-a',
  requestId: 'req-a',
  artisanId: 'artisan-profile-a',
  artisanName: 'كريم بلومبي',
  artisanProfession: 'سباك صحي',
  proposedPrice: 1800,
  status: 'pending',
  createdAt: '2026-03-01T12:00:00.000Z',
};

const OFFER_B: ServiceOffer = {
  id: 'offer-b',
  requestId: 'req-b',
  artisanId: 'artisan-profile-b',
  artisanName: 'مصطفى كهربائي',
  artisanProfession: 'كهربائي منازل',
  proposedPrice: 2500,
  status: 'pending',
  createdAt: '2026-03-01T12:30:00.000Z',
};

const CONTACT_REQUEST_A: ServiceContactRequest = {
  id: 'contact-req-a',
  artisanId: 'artisan-profile-a',
  artisanName: 'كريم بلومبي',
  customerId: 'user-a',
  customerName: 'أحمد بن علي',
  customerPhone: '0550111111',
  service: 'سباكة عاجلة',
  description: 'أريد معرفة موعد توفرك غداً صباحاً',
  preferredContact: 'phone',
  status: 'pending',
  createdAt: '2026-03-01T13:00:00.000Z',
};

const CONTACT_REQUEST_B: ServiceContactRequest = {
  id: 'contact-req-b',
  artisanId: 'artisan-profile-b',
  artisanName: 'مصطفى كهربائي',
  customerId: 'user-b',
  customerName: 'سليم عماري',
  customerPhone: '0660222222',
  service: 'تمديدات كهرباء',
  description: 'استشارة حول لوحة التوزيع',
  preferredContact: 'whatsapp',
  status: 'pending',
  createdAt: '2026-03-01T13:30:00.000Z',
};

const ORDER_A: OrderItem = {
  id: 'ord-a',
  clientId: 'user-a',
  clientName: 'أحمد بن علي',
  clientEmail: 'ahmed.benali@example.com',
  clientPhone: '0550111111',
  artisanId: 'artisan-profile-a',
  artisanName: 'كريم بلومبي',
  artisanProfession: 'سباك صحي',
  preferredDate: '2026-03-05',
  serviceDetails: 'صيانة سباكة كاملة',
  status: 'assigned',
  createdAt: '2026-03-01T14:00:00.000Z',
};

const ORDER_B: OrderItem = {
  id: 'ord-b',
  clientId: 'user-b',
  clientName: 'سليم عماري',
  clientEmail: 'salim.amari@example.com',
  clientPhone: '0660222222',
  artisanId: 'artisan-profile-b',
  artisanName: 'مصطفى كهربائي',
  artisanProfession: 'كهربائي منازل',
  preferredDate: '2026-03-06',
  serviceDetails: 'تركيب قواطع',
  status: 'assigned',
  createdAt: '2026-03-01T14:30:00.000Z',
};

const REVIEW_A: Review = {
  id: 'rev-a',
  userId: 'user-a',
  userName: 'أحمد بن علي',
  rating: 5,
  comment: 'عمل احترافي ومتقن',
  date: 'اليوم',
};

const REVIEW_B: Review = {
  id: 'rev-b',
  userId: 'user-b',
  userName: 'سليم عماري',
  rating: 4,
  comment: 'خدمة جيدة جداً',
  date: 'أمس',
};

describe('BRICOJOBDZ — STAGE 3 AUTHORIZATION REGRESSION MATRIX', () => {

  /* =========================================================================
   * 1. TABLE-DRIVEN SERVICE REQUEST STATE MATRIX (Actor × Status × Action)
   * 40 Combinations: 4 Actors × 5 Statuses × 2 Actions (Edit, Cancel)
   * ========================================================================= */
  describe('1. Table-Driven Service Request State Matrix (Actor × Status × Action)', () => {
    type MatrixRow = {
      actorLabel: string;
      actor: UserSession | null;
      status: ServiceRequestStatus;
      action: 'edit' | 'cancel';
      expected: boolean;
      reason: string;
    };

    const statuses: ServiceRequestStatus[] = ['open', 'offers_received', 'assigned', 'completed', 'cancelled'];
    const actions: Array<'edit' | 'cancel'> = ['edit', 'cancel'];

    const matrixTable: MatrixRow[] = [];

    // Build the systematic matrix
    for (const st of statuses) {
      for (const act of actions) {
        // 1. Owner (USER_A)
        const ownerCanAct = (st === 'open' || st === 'offers_received');
        matrixTable.push({
          actorLabel: 'Owner (USER_A)',
          actor: USER_A,
          status: st,
          action: act,
          expected: ownerCanAct,
          reason: ownerCanAct
            ? `Owner is permitted to ${act} when status is '${st}'`
            : `Owner is locked from ${act} when status is '${st}' (assigned/completed/cancelled state lock)`,
        });

        // 2. Non-Owner (USER_B) - Horizontal escalation attempt
        matrixTable.push({
          actorLabel: 'Non-Owner (USER_B)',
          actor: USER_B,
          status: st,
          action: act,
          expected: false,
          reason: `Non-owner must always be DENIED to ${act} on request A regardless of state`,
        });

        // 3. Artisan (ARTISAN_ACTOR_A) - Vertical escalation attempt
        matrixTable.push({
          actorLabel: 'Artisan (ARTISAN_ACTOR_A)',
          actor: ARTISAN_ACTOR_A,
          status: st,
          action: act,
          expected: false,
          reason: `Artisan cannot ${act} customer service requests regardless of state`,
        });

        // 4. Guest - Unauthenticated access attempt
        matrixTable.push({
          actorLabel: 'Guest (null)',
          actor: GUEST,
          status: st,
          action: act,
          expected: false,
          reason: `Guest cannot ${act} service requests regardless of state`,
        });
      }
    }

    it.each(matrixTable)(
      '$actorLabel -> $action Request A [status=$status] => expected: $expected ($reason)',
      ({ actor, status, action, expected }) => {
        const testReq: ServiceRequest = { ...REQUEST_A, status };
        const result = action === 'edit'
          ? canEditServiceRequest(actor, testReq)
          : canCancelServiceRequest(actor, testReq);

        expect(result).toBe(expected);
      }
    );
  });

  /* =========================================================================
   * 2. HORIZONTAL AUTHORIZATION REGRESSION (User A ↔ User B, Artisan A ↔ Artisan B)
   * OWASP Horizontal Escalation & Cross-Tenant Resource Isolation
   * ========================================================================= */
  describe('2. Horizontal Authorization Regression', () => {
    describe('Customer-to-Customer Resource Isolation (User A ↔ User B)', () => {
      it('DENIES User A from editing User B request', () => {
        expect(canEditServiceRequest(USER_A, REQUEST_B)).toBe(false);
      });

      it('DENIES User B from editing User A request', () => {
        expect(canEditServiceRequest(USER_B, REQUEST_A)).toBe(false);
      });

      it('DENIES User A from cancelling User B request', () => {
        expect(canCancelServiceRequest(USER_A, REQUEST_B)).toBe(false);
      });

      it('DENIES User B from cancelling User A request', () => {
        expect(canCancelServiceRequest(USER_B, REQUEST_A)).toBe(false);
      });

      it('DENIES User A from accepting an offer on User B request', () => {
        expect(canAcceptOffer(USER_A, REQUEST_B, OFFER_B)).toBe(false);
      });

      it('DENIES User B from accepting an offer on User A request', () => {
        expect(canAcceptOffer(USER_B, REQUEST_A, OFFER_A)).toBe(false);
      });

      it('DENIES User A from rejecting an offer on User B request', () => {
        expect(canRejectOffer(USER_A, REQUEST_B, OFFER_B)).toBe(false);
      });

      it('DENIES User B from rejecting an offer on User A request', () => {
        expect(canRejectOffer(USER_B, REQUEST_A, OFFER_A)).toBe(false);
      });

      it('DENIES User A from accessing User B order', () => {
        expect(canAccessOrder(USER_A, ORDER_B)).toBe(false);
      });

      it('DENIES User B from accessing User A order', () => {
        expect(canAccessOrder(USER_B, ORDER_A)).toBe(false);
      });

      it('DENIES User A from viewing User B orders collection', () => {
        expect(canViewUserOrders(USER_A, USER_B.id)).toBe(false);
      });

      it('DENIES User B from viewing User A orders collection', () => {
        expect(canViewUserOrders(USER_B, USER_A.id)).toBe(false);
      });

      it('DENIES User A from editing User B review', () => {
        expect(canEditReview(USER_A, REVIEW_B)).toBe(false);
      });

      it('DENIES User B from editing User A review', () => {
        expect(canEditReview(USER_B, REVIEW_A)).toBe(false);
      });

      it('DENIES User A from deleting User B review', () => {
        expect(canDeleteReview(USER_A, REVIEW_B)).toBe(false);
      });

      it('DENIES User B from deleting User A review', () => {
        expect(canDeleteReview(USER_B, REVIEW_A)).toBe(false);
      });
    });

    describe('Artisan-to-Artisan Resource Isolation (Artisan A ↔ Artisan B)', () => {
      it('ALLOWS Artisan A to edit their own profile', () => {
        expect(canEditArtisanProfile(ARTISAN_ACTOR_A, ARTISAN_PROFILE_A)).toBe(true);
      });

      it('DENIES Artisan A from editing Artisan B profile', () => {
        expect(canEditArtisanProfile(ARTISAN_ACTOR_A, ARTISAN_PROFILE_B)).toBe(false);
      });

      it('DENIES Artisan B from editing Artisan A profile', () => {
        expect(canEditArtisanProfile(ARTISAN_ACTOR_B, ARTISAN_PROFILE_A)).toBe(false);
      });

      it('ALLOWS Artisan A to handle their own Contact Request A', () => {
        expect(canHandleContactRequest(ARTISAN_ACTOR_A, CONTACT_REQUEST_A, ARTISAN_PROFILE_A)).toBe(true);
      });

      it('DENIES Artisan A from handling Artisan B Contact Request B', () => {
        expect(canHandleContactRequest(ARTISAN_ACTOR_A, CONTACT_REQUEST_B, ARTISAN_PROFILE_A)).toBe(false);
      });

      it('DENIES Artisan B from handling Artisan A Contact Request A', () => {
        expect(canHandleContactRequest(ARTISAN_ACTOR_B, CONTACT_REQUEST_A, ARTISAN_PROFILE_B)).toBe(false);
      });

      it('ALLOWS Artisan A to edit/withdraw their own pending offer', () => {
        expect(canEditOffer(ARTISAN_ACTOR_A, REQUEST_A, OFFER_A, ARTISAN_PROFILE_A)).toBe(true);
      });

      it('DENIES Artisan A from editing/withdrawing Artisan B offer', () => {
        expect(canEditOffer(ARTISAN_ACTOR_A, REQUEST_B, OFFER_B, ARTISAN_PROFILE_A)).toBe(false);
      });

      it('DENIES Artisan B from editing/withdrawing Artisan A offer', () => {
        expect(canEditOffer(ARTISAN_ACTOR_B, REQUEST_A, OFFER_A, ARTISAN_PROFILE_B)).toBe(false);
      });

      it('ALLOWS Artisan A to favorite Artisan B (marketplace networking)', () => {
        expect(canFavoriteArtisan(ARTISAN_ACTOR_A, ARTISAN_PROFILE_B)).toBe(true);
      });

      it('ALLOWS Artisan B to favorite Artisan A', () => {
        expect(canFavoriteArtisan(ARTISAN_ACTOR_B, ARTISAN_PROFILE_A)).toBe(true);
      });
    });
  });

  /* =========================================================================
   * 3. VERTICAL AUTHORIZATION REGRESSION (Guest ↔ Customer ↔ Artisan)
   * Role-based boundaries & privilege escalation prevention
   * ========================================================================= */
  describe('3. Vertical Authorization Regression', () => {
    describe('Guest Role Isolation (Unauthenticated Actor Denials)', () => {
      it.each([
        { action: 'edit request', check: () => canEditServiceRequest(GUEST, REQUEST_A) },
        { action: 'cancel request', check: () => canCancelServiceRequest(GUEST, REQUEST_A) },
        { action: 'submit offer', check: () => canSubmitOffer(GUEST, REQUEST_A, ARTISAN_PROFILE_A) },
        { action: 'accept offer', check: () => canAcceptOffer(GUEST, REQUEST_A, OFFER_A) },
        { action: 'reject offer', check: () => canRejectOffer(GUEST, REQUEST_A, OFFER_A) },
        { action: 'edit offer', check: () => canEditOffer(GUEST, REQUEST_A, OFFER_A, ARTISAN_PROFILE_A) },
        { action: 'handle contact request', check: () => canHandleContactRequest(GUEST, CONTACT_REQUEST_A, ARTISAN_PROFILE_A) },
        { action: 'edit artisan profile', check: () => canEditArtisanProfile(GUEST, ARTISAN_PROFILE_A) },
        { action: 'review artisan', check: () => canReviewArtisan(GUEST, ARTISAN_PROFILE_A) },
        { action: 'edit review', check: () => canEditReview(GUEST, REVIEW_A) },
        { action: 'delete review', check: () => canDeleteReview(GUEST, REVIEW_A) },
        { action: 'access order', check: () => canAccessOrder(GUEST, ORDER_A) },
        { action: 'view user orders', check: () => canViewUserOrders(GUEST, USER_A.id) },
      ])('DENIES guest from: $action', ({ check }) => {
        expect(check()).toBe(false);
      });

      it('ALLOWS guest public discovery (view open service request, view artisan, create contact)', () => {
        expect(canViewServiceRequest(GUEST, REQUEST_A)).toBe(true);
        expect(canCreateContactRequest(GUEST, ARTISAN_PROFILE_A)).toBe(true);
        expect(canFavoriteArtisan(GUEST, ARTISAN_PROFILE_A)).toBe(true);
      });
    });

    describe('Customer Role Isolation (Denial of Artisan-only Operations)', () => {
      it('DENIES customer from submitting an offer to a request', () => {
        expect(canSubmitOffer(USER_A, REQUEST_A, ARTISAN_PROFILE_A)).toBe(false);
      });

      it('DENIES customer from editing an artisan profile', () => {
        expect(canEditArtisanProfile(USER_A, ARTISAN_PROFILE_A)).toBe(false);
      });

      it('DENIES customer from handling an artisan contact request', () => {
        expect(canHandleContactRequest(USER_A, CONTACT_REQUEST_A, ARTISAN_PROFILE_A)).toBe(false);
      });

      it('DENIES customer from editing/withdrawing an artisan offer', () => {
        expect(canEditOffer(USER_A, REQUEST_A, OFFER_A, ARTISAN_PROFILE_A)).toBe(false);
      });
    });

    describe('Artisan Role Isolation (Denial of Customer-only Operations)', () => {
      it('DENIES artisan from editing a customer service request', () => {
        expect(canEditServiceRequest(ARTISAN_ACTOR_A, REQUEST_A)).toBe(false);
      });

      it('DENIES artisan from cancelling a customer service request', () => {
        expect(canCancelServiceRequest(ARTISAN_ACTOR_A, REQUEST_A)).toBe(false);
      });

      it('DENIES artisan from accepting an offer on a customer request', () => {
        expect(canAcceptOffer(ARTISAN_ACTOR_A, REQUEST_A, OFFER_A)).toBe(false);
      });

      it('DENIES artisan from rejecting an offer on a customer request', () => {
        expect(canRejectOffer(ARTISAN_ACTOR_A, REQUEST_A, OFFER_A)).toBe(false);
      });
    });
  });

  /* =========================================================================
   * 4. OBJECT RELATIONSHIP & CROSS-RESOURCE CONFUSION TESTS
   * Object-Level Authorization: Offer ↔ Request, Contact ↔ Artisan, Order ↔ Client
   * ========================================================================= */
  describe('4. Object Relationship & Cross-Resource Confusion', () => {
    it('DENIES accept offer when offer belongs to a DIFFERENT request (Cross-Request Confusion)', () => {
      // USER_A owns REQUEST_A. OFFER_B belongs to REQUEST_B.
      // Even though USER_A is an authenticated client, OFFER_B does not match REQUEST_A.id.
      expect(canAcceptOffer(USER_A, REQUEST_A, OFFER_B)).toBe(false);
    });

    it('DENIES reject offer when offer belongs to a DIFFERENT request', () => {
      expect(canRejectOffer(USER_A, REQUEST_A, OFFER_B)).toBe(false);
    });

    it('DENIES edit offer when offer belongs to a DIFFERENT request than provided request', () => {
      // OFFER_A has requestId: req-a. If REQUEST_B (req-b) is passed, must reject.
      expect(canEditOffer(ARTISAN_ACTOR_A, REQUEST_B, OFFER_A, ARTISAN_PROFILE_A)).toBe(false);
    });

    it('DENIES contact handling when contactRequest.artisanId does not match artisan.id', () => {
      // CONTACT_REQUEST_B has artisanId: artisan-profile-b. Passed with ARTISAN_PROFILE_A.
      expect(canHandleContactRequest(ARTISAN_ACTOR_A, CONTACT_REQUEST_B, ARTISAN_PROFILE_A)).toBe(false);
    });

    it('DENIES order access when order.clientId does not match actor.id', () => {
      expect(canAccessOrder(USER_A, ORDER_B)).toBe(false);
    });
  });

  /* =========================================================================
   * 5. CANONICAL IDENTITY INTEGRITY TESTS (ID vs Name vs Email vs Phone)
   * Strictly enforces: Canonical ID is the ONLY source of authorization authority.
   * ========================================================================= */
  describe('5. Canonical Identity Integrity (ID = Authority)', () => {
    describe('Service Request Ownership by Canonical ID Only', () => {
      it('ALLOWS owner with correct ID', () => {
        expect(canEditServiceRequest(USER_A, REQUEST_A)).toBe(true);
      });

      it('DENIES imposter with IDENTICAL NAME but different ID (Same-Name Attack)', () => {
        expect(canEditServiceRequest(USER_IMPOSTER_SAME_NAME, REQUEST_A)).toBe(false);
        expect(canCancelServiceRequest(USER_IMPOSTER_SAME_NAME, REQUEST_A)).toBe(false);
      });

      it('DENIES imposter with IDENTICAL EMAIL but different ID (Same-Email Attack)', () => {
        expect(canEditServiceRequest(USER_IMPOSTER_SAME_EMAIL, REQUEST_A)).toBe(false);
        expect(canCancelServiceRequest(USER_IMPOSTER_SAME_EMAIL, REQUEST_A)).toBe(false);
      });

      it('DENIES imposter with IDENTICAL NAME AND EMAIL but different ID', () => {
        expect(canEditServiceRequest(USER_IMPOSTER_SAME_ALL, REQUEST_A)).toBe(false);
        expect(canCancelServiceRequest(USER_IMPOSTER_SAME_ALL, REQUEST_A)).toBe(false);
      });

      it('ALLOWS owner even if their name is completely changed in their session (ID invariance)', () => {
        const renamedUser: UserSession = { ...USER_A, name: 'اسم مختلف تماماً' };
        expect(canEditServiceRequest(renamedUser, REQUEST_A)).toBe(true);
        expect(canCancelServiceRequest(renamedUser, REQUEST_A)).toBe(true);
      });

      it('ALLOWS owner even if their email is completely changed in their session (ID invariance)', () => {
        const reemailedUser: UserSession = { ...USER_A, email: 'completely.different@email.dz' };
        expect(canEditServiceRequest(reemailedUser, REQUEST_A)).toBe(true);
        expect(canCancelServiceRequest(reemailedUser, REQUEST_A)).toBe(true);
      });
    });

    describe('Artisan Profile Ownership by Canonical ID Only', () => {
      it('DENIES artisan imposter with IDENTICAL NAME and EMAIL but different ID/artisanId', () => {
        expect(canEditArtisanProfile(ARTISAN_IMPOSTER_SAME_NAME, ARTISAN_PROFILE_A)).toBe(false);
      });

      it('ALLOWS artisan when session has matching artisanId', () => {
        expect(canEditArtisanProfile(ARTISAN_ACTOR_A, ARTISAN_PROFILE_A)).toBe(true);
      });

      it('ALLOWS artisan when session id directly matches artisan id (direct fallback)', () => {
        const directMatchUser: UserSession = {
          id: 'artisan-profile-a',
          name: 'كريم',
          email: 'karim@test.com',
          role: 'artisan',
          createdAt: '2026-01-01T00:00:00.000Z',
        };
        expect(canEditArtisanProfile(directMatchUser, ARTISAN_PROFILE_A)).toBe(true);
      });
    });

    describe('Order Access by Canonical ID Only', () => {
      it('DENIES access to imposter with same name', () => {
        expect(canAccessOrder(USER_IMPOSTER_SAME_NAME, ORDER_A)).toBe(false);
      });

      it('DENIES access to imposter with same email', () => {
        expect(canAccessOrder(USER_IMPOSTER_SAME_EMAIL, ORDER_A)).toBe(false);
      });

      it('filterUserOrders returns orders strictly by canonical clientId', () => {
        const orders = [ORDER_A, ORDER_B];
        const userAOrders = filterUserOrders(orders, USER_A.id, 'any-email@fake.com');
        expect(userAOrders).toHaveLength(1);
        expect(userAOrders[0].id).toBe('ord-a');

        // Imposter gets empty list
        const imposterOrders = filterUserOrders(orders, USER_IMPOSTER_SAME_EMAIL.id, USER_A.email);
        expect(imposterOrders).toHaveLength(0);
      });
    });

    describe('Review Author by Canonical ID Only', () => {
      it('DENIES editing review to user with same name but different ID', () => {
        expect(canEditReview(USER_IMPOSTER_SAME_NAME, REVIEW_A)).toBe(false);
      });

      it('DENIES deleting review to user with same name but different ID', () => {
        expect(canDeleteReview(USER_IMPOSTER_SAME_NAME, REVIEW_A)).toBe(false);
      });

      it('DENIES editing legacy review without canonical userId', () => {
        const legacyReview: Review = {
          id: 'rev-legacy',
          userName: USER_A.name,
          rating: 5,
          comment: 'تقييم قديم بدون userId',
          date: 'منذ سنة',
        };
        expect(canEditReview(USER_A, legacyReview)).toBe(false);
        expect(canDeleteReview(USER_A, legacyReview)).toBe(false);
      });
    });
  });

  /* =========================================================================
   * 6. SELF-ACTION RESTRICTION REGRESSION (Self-Review, Self-Favorite, Self-Contact, Self-Offer)
   * Enforces business invariants against conflict of interest / fraud.
   * ========================================================================= */
  describe('6. Self-Action Restriction Regression', () => {
    it('DENIES Self-Offer: Artisan cannot submit offer to request they authored as client', () => {
      const selfAuthoredReq: ServiceRequest = {
        ...REQUEST_A,
        clientId: ARTISAN_ACTOR_A.id, // Authored by artisan's user id
      };
      expect(canSubmitOffer(ARTISAN_ACTOR_A, selfAuthoredReq, ARTISAN_PROFILE_A)).toBe(false);

      const selfAuthoredReqArtisanId: ServiceRequest = {
        ...REQUEST_A,
        clientId: ARTISAN_PROFILE_A.id, // Authored by artisan entity id
      };
      expect(canSubmitOffer(ARTISAN_ACTOR_A, selfAuthoredReqArtisanId, ARTISAN_PROFILE_A)).toBe(false);
    });

    it('DENIES Self-Review: Artisan cannot submit review for their own profile', () => {
      expect(canReviewArtisan(ARTISAN_ACTOR_A, ARTISAN_PROFILE_A)).toBe(false);
    });

    it('DENIES Self-Favorite: Artisan cannot favorite their own profile', () => {
      expect(canFavoriteArtisan(ARTISAN_ACTOR_A, ARTISAN_PROFILE_A)).toBe(false);
    });

    it('DENIES Self-Contact: Artisan cannot initiate contact request to their own profile', () => {
      expect(canCreateContactRequest(ARTISAN_ACTOR_A, ARTISAN_PROFILE_A)).toBe(false);
    });

    it('ALLOWS non-self interactions between different users/artisans', () => {
      expect(canCreateContactRequest(USER_A, ARTISAN_PROFILE_A)).toBe(true);
      expect(canFavoriteArtisan(USER_A, ARTISAN_PROFILE_A)).toBe(true);
      expect(canReviewArtisan(USER_A, ARTISAN_PROFILE_A)).toBe(true);
    });
  });

  /* =========================================================================
   * 7. CATEGORY COMPATIBILITY HARD CONSTRAINT REGRESSION
   * Mandatory prerequisite: professional specialty cannot be bypassed by proximity or rating.
   * ========================================================================= */
  describe('7. Category Compatibility Hard Constraint Regression', () => {
    it('ALLOWS offer when category matches exactly (plumbing -> plumbing)', () => {
      expect(canSubmitOffer(ARTISAN_ACTOR_A, REQUEST_A, ARTISAN_PROFILE_A)).toBe(true);
    });

    it('ALLOWS offer when category matches case-insensitively (PLUMBING -> plumbing)', () => {
      const upperReq: ServiceRequest = { ...REQUEST_A, category: 'PLUMBING' };
      expect(canSubmitOffer(ARTISAN_ACTOR_A, upperReq, ARTISAN_PROFILE_A)).toBe(true);
    });

    it('DENIES offer when category is mismatched EVEN WITH matching Wilaya, City, Rating 5.0, Verified, Available Now', () => {
      // ARTISAN_PROFILE_B is in the EXACT same wilaya ('الجزائر') and city ('باب الوادي')
      // Rating is 4.9, verified is true. But category is electricity, not plumbing!
      expect(canSubmitOffer(ARTISAN_ACTOR_B, REQUEST_A, ARTISAN_PROFILE_B)).toBe(false);
    });

    it('DENIES offer when artisan profile category is empty or undefined', () => {
      const uncategorizedArtisan: Artisan = { ...ARTISAN_PROFILE_A, category: '' };
      expect(canSubmitOffer(ARTISAN_ACTOR_A, REQUEST_A, uncategorizedArtisan)).toBe(false);
    });

    it('DENIES offer when service request category is empty', () => {
      const uncategorizedReq: ServiceRequest = { ...REQUEST_A, category: '' };
      expect(canSubmitOffer(ARTISAN_ACTOR_A, uncategorizedReq, ARTISAN_PROFILE_A)).toBe(false);
    });
  });

  /* =========================================================================
   * 8. DOUBLE ACCEPTANCE & STATE PROGRESSION REGRESSION
   * Assigned & completed state locks; duplicate offers prevention.
   * ========================================================================= */
  describe('8. Double Acceptance & State Progression Regression', () => {
    it('DENIES double acceptance: once request is assigned, accepting offer is DENIED', () => {
      const assignedReq: ServiceRequest = { ...REQUEST_A, status: 'assigned' };
      expect(canAcceptOffer(USER_A, assignedReq, OFFER_A)).toBe(false);
    });

    it('DENIES acceptance if request is completed or cancelled', () => {
      const completedReq: ServiceRequest = { ...REQUEST_A, status: 'completed' };
      const cancelledReq: ServiceRequest = { ...REQUEST_A, status: 'cancelled' };
      expect(canAcceptOffer(USER_A, completedReq, OFFER_A)).toBe(false);
      expect(canAcceptOffer(USER_A, cancelledReq, OFFER_A)).toBe(false);
    });

    it('DENIES acceptance if offer is not pending (already accepted, rejected, or withdrawn)', () => {
      expect(canAcceptOffer(USER_A, REQUEST_A, { ...OFFER_A, status: 'accepted' })).toBe(false);
      expect(canAcceptOffer(USER_A, REQUEST_A, { ...OFFER_A, status: 'rejected' })).toBe(false);
      expect(canAcceptOffer(USER_A, REQUEST_A, { ...OFFER_A, status: 'withdrawn' })).toBe(false);
    });

    it('DENIES duplicate active offer: same artisan cannot submit second active offer for same request', () => {
      const existingActiveOffers: ServiceOffer[] = [
        {
          id: 'existing-off-1',
          requestId: REQUEST_A.id,
          artisanId: ARTISAN_PROFILE_A.id,
          status: 'pending',
          proposedPrice: 1500,
          createdAt: '2026-03-01T10:30:00Z',
        },
      ];
      expect(canSubmitOffer(ARTISAN_ACTOR_A, REQUEST_A, ARTISAN_PROFILE_A, existingActiveOffers)).toBe(false);
    });

    it('ALLOWS offer resubmission if previous offer was WITHDRAWN', () => {
      const existingWithdrawnOffers: ServiceOffer[] = [
        {
          id: 'existing-off-withdrawn',
          requestId: REQUEST_A.id,
          artisanId: ARTISAN_PROFILE_A.id,
          status: 'withdrawn',
          proposedPrice: 1500,
          createdAt: '2026-03-01T10:30:00Z',
        },
      ];
      expect(canSubmitOffer(ARTISAN_ACTOR_A, REQUEST_A, ARTISAN_PROFILE_A, existingWithdrawnOffers)).toBe(true);
    });
  });

  /* =========================================================================
   * 9. MALFORMED INPUT & EDGE CASE REGRESSION (Deny By Default)
   * OWASP Principle of Fail-Safe Defaults: all invalid inputs evaluate to DENY.
   * ========================================================================= */
  describe('9. Malformed Input & Edge Cases (Deny by Default)', () => {
    it.each([
      { name: 'null actor', actor: null },
      { name: 'undefined actor', actor: undefined },
      { name: 'actor with empty id', actor: { ...USER_A, id: '' } },
      { name: 'actor with missing id', actor: { name: 'User' } as unknown as UserSession },
    ])('canEditServiceRequest DENIES on $name', ({ actor }) => {
      expect(canEditServiceRequest(actor, REQUEST_A)).toBe(false);
    });

    it.each([
      { name: 'null request', req: null },
      { name: 'undefined request', req: undefined },
      { name: 'request with empty clientId', req: { ...REQUEST_A, clientId: '' } },
      { name: 'request with missing clientId', req: { id: 'req-x' } as unknown as ServiceRequest },
    ])('canEditServiceRequest DENIES on $name', ({ req }) => {
      expect(canEditServiceRequest(USER_A, req)).toBe(false);
    });

    it('canCancelServiceRequest DENIES on null / undefined / empty params', () => {
      expect(canCancelServiceRequest(null, REQUEST_A)).toBe(false);
      expect(canCancelServiceRequest(USER_A, null)).toBe(false);
      expect(canCancelServiceRequest(undefined, undefined)).toBe(false);
    });

    it('canSubmitOffer DENIES on malformed actor, request, or artisan', () => {
      expect(canSubmitOffer(null, REQUEST_A, ARTISAN_PROFILE_A)).toBe(false);
      expect(canSubmitOffer(ARTISAN_ACTOR_A, null, ARTISAN_PROFILE_A)).toBe(false);
      expect(canSubmitOffer(ARTISAN_ACTOR_A, REQUEST_A, null)).toBe(false);
      expect(canSubmitOffer({ ...ARTISAN_ACTOR_A, id: '' }, REQUEST_A, ARTISAN_PROFILE_A)).toBe(false);
      expect(canSubmitOffer(ARTISAN_ACTOR_A, { ...REQUEST_A, id: '' }, ARTISAN_PROFILE_A)).toBe(false);
      expect(canSubmitOffer(ARTISAN_ACTOR_A, REQUEST_A, { ...ARTISAN_PROFILE_A, id: '' })).toBe(false);
    });

    it('canAcceptOffer DENIES on null / undefined / empty fields', () => {
      expect(canAcceptOffer(null, REQUEST_A, OFFER_A)).toBe(false);
      expect(canAcceptOffer(USER_A, null, OFFER_A)).toBe(false);
      expect(canAcceptOffer(USER_A, REQUEST_A, null)).toBe(false);
      expect(canAcceptOffer(USER_A, { ...REQUEST_A, clientId: '' }, OFFER_A)).toBe(false);
      expect(canAcceptOffer(USER_A, REQUEST_A, { ...OFFER_A, requestId: '' })).toBe(false);
    });

    it('canRejectOffer DENIES on null / undefined / empty fields', () => {
      expect(canRejectOffer(null, REQUEST_A, OFFER_A)).toBe(false);
      expect(canRejectOffer(USER_A, null, OFFER_A)).toBe(false);
      expect(canRejectOffer(USER_A, REQUEST_A, null)).toBe(false);
    });

    it('canEditOffer DENIES on null / undefined / empty fields', () => {
      expect(canEditOffer(null, REQUEST_A, OFFER_A, ARTISAN_PROFILE_A)).toBe(false);
      expect(canEditOffer(ARTISAN_ACTOR_A, REQUEST_A, null, ARTISAN_PROFILE_A)).toBe(false);
      expect(canEditOffer(ARTISAN_ACTOR_A, REQUEST_A, OFFER_A, null)).toBe(false);
    });

    it('canHandleContactRequest DENIES on null / undefined / empty fields', () => {
      expect(canHandleContactRequest(null, CONTACT_REQUEST_A, ARTISAN_PROFILE_A)).toBe(false);
      expect(canHandleContactRequest(ARTISAN_ACTOR_A, null, ARTISAN_PROFILE_A)).toBe(false);
      expect(canHandleContactRequest(ARTISAN_ACTOR_A, CONTACT_REQUEST_A, null)).toBe(false);
      expect(canHandleContactRequest(ARTISAN_ACTOR_A, { ...CONTACT_REQUEST_A, artisanId: '' }, ARTISAN_PROFILE_A)).toBe(false);
    });

    it('canCreateContactRequest DENIES when target artisan is null or has empty id', () => {
      expect(canCreateContactRequest(USER_A, null)).toBe(false);
      expect(canCreateContactRequest(USER_A, { ...ARTISAN_PROFILE_A, id: '' })).toBe(false);
    });

    it('canEditArtisanProfile DENIES on null / undefined / empty id', () => {
      expect(canEditArtisanProfile(null, ARTISAN_PROFILE_A)).toBe(false);
      expect(canEditArtisanProfile(ARTISAN_ACTOR_A, null)).toBe(false);
      expect(canEditArtisanProfile({ ...ARTISAN_ACTOR_A, id: '' }, ARTISAN_PROFILE_A)).toBe(false);
      expect(canEditArtisanProfile(ARTISAN_ACTOR_A, { ...ARTISAN_PROFILE_A, id: '' })).toBe(false);
    });

    it('canFavoriteArtisan DENIES when target artisan is null or has empty id', () => {
      expect(canFavoriteArtisan(USER_A, null)).toBe(false);
      expect(canFavoriteArtisan(USER_A, { id: '' })).toBe(false);
    });

    it('canReviewArtisan DENIES on null / undefined actor or artisan', () => {
      expect(canReviewArtisan(null, ARTISAN_PROFILE_A)).toBe(false);
      expect(canReviewArtisan(USER_A, null)).toBe(false);
      expect(canReviewArtisan({ ...USER_A, id: '' }, ARTISAN_PROFILE_A)).toBe(false);
      expect(canReviewArtisan(USER_A, { ...ARTISAN_PROFILE_A, id: '' })).toBe(false);
    });

    it('canEditReview & canDeleteReview DENIES on null review or missing userId', () => {
      expect(canEditReview(USER_A, null)).toBe(false);
      expect(canEditReview(USER_A, { ...REVIEW_A, userId: '' })).toBe(false);
      expect(canDeleteReview(USER_A, null)).toBe(false);
      expect(canDeleteReview(USER_A, { ...REVIEW_A, userId: '' })).toBe(false);
    });

    it('canAccessOrder DENIES on null order or missing clientId', () => {
      expect(canAccessOrder(USER_A, null)).toBe(false);
      expect(canAccessOrder(USER_A, { ...ORDER_A, clientId: '' })).toBe(false);
      expect(canAccessOrder(null, ORDER_A)).toBe(false);
    });

    it('canViewUserOrders DENIES on null / undefined / empty params', () => {
      expect(canViewUserOrders(null, USER_A.id)).toBe(false);
      expect(canViewUserOrders(USER_A, null)).toBe(false);
      expect(canViewUserOrders(USER_A, '')).toBe(false);
      expect(canViewUserOrders({ ...USER_A, id: '' }, USER_A.id)).toBe(false);
    });

    it('canViewServiceRequest DENIES on null / undefined request or empty id', () => {
      expect(canViewServiceRequest(USER_A, null)).toBe(false);
      expect(canViewServiceRequest(USER_A, { ...REQUEST_A, id: '' })).toBe(false);
    });
  });

  /* =========================================================================
   * 10. ARTISAN IDENTITY RESOLUTION REGRESSION (Priority: artisanId -> id)
   * ========================================================================= */
  describe('10. Artisan Identity Resolution (resolveCurrentArtisan)', () => {
    const artisansList = [ARTISAN_PROFILE_A, ARTISAN_PROFILE_B];

    it('resolves by currentUser.artisanId as highest priority', () => {
      const resolved = resolveCurrentArtisan(ARTISAN_ACTOR_A, artisansList);
      expect(resolved).not.toBeNull();
      expect(resolved?.id).toBe(ARTISAN_PROFILE_A.id);
    });

    it('resolves by currentUser.id as canonical fallback when artisanId is undefined', () => {
      const directArtisanUser: UserSession = {
        id: 'artisan-profile-b',
        name: 'مصطفى كهربائي',
        email: 'mustapha@test.com',
        role: 'artisan',
        createdAt: '2026-01-01T00:00:00.000Z',
      };
      const resolved = resolveCurrentArtisan(directArtisanUser, artisansList);
      expect(resolved).not.toBeNull();
      expect(resolved?.id).toBe(ARTISAN_PROFILE_B.id);
    });

    it('prefers artisanId over id when both exist but differ', () => {
      const hybridUser: UserSession = {
        id: 'user-unique-key',
        artisanId: 'artisan-profile-a',
        name: 'كريم',
        email: 'karim@test.com',
        role: 'artisan',
        createdAt: '2026-01-01T00:00:00.000Z',
      };
      const resolved = resolveCurrentArtisan(hybridUser, artisansList);
      expect(resolved?.id).toBe('artisan-profile-a');
    });

    it('returns null for regular customer user even if their id matches an artisan profile', () => {
      const userMatchingArtisanId: UserSession = {
        id: 'artisan-profile-a',
        name: 'عميل عادي',
        email: 'customer@test.com',
        role: 'user', // Role is user!
        createdAt: '2026-01-01T00:00:00.000Z',
      };
      expect(resolveCurrentArtisan(userMatchingArtisanId, artisansList)).toBeNull();
    });

    it('returns null for guest or empty artisans list', () => {
      expect(resolveCurrentArtisan(null, artisansList)).toBeNull();
      expect(resolveCurrentArtisan(undefined, artisansList)).toBeNull();
      expect(resolveCurrentArtisan(ARTISAN_ACTOR_A, [])).toBeNull();
    });
  });

  /* =========================================================================
   * 11. PURE DOMAIN HELPERS REGRESSION AUDIT (hasUserReviewedArtisan, countUserReviews, isOwnArtisanProfile)
   * ========================================================================= */
  describe('11. Pure Domain Authorization Helpers Regression', () => {
    it('isOwnArtisanProfile validates strictly via canonical id/artisanId', () => {
      expect(isOwnArtisanProfile(ARTISAN_PROFILE_A, ARTISAN_ACTOR_A)).toBe(true);
      expect(isOwnArtisanProfile(ARTISAN_PROFILE_B, ARTISAN_ACTOR_A)).toBe(false);
      expect(isOwnArtisanProfile(ARTISAN_PROFILE_A, USER_A)).toBe(false);
      expect(isOwnArtisanProfile(ARTISAN_PROFILE_A, null)).toBe(false);
      expect(isOwnArtisanProfile(null, ARTISAN_ACTOR_A)).toBe(false);
    });

    it('hasUserReviewedArtisan checks strictly by canonical review.userId', () => {
      const artisanWithReviews: Artisan = {
        ...ARTISAN_PROFILE_A,
        reviews: [REVIEW_A],
      };
      expect(hasUserReviewedArtisan(artisanWithReviews, USER_A.id)).toBe(true);
      expect(hasUserReviewedArtisan(artisanWithReviews, USER_B.id)).toBe(false);
      expect(hasUserReviewedArtisan(artisanWithReviews, USER_IMPOSTER_SAME_NAME.id)).toBe(false);
    });

    it('countUserReviews counts strictly by canonical review.userId', () => {
      const artisans = [
        { ...ARTISAN_PROFILE_A, reviews: [REVIEW_A] },
        { ...ARTISAN_PROFILE_B, reviews: [REVIEW_B, { ...REVIEW_A, id: 'rev-a2' }] },
      ];
      expect(countUserReviews(artisans, USER_A.id)).toBe(2);
      expect(countUserReviews(artisans, USER_B.id)).toBe(1);
      expect(countUserReviews(artisans, 'non-existent-user')).toBe(0);
    });
  });
});
