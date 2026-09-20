import { OrderItem, OrderStatus, ServiceOffer, ServiceRequest, UserSession } from '../types';
import { orderRepository } from '../repositories/orderRepository';
import { serviceRequestRepository } from '../repositories/serviceRequestRepository';
import { serviceOfferRepository } from '../repositories/serviceOfferRepository';

/**
 * Validates whether an Order status transition is legally allowed by the domain state machine.
 * Lifecycle: assigned -> in_progress -> completed (terminal).
 * Terminal states (completed, cancelled) DENY all further status changes.
 */
export function isValidOrderStateTransition(fromStatus: OrderStatus, toStatus: OrderStatus): boolean {
  const validStatuses: OrderStatus[] = ['assigned', 'in_progress', 'completed', 'cancelled', 'pending'];
  if (!validStatuses.includes(fromStatus) || !validStatuses.includes(toStatus)) {
    return false;
  }
  if (fromStatus === 'completed' || fromStatus === 'cancelled') {
    return false;
  }
  if (fromStatus === toStatus) {
    return false;
  }
  if (fromStatus === 'assigned') {
    return toStatus === 'in_progress' || toStatus === 'cancelled';
  }
  if (fromStatus === 'in_progress') {
    return toStatus === 'completed' || toStatus === 'cancelled';
  }
  if (fromStatus === 'pending') {
    // Legacy support for legacy pending records
    return toStatus === 'in_progress' || toStatus === 'assigned' || toStatus === 'cancelled';
  }
  return false;
}

/**
 * Price Validator: Checks that an order price is a valid non-negative finite number.
 * 0 is VALID (free consultation / 0 DZD service).
 * > 0 is VALID.
 * Negative numbers, NaN, Infinity, and non-numeric strings are INVALID.
 * No silent fallback to 0 is permitted!
 */
export function isValidOrderPrice(price: unknown): price is number {
  if (typeof price !== 'number') return false;
  if (Number.isNaN(price)) return false;
  if (!Number.isFinite(price)) return false;
  if (price < 0) return false;
  return true;
}

/**
 * Pure selector: Filters order items matching a given user strictly by canonical identifier (clientId === userId).
 * Canonical ownership relies strictly on clientId === currentUser.id.
 * Name and email are never used for ownership determination to prevent order leakage between distinct users.
 */
export function filterUserOrders(
  orders: OrderItem[],
  userId?: string,
  userEmail?: string
): OrderItem[] {
  if (!orders || !Array.isArray(orders)) return [];
  if (!userId) return [];

  return orders.filter(o => Boolean(o.clientId && o.clientId === userId));
}

/**
 * Pure selector: Filters order items matching a given artisan strictly by canonical identifier (artisanId === targetArtisanId).
 * Canonical ownership relies strictly on artisanId === targetArtisanId.
 */
export function filterArtisanOrders(
  orders: OrderItem[],
  artisanId?: string
): OrderItem[] {
  if (!orders || !Array.isArray(orders)) return [];
  if (!artisanId) return [];

  return orders.filter(o => Boolean(o.artisanId && o.artisanId === artisanId));
}

/**
 * Pure creation domain helper with idempotency & re-fetch checks:
 * Creates a new Order / Job record from an accepted ServiceOffer and assigned ServiceRequest.
 * Enforces:
 * 1. Request status must be 'assigned'.
 * 2. Offer status must be 'accepted'.
 * 3. Offer requestId must match request.id.
 * 4. Price integrity: final price comes from offer.proposedPrice (even if 0).
 * 5. Idempotency: If an Order already exists for this offerId or requestId, the existing Order is returned.
 */
export function createOrderFromAcceptedOffer(
  request: ServiceRequest | null | undefined,
  offer: ServiceOffer | null | undefined
): OrderItem | null {
  if (!request || !request.id || !offer || !offer.id) {
    return null;
  }
  if (offer.requestId !== request.id) {
    return null;
  }
  if (request.status !== 'assigned') {
    return null;
  }
  if (offer.status !== 'accepted') {
    return null;
  }
  if (!request.clientId || !offer.artisanId) {
    return null;
  }
  if (!isValidOrderPrice(offer.proposedPrice)) {
    return null;
  }

  // Idempotency Check: Re-fetch existing order for this offer or request
  const existingByOffer = orderRepository.getByOfferId(offer.id);
  const existingByRequest = orderRepository.getByRequestId(request.id);

  if (existingByOffer || existingByRequest) {
    const existingOrder = existingByOffer || existingByRequest;
    if (
      existingOrder &&
      existingOrder.requestId === request.id &&
      existingOrder.offerId === offer.id &&
      existingOrder.clientId === request.clientId &&
      existingOrder.artisanId === offer.artisanId
    ) {
      return existingOrder;
    }
    return null; // Conflict!
  }

  const newOrder: OrderItem = {
    id: `ord-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    requestId: request.id,
    offerId: offer.id,
    clientId: request.clientId,
    artisanId: offer.artisanId,
    artisanName: offer.artisanName || 'حرفي',
    artisanProfession: offer.artisanProfession || 'حرفي',
    clientName: request.clientName || 'عميل',
    clientPhone: request.clientPhone || '',
    preferredDate: request.preferredDate || new Date().toISOString().split('T')[0],
    serviceDetails: `${request.title}${request.description ? ' - ' + request.description : ''}`,
    proposedPrice: offer.proposedPrice,
    status: 'assigned',
    createdAt: new Date().toISOString(),
  };

  const saved = orderRepository.save(newOrder);
  return saved ? newOrder : null;
}

export interface AcceptOfferResult {
  success: boolean;
  order?: OrderItem;
  error?: string;
  isExisting?: boolean;
}

/**
 * Orchestrates accepting a service offer and creating the corresponding Order entity atomically
 * with re-fetch verification, cross-resource integrity checks, price validation, idempotency,
 * and best-effort rollback in case of partial persistence failure.
 */
export function acceptOfferAndCreateOrder(
  currentUser: UserSession | null | undefined,
  requestId: string,
  offerId: string
): AcceptOfferResult {
  if (!currentUser || !currentUser.id) {
    return { success: false, error: 'UNAUTHORIZED' };
  }

  // 1. Re-fetch fresh data from repositories
  const freshReq = serviceRequestRepository.getById(requestId);
  const freshOffer = serviceOfferRepository.getById(offerId);

  if (!freshReq || !freshOffer) {
    return { success: false, error: 'RESOURCE_NOT_FOUND' };
  }

  // 2. Validate relationships strictly by canonical IDs
  if (freshOffer.requestId !== freshReq.id) {
    return { success: false, error: 'CROSS_RESOURCE_MISMATCH' };
  }
  if (freshReq.clientId !== currentUser.id) {
    return { success: false, error: 'NOT_REQUEST_OWNER' };
  }
  if (!freshOffer.artisanId || typeof freshOffer.artisanId !== 'string') {
    return { success: false, error: 'INVALID_ARTISAN_ID' };
  }

  // 3. Validate price integrity
  if (!isValidOrderPrice(freshOffer.proposedPrice)) {
    return { success: false, error: 'INVALID_PROPOSED_PRICE' };
  }

  // 4. Idempotency Check: if order already exists for this exact canonical relationship
  const existingByOffer = orderRepository.getByOfferId(freshOffer.id);
  const existingByRequest = orderRepository.getByRequestId(freshReq.id);

  if (existingByOffer || existingByRequest) {
    const existingOrder = existingByOffer || existingByRequest;
    if (
      existingOrder &&
      existingOrder.requestId === freshReq.id &&
      existingOrder.offerId === freshOffer.id &&
      existingOrder.clientId === currentUser.id &&
      existingOrder.artisanId === freshOffer.artisanId
    ) {
      return { success: true, order: existingOrder, isExisting: true };
    }
    // Conflict! An order already exists for this request or offer with a mismatched relationship.
    return { success: false, error: 'ORDER_CONFLICT' };
  }

  // 5. Validate initial state for new acceptance
  if (freshReq.status !== 'open' && freshReq.status !== 'offers_received') {
    return { success: false, error: 'INVALID_REQUEST_STATE' };
  }
  if (freshOffer.status !== 'pending') {
    return { success: false, error: 'INVALID_OFFER_STATE' };
  }

  // 6. Sequential Execution with Rollback Capability
  const prevReqStatus = freshReq.status;
  const prevOfferStatus = freshOffer.status;

  // Step 6a: Accept Offer
  const offerAccepted = serviceOfferRepository.accept(freshOffer.id, freshReq.id);
  if (!offerAccepted) {
    return { success: false, error: 'FAILED_TO_ACCEPT_OFFER' };
  }

  // Step 6b: Assign Request
  const requestAssigned = serviceRequestRepository.updateStatus(freshReq.id, 'assigned', {
    assignedArtisanId: freshOffer.artisanId,
    assignedOfferId: freshOffer.id,
  });

  if (!requestAssigned) {
    // Rollback offer status
    serviceOfferRepository.rollbackAcceptance(freshOffer.id, freshReq.id);
    return { success: false, error: 'FAILED_TO_ASSIGN_REQUEST' };
  }

  // Step 6c: Create Order
  const updatedReq = serviceRequestRepository.getById(freshReq.id);
  const updatedOffer = serviceOfferRepository.getById(freshOffer.id);

  if (!updatedReq || !updatedOffer) {
    // Rollback request and offer
    serviceRequestRepository.updateStatus(freshReq.id, prevReqStatus, { assignedArtisanId: undefined, assignedOfferId: undefined });
    serviceOfferRepository.rollbackAcceptance(freshOffer.id, freshReq.id);
    return { success: false, error: 'FAILED_TO_READ_UPDATED_ENTITIES' };
  }

  const createdOrder = createOrderFromAcceptedOffer(updatedReq, updatedOffer);

  if (!createdOrder) {
    // Rollback request and offer
    serviceRequestRepository.updateStatus(freshReq.id, prevReqStatus, { assignedArtisanId: undefined, assignedOfferId: undefined });
    serviceOfferRepository.rollbackAcceptance(freshOffer.id, freshReq.id);
    return { success: false, error: 'FAILED_TO_CREATE_ORDER' };
  }

  // 7. Post-Creation Re-Fetch Verification
  const verifiedOrder = orderRepository.getById(createdOrder.id);
  const verifiedReq = serviceRequestRepository.getById(freshReq.id);
  const verifiedOffer = serviceOfferRepository.getById(freshOffer.id);

  if (!verifiedOrder || verifiedReq?.status !== 'assigned' || verifiedOffer?.status !== 'accepted') {
    return { success: false, error: 'PERSISTENCE_VERIFICATION_FAILED' };
  }

  return { success: true, order: verifiedOrder };
}

/**
 * Pure predicate: Determines if a completed Order/Job exists between a client and an artisan, making the service eligible for review.
 */
export function isOrderEligibleForReview(
  order: OrderItem | null | undefined,
  clientId?: string,
  artisanId?: string
): boolean {
  if (!order || order.status !== 'completed') return false;
  if (clientId && order.clientId !== clientId) return false;
  if (artisanId && order.artisanId !== artisanId) return false;
  return true;
}

/**
 * Pure selector: Checks if a client has at least one completed order with a specific artisan.
 */
export function hasCompletedOrderWithArtisan(
  orders: OrderItem[],
  clientId?: string,
  artisanId?: string
): boolean {
  if (!orders || !Array.isArray(orders) || !clientId || !artisanId) return false;
  return orders.some(o => o.clientId === clientId && o.artisanId === artisanId && o.status === 'completed');
}

