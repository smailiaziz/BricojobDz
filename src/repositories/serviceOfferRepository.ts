import { appLocalStorage } from './storage';
import { ServiceOffer, ServiceOfferStatus } from '../types';
import { isValidServiceOfferTransition } from '../domain/serviceRequests';

const STORAGE_KEY = 'bricojob_service_offers';

export interface IServiceOfferRepository {
  getAll(): ServiceOffer[];
  getById(id: string): ServiceOffer | null;
  getByRequestId(requestId: string): ServiceOffer[];
  getByArtisanId(artisanId: string): ServiceOffer[];
  getByRequestAndArtisan(requestId: string, artisanId: string): ServiceOffer | null;
  create(offer: ServiceOffer): boolean;
  update(offer: ServiceOffer): boolean;
  accept(offerId: string, requestId: string): boolean;
  rollbackAcceptance(offerId: string, requestId: string, affectedOfferIds?: string[]): boolean;
  reject(offerId: string): boolean;
}

export class ServiceOfferRepository implements IServiceOfferRepository {
  private displacedIdsByAcceptance: Map<string, string[]> = new Map();
  public getAll(): ServiceOffer[] {
    const raw = appLocalStorage.getItem<ServiceOffer[]>(STORAGE_KEY, []);
    return Array.isArray(raw) ? raw : [];
  }

  public getById(id: string): ServiceOffer | null {
    if (!id) return null;
    return this.getAll().find(o => o.id === id) || null;
  }

  public getByRequestId(requestId: string): ServiceOffer[] {
    if (!requestId) return [];
    return this.getAll().filter(o => o.requestId === requestId);
  }

  public getByArtisanId(artisanId: string): ServiceOffer[] {
    if (!artisanId) return [];
    return this.getAll().filter(o => o.artisanId === artisanId);
  }

  public getByRequestAndArtisan(requestId: string, artisanId: string): ServiceOffer | null {
    if (!requestId || !artisanId) return null;
    return this.getAll().find(o => o.requestId === requestId && o.artisanId === artisanId) || null;
  }

  public create(offer: ServiceOffer): boolean {
    if (!offer || !offer.id || !offer.requestId || !offer.artisanId) return false;
    const current = this.getAll();
    
    // Guard: Prevent duplicate offers by same artisan for same request
    const existing = current.find(o => o.requestId === offer.requestId && o.artisanId === offer.artisanId);
    if (existing && existing.status !== 'withdrawn') {
      return false;
    }

    return appLocalStorage.setItem(STORAGE_KEY, [offer, ...current]);
  }

  public update(offer: ServiceOffer): boolean {
    if (!offer || !offer.id) return false;
    const current = this.getAll();
    const index = current.findIndex(o => o.id === offer.id);
    if (index === -1) return false;

    const existingOffer = current[index];

    // Ensure relationship integrity
    if (offer.requestId !== undefined && offer.requestId !== existingOffer.requestId) {
      return false;
    }
    if (offer.artisanId !== undefined && offer.artisanId !== existingOffer.artisanId) {
      return false;
    }

    // Ensure state transition integrity and reject malformed/null/undefined status
    if ('status' in offer) {
      const validStatuses: ServiceOfferStatus[] = ['pending', 'accepted', 'not_selected', 'rejected', 'withdrawn'];
      if (!offer.status || !validStatuses.includes(offer.status)) {
        return false;
      }

      if (!isValidServiceOfferTransition(existingOffer.status, offer.status)) {
        return false;
      }
    }

    const updated = [...current];
    updated[index] = {
      ...existingOffer,
      ...offer,
      id: existingOffer.id,
      requestId: existingOffer.requestId,
      artisanId: existingOffer.artisanId,
    };
    return appLocalStorage.setItem(STORAGE_KEY, updated);
  }

  public updateStatus(id: string, status: ServiceOfferStatus): boolean {
    if (!id) return false;
    const validStatuses: ServiceOfferStatus[] = ['pending', 'accepted', 'not_selected', 'rejected', 'withdrawn'];
    if (!status || !validStatuses.includes(status)) {
      return false;
    }

    const current = this.getAll();
    const index = current.findIndex(o => o.id === id);
    if (index === -1) return false;

    const existingOffer = current[index];
    if (!isValidServiceOfferTransition(existingOffer.status, status)) {
      return false;
    }

    const updated = [...current];
    updated[index] = { ...existingOffer, status };
    return appLocalStorage.setItem(STORAGE_KEY, updated);
  }

  /**
   * Accepts a specific offer for a request:
   * Sets the target offer to 'accepted' and marks all other pending offers
   * for that request as 'not_selected'.
   *
   * Legacy 'rejected' offers remain untouched.
   * Withdrawn offers remain untouched.
   */
  public accept(offerId: string, requestId: string): boolean {
    if (!offerId || !requestId) return false;
    const current = this.getAll();
    
    // Validate relationship integrity and offer existence
    const targetOffer = current.find(o => o.id === offerId);
    if (!targetOffer || targetOffer.requestId !== requestId) {
      return false;
    }

    // Validate state transition integrity
    if (!isValidServiceOfferTransition(targetOffer.status, 'accepted')) {
      return false;
    }

    const displacedOfferIds: string[] = [];

    const updated = current.map(offer => {
      if (offer.requestId !== requestId) {
        return offer;
      }

      if (offer.id === offerId) {
        return { ...offer, status: 'accepted' as const };
      }

      if (offer.status === 'pending') {
        displacedOfferIds.push(offer.id);
        return { ...offer, status: 'not_selected' as const };
      }

      // Preserve withdrawn and legacy rejected offers.
      return offer;
    });

    const success = appLocalStorage.setItem(STORAGE_KEY, updated);
    if (success) {
      this.displacedIdsByAcceptance.set(`${requestId}:${offerId}`, displacedOfferIds);
    }
    return success;
  }

  public rollbackAcceptance(offerId: string, requestId: string, affectedOfferIds?: string[]): boolean {
    if (!offerId || !requestId) return false;

    const current = this.getAll();
    const targetOffer = current.find(
      offer => offer.id === offerId && offer.requestId === requestId
    );

    if (!targetOffer || targetOffer.status !== 'accepted') {
      return false;
    }

    const mapKey = `${requestId}:${offerId}`;
    const targetDisplacedIds = affectedOfferIds ?? this.displacedIdsByAcceptance.get(mapKey) ?? [];

    const updated = current.map(offer => {
      if (offer.requestId !== requestId) {
        return offer;
      }

      if (offer.id === offerId) {
        return { ...offer, status: 'pending' as const };
      }

      if (targetDisplacedIds.includes(offer.id) && offer.status === 'not_selected') {
        return { ...offer, status: 'pending' as const };
      }

      return offer;
    });

    const success = appLocalStorage.setItem(STORAGE_KEY, updated);
    if (success) {
      this.displacedIdsByAcceptance.delete(mapKey);
    }
    return success;
  }

  public reject(offerId: string): boolean {
    if (!offerId) return false;
    const current = this.getAll();
    const index = current.findIndex(o => o.id === offerId);
    if (index === -1) return false;

    const existingOffer = current[index];
    if (!isValidServiceOfferTransition(existingOffer.status, 'rejected')) {
      return false;
    }

    const updated = [...current];
    updated[index] = { ...updated[index], status: 'rejected' };
    return appLocalStorage.setItem(STORAGE_KEY, updated);
  }
}

export const serviceOfferRepository = new ServiceOfferRepository();
