import {
  UserSession,
  Artisan,
  ServiceRequest,
  ServiceOffer,
  ServiceContactRequest,
  OrderItem,
  Review,
} from '../types';
import { isOwnArtisanProfile } from './favorites';
import { hasUserReviewedArtisan } from './reviews';

/**
 * ============================================================================
 * BRICOJOBDZ DOMAIN AUTHORIZATION LAYER
 * ============================================================================
 * Model: Actor -> Resource -> Action -> State -> Authorization Decision
 * Core Principle: DENY BY DEFAULT
 * 
 * Rules:
 * 1. Pure, deterministic, side-effect free boolean functions.
 * 2. Canonical identifiers only:
 *    - User ownership: actor.id === resource.clientId / resource.userId
 *    - Artisan identity: actor.artisanId === artisan.id || actor.id === artisan.id
 * 3. Never use display name, email, or phone matching to determine ownership.
 * 4. Object-level resource relationships validated (e.g. offer.requestId === request.id).
 * 5. Resource state transitions respected according to established workflow.
 * ============================================================================
 */

/**
 * Pure predicate: Determines if an actor can edit a service request.
 * - Actor must be an authenticated customer.
 * - Request must belong to the actor (request.clientId === actor.id).
 * - Request must be in an editable state ('open' or 'offers_received').
 */
export function canEditServiceRequest(
  actor: UserSession | null | undefined,
  request: ServiceRequest | null | undefined
): boolean {
  if (!actor || !actor.id || !request || !request.clientId) {
    return false;
  }
  // Role & ownership check
  if (actor.role !== 'user') {
    return false;
  }
  if (request.clientId !== actor.id) {
    return false;
  }
  // State check: cannot edit assigned, completed, or cancelled requests
  if (request.status !== 'open' && request.status !== 'offers_received') {
    return false;
  }
  return true;
}

/**
 * Pure predicate: Determines if an actor can cancel a service request.
 * - Actor must be the authenticated customer who created the request.
 * - Request must be in a cancellable state ('open' or 'offers_received').
 * - Assigned, completed, or already cancelled requests cannot be cancelled.
 */
export function canCancelServiceRequest(
  actor: UserSession | null | undefined,
  request: ServiceRequest | null | undefined
): boolean {
  if (!actor || !actor.id || !request || !request.clientId) {
    return false;
  }
  if (actor.role !== 'user') {
    return false;
  }
  if (request.clientId !== actor.id) {
    return false;
  }
  if (request.status !== 'open' && request.status !== 'offers_received') {
    return false;
  }
  return true;
}

/**
 * Pure predicate: Determines if an artisan can submit a price offer for a service request.
 * - Actor must be authenticated as an artisan.
 * - Artisan must match the authenticated actor (canonical id).
 * - Self-offer is strictly prohibited (artisan cannot offer on their own service request).
 * - Request state must be 'open' or 'offers_received'.
 * - Category compatibility is a MANDATORY HARD CONSTRAINT (exact match required).
 * - Duplicate active offers from the same artisan for the same request are denied.
 */
export function canSubmitOffer(
  actor: UserSession | null | undefined,
  request: ServiceRequest | null | undefined,
  artisan: Artisan | null | undefined,
  existingOffers?: ServiceOffer[]
): boolean {
  if (!actor || !actor.id || !request || !request.id || !artisan || !artisan.id) {
    return false;
  }
  if (actor.role !== 'artisan') {
    return false;
  }
  // Ensure the artisan entity belongs to the active actor
  const isActorArtisan = (actor.artisanId && actor.artisanId === artisan.id) || actor.id === artisan.id;
  if (!isActorArtisan) {
    return false;
  }
  // Self-action check: an artisan cannot submit an offer to a request they authored as client
  if (request.clientId === actor.id || request.clientId === artisan.id) {
    return false;
  }
  // State check: request must accept offers
  if (request.status !== 'open' && request.status !== 'offers_received') {
    return false;
  }
  // Hard constraint: professional category compatibility
  if (
    !request.category ||
    !artisan.category ||
    request.category.toLowerCase() !== artisan.category.toLowerCase()
  ) {
    return false;
  }
  // Duplicate offer check
  if (Array.isArray(existingOffers)) {
    const hasActiveOffer = existingOffers.some(
      o => o.requestId === request.id && o.artisanId === artisan.id && o.status !== 'withdrawn'
    );
    if (hasActiveOffer) {
      return false;
    }
  }

  return true;
}

/**
 * Pure predicate: Determines if an actor can accept an offer for a service request.
 * - Actor must be the authenticated customer who owns the request (request.clientId === actor.id).
 * - Offer must belong to this specific request (offer.requestId === request.id).
 * - Request must be in a state that allows assigning ('open' or 'offers_received').
 * - Offer must be in 'pending' status.
 */
export function canAcceptOffer(
  actor: UserSession | null | undefined,
  request: ServiceRequest | null | undefined,
  offer: ServiceOffer | null | undefined
): boolean {
  if (!actor || !actor.id || !request || !request.id || !request.clientId || !offer || !offer.id || !offer.requestId) {
    return false;
  }
  // Ownership check
  if (request.clientId !== actor.id) {
    return false;
  }
  // Object-level relationship check
  if (offer.requestId !== request.id) {
    return false;
  }
  // Request state check
  if (request.status !== 'open' && request.status !== 'offers_received') {
    return false;
  }
  // Offer state check
  if (offer.status !== 'pending') {
    return false;
  }
  return true;
}

/**
 * Pure predicate: Determines if an actor can reject an offer for a service request.
 * - Actor must be the authenticated customer who owns the request.
 * - Offer must belong to this specific request.
 * - Request state must be 'open' or 'offers_received'.
 * - Offer status must be 'pending'.
 */
export function canRejectOffer(
  actor: UserSession | null | undefined,
  request: ServiceRequest | null | undefined,
  offer: ServiceOffer | null | undefined
): boolean {
  if (!actor || !actor.id || !request || !request.id || !request.clientId || !offer || !offer.id || !offer.requestId) {
    return false;
  }
  if (request.clientId !== actor.id) {
    return false;
  }
  if (offer.requestId !== request.id) {
    return false;
  }
  if (request.status !== 'open' && request.status !== 'offers_received') {
    return false;
  }
  if (offer.status !== 'pending') {
    return false;
  }
  return true;
}

/**
 * Pure predicate: Determines if an artisan can edit/withdraw their own offer.
 * - Actor must be the artisan who authored the offer.
 * - Offer must be pending.
 * - If request is provided, request must be 'open' or 'offers_received' and match offer.requestId.
 */
export function canEditOffer(
  actor: UserSession | null | undefined,
  request: ServiceRequest | null | undefined,
  offer: ServiceOffer | null | undefined,
  artisan: Artisan | null | undefined
): boolean {
  if (!actor || !actor.id || !offer || !offer.artisanId || !artisan || !artisan.id) {
    return false;
  }
  if (actor.role !== 'artisan') {
    return false;
  }
  const isActorArtisan = (actor.artisanId && actor.artisanId === artisan.id) || actor.id === artisan.id;
  if (!isActorArtisan || offer.artisanId !== artisan.id) {
    return false;
  }
  if (offer.status !== 'pending') {
    return false;
  }
  if (request) {
    if (offer.requestId !== request.id) return false;
    if (request.status !== 'open' && request.status !== 'offers_received') return false;
  }
  return true;
}

/**
 * Pure predicate: Determines if an actor can handle/update a contact request.
 * - Actor must be authenticated as an artisan.
 * - Contact request must be explicitly assigned to this artisan (contactRequest.artisanId === artisan.id).
 * - Artisan must match the authenticated actor.
 */
export function canHandleContactRequest(
  actor: UserSession | null | undefined,
  contactRequest: ServiceContactRequest | null | undefined,
  artisan: Artisan | null | undefined
): boolean {
  if (!actor || !actor.id || !contactRequest || !contactRequest.artisanId || !artisan || !artisan.id) {
    return false;
  }
  if (actor.role !== 'artisan') {
    return false;
  }
  const isActorArtisan = (actor.artisanId && actor.artisanId === artisan.id) || actor.id === artisan.id;
  if (!isActorArtisan) {
    return false;
  }
  if (contactRequest.artisanId !== artisan.id) {
    return false;
  }
  return true;
}

/**
 * Pure predicate: Determines if an actor can initiate a contact request to an artisan.
 * - Target artisan must exist.
 * - Self-contact is prohibited: an artisan cannot send a contact request to their own profile.
 */
export function canCreateContactRequest(
  actor: UserSession | null | undefined,
  artisan: Artisan | null | undefined
): boolean {
  if (!artisan || !artisan.id) {
    return false;
  }
  if (actor && isOwnArtisanProfile(artisan, actor)) {
    return false;
  }
  return true;
}

/**
 * Pure predicate: Determines if an actor can view their customer contact request history.
 * - Actor must be an authenticated user with a valid ID.
 * - Unauthenticated guests are denied access.
 */
export function canViewCustomerContactHistory(
  actor: UserSession | null | undefined
): boolean {
  if (!actor || !actor.id) {
    return false;
  }
  return true;
}

/**
 * Pure predicate: Determines if an actor can view a specific customer contact request.
 * - Actor must be authenticated.
 * - Ownership check: request.customerId (or request.clientId) MUST match actor.id strictly.
 * - Fallbacks by name, email, or phone are strictly forbidden.
 */
export function canViewCustomerContactRequest(
  actor: UserSession | null | undefined,
  contactRequest: ServiceContactRequest | null | undefined
): boolean {
  if (!actor || !actor.id || !contactRequest) {
    return false;
  }
  const requestOwnerId = contactRequest.customerId || (contactRequest as any).clientId;
  if (!requestOwnerId || requestOwnerId !== actor.id) {
    return false;
  }
  return true;
}

/**
 * Pure predicate: Determines if an actor can view an artisan contact request inbox item.
 * - Leverages canHandleContactRequest validation.
 */
export function canViewArtisanContactRequest(
  actor: UserSession | null | undefined,
  contactRequest: ServiceContactRequest | null | undefined,
  artisan: Artisan | null | undefined
): boolean {
  return canHandleContactRequest(actor, contactRequest, artisan);
}

/**
 * Pure predicate: Determines if an actor can edit an artisan profile.
 * - Actor must be authenticated as an artisan.
 * - Profile must belong to the actor (canonical identity link).
 * - Artisan A editing Artisan B is strictly forbidden.
 */
export function canEditArtisanProfile(
  actor: UserSession | null | undefined,
  artisan: Artisan | null | undefined
): boolean {
  if (!actor || !actor.id || !artisan || !artisan.id) {
    return false;
  }
  if (actor.role !== 'artisan') {
    return false;
  }
  return isOwnArtisanProfile(artisan, actor);
}

/**
 * Pure predicate: Determines if an actor can favorite an artisan profile.
 * - Target artisan must exist.
 * - Self-favorite is prohibited: an artisan cannot favorite their own profile.
 * - Guests and other users are permitted.
 */
export function canFavoriteArtisan(
  actor: UserSession | null | undefined,
  artisan: { id: string } | null | undefined
): boolean {
  if (!artisan || !artisan.id) {
    return false;
  }
  if (actor && isOwnArtisanProfile(artisan, actor)) {
    return false;
  }
  return true;
}

/**
 * Pure predicate: Determines if an actor can create a review for a completed service order.
 * Enforces Stage 7 Review Eligibility Rules:
 * 1. Actor must be authenticated customer with a valid actor.id.
 * 2. Order must exist, have valid IDs (id, requestId, offerId, clientId, artisanId).
 * 3. order.status === 'completed' strictly (assigned, in_progress, cancelled, pending DENIED).
 * 4. order.clientId === actor.id strictly (no name/email/phone fallback).
 * 5. order.artisanId === targetArtisan.id strictly (review target integrity).
 * 6. Self-review guard: actor must not be the artisan (isOwnArtisanProfile / actor.artisanId === artisan.id / order.artisanId === actor.id DENIED).
 * 7. One Review Per Order: Order must not already have a review submitted for it (review.orderId === order.id DENIED).
 */
export function canReviewCompletedOrder(
  actor: UserSession | null | undefined,
  order: OrderItem | null | undefined,
  targetArtisan: Artisan | null | undefined,
  existingReviews?: Review[]
): boolean {
  if (!actor || !actor.id || typeof actor.id !== 'string' || !actor.id.trim()) {
    return false;
  }
  if (!order || !order.id || typeof order.id !== 'string' || !order.id.trim()) {
    return false;
  }
  if (!targetArtisan || !targetArtisan.id || typeof targetArtisan.id !== 'string' || !targetArtisan.id.trim()) {
    return false;
  }

  // Require valid relational keys
  if (!order.clientId || typeof order.clientId !== 'string' || !order.clientId.trim()) {
    return false;
  }
  if (!order.artisanId || typeof order.artisanId !== 'string' || !order.artisanId.trim()) {
    return false;
  }
  if (!order.requestId || typeof order.requestId !== 'string' || !order.requestId.trim()) {
    return false;
  }
  if (!order.offerId || typeof order.offerId !== 'string' || !order.offerId.trim()) {
    return false;
  }

  // 1. Status MUST be 'completed' strictly
  if (order.status !== 'completed') {
    return false;
  }

  // 2. Ownership check: order.clientId MUST match actor.id strictly
  if (order.clientId !== actor.id) {
    return false;
  }

  // 3. Target Artisan Integrity: order.artisanId MUST match targetArtisan.id strictly
  if (order.artisanId !== targetArtisan.id) {
    return false;
  }

  // 4. Self Review Prevention: actor cannot be the artisan associated with the order/profile
  if (isOwnArtisanProfile(targetArtisan, actor)) {
    return false;
  }
  if (actor.artisanId && (actor.artisanId === targetArtisan.id || actor.artisanId === order.artisanId)) {
    return false;
  }
  if (actor.id === targetArtisan.id || actor.id === order.artisanId) {
    return false;
  }

  // 5. One Review Per Order check
  const reviewsToCheck = existingReviews || targetArtisan.reviews || [];
  if (Array.isArray(reviewsToCheck)) {
    const alreadyReviewed = reviewsToCheck.some(r => r.orderId === order.id);
    if (alreadyReviewed) {
      return false;
    }
  }

  return true;
}

/**
 * Pure predicate: Determines if an actor can review an artisan profile.
 * - Actor must be authenticated.
 * - Self-review is prohibited: an artisan cannot review their own profile.
 * - Requires at least one completed order eligible for review if userOrders provided.
 */
export function canReviewArtisan(
  actor: UserSession | null | undefined,
  artisan: Artisan | null | undefined,
  userOrders?: OrderItem[]
): boolean {
  if (!actor || !actor.id || !artisan || !artisan.id) {
    return false;
  }
  if (isOwnArtisanProfile(artisan, actor)) {
    return false;
  }
  if (userOrders && Array.isArray(userOrders)) {
    return userOrders.some(order => canReviewCompletedOrder(actor, order, artisan));
  }
  if (hasUserReviewedArtisan(artisan, actor.id)) {
    return false;
  }
  return true;
}

/**
 * Pure predicate: Determines if an actor can edit a review.
 * - Actor must be the review author (canonical review.userId === actor.id).
 * - Legacy reviews without userId cannot be edited.
 */
export function canEditReview(
  actor: UserSession | null | undefined,
  review: Review | null | undefined
): boolean {
  if (!actor || !actor.id || !review || !review.userId) {
    return false;
  }
  return review.userId === actor.id;
}

/**
 * Pure predicate: Determines if an actor can delete a review.
 * - Actor must be the review author (canonical review.userId === actor.id).
 * - Legacy reviews without userId cannot be deleted.
 */
export function canDeleteReview(
  actor: UserSession | null | undefined,
  review: Review | null | undefined
): boolean {
  if (!actor || !actor.id || !review || !review.userId) {
    return false;
  }
  return review.userId === actor.id;
}

/**
 * Pure predicate: Determines if an actor can access a specific order as a client.
 * - Strictly relies on canonical order.clientId === actor.id.
 */
export function canAccessOrder(
  actor: UserSession | null | undefined,
  order: OrderItem | null | undefined
): boolean {
  if (!actor || !actor.id || !order || !order.clientId) {
    return false;
  }
  return order.clientId === actor.id;
}

/**
 * Pure predicate: Determines if an actor can view a specific order or job.
 * - Client can view if order.clientId === actor.id.
 * - Artisan can view if order.artisanId matches artisan identity.
 */
export function canViewOrder(
  actor: UserSession | null | undefined,
  order: OrderItem | null | undefined,
  artisan?: Artisan | null | undefined
): boolean {
  if (!actor || !actor.id || !order || !order.id) {
    return false;
  }
  if (order.clientId && order.clientId === actor.id) {
    return true;
  }
  if (actor.role === 'artisan') {
    if (actor.artisanId && order.artisanId === actor.artisanId) return true;
    if (order.artisanId === actor.id) return true;
    if (artisan && artisan.id && order.artisanId === artisan.id) {
      if (actor.artisanId === artisan.id || actor.id === artisan.id) return true;
    }
  }
  return false;
}

/**
 * Pure predicate: Determines if an artisan actor can start an assigned job (assigned -> in_progress).
 * - Actor must be an authenticated artisan matching order.artisanId.
 * - Order status must be 'assigned' (or legacy 'pending').
 * - Client or unauthorized actors cannot start jobs.
 */
export function canStartJob(
  actor: UserSession | null | undefined,
  order: OrderItem | null | undefined,
  artisan?: Artisan | null | undefined
): boolean {
  if (!actor || !actor.id || actor.role !== 'artisan' || !order || !order.id || !order.artisanId) {
    return false;
  }
  if (order.status !== 'assigned' && order.status !== 'pending') {
    return false;
  }
  const isTargetArtisan = 
    (actor.artisanId && order.artisanId === actor.artisanId) ||
    order.artisanId === actor.id ||
    Boolean(artisan && artisan.id && order.artisanId === artisan.id && (actor.artisanId === artisan.id || actor.id === artisan.id));

  return isTargetArtisan;
}

/**
 * Pure predicate: Determines if an artisan actor can complete an in-progress job (in_progress -> completed).
 * - Actor must be an authenticated artisan matching order.artisanId.
 * - Order status must be 'in_progress'.
 * - Client or unauthorized actors cannot complete jobs.
 */
export function canCompleteJob(
  actor: UserSession | null | undefined,
  order: OrderItem | null | undefined,
  artisan?: Artisan | null | undefined
): boolean {
  if (!actor || !actor.id || actor.role !== 'artisan' || !order || !order.id || !order.artisanId) {
    return false;
  }
  if (order.status !== 'in_progress') {
    return false;
  }
  const isTargetArtisan = 
    (actor.artisanId && order.artisanId === actor.artisanId) ||
    order.artisanId === actor.id ||
    Boolean(artisan && artisan.id && order.artisanId === artisan.id && (actor.artisanId === artisan.id || actor.id === artisan.id));

  return isTargetArtisan;
}

/**
 * Pure predicate: Determines if an actor can view a target user's orders collection.
 * - Strictly relies on canonical actor.id === targetUserId.
 */
export function canViewUserOrders(
  actor: UserSession | null | undefined,
  targetUserId: string | null | undefined
): boolean {
  if (!actor || !actor.id || !targetUserId) {
    return false;
  }
  return actor.id === targetUserId;
}

/**
 * Pure predicate: Determines if an actor can view a service request.
 * - Active requests ('open', 'offers_received', 'assigned', 'completed') are public for marketplace discovery.
 * - Cancelled requests are private to the author only (request.clientId === actor.id).
 */
export function canViewServiceRequest(
  actor: UserSession | null | undefined,
  request: ServiceRequest | null | undefined
): boolean {
  if (!request || !request.id) {
    return false;
  }
  if (request.status === 'cancelled') {
    return Boolean(actor && actor.id && request.clientId === actor.id);
  }
  return true;
}
