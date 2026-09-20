import { appLocalStorage } from './storage';
import { OrderItem, OrderStatus } from '../types';
import { filterUserOrders, isValidOrderStateTransition, isValidOrderPrice } from '../domain/orders';
import { parseStartingPrice } from '../utils';

const STORAGE_KEY = 'bricojob_orders';

export interface IOrderRepository {
  getAll(): OrderItem[];
  getById(id: string): OrderItem | null;
  getByUser(userId: string, userEmail?: string): OrderItem[];
  getByClient(clientId: string): OrderItem[];
  getByArtisan(artisanId: string): OrderItem[];
  getByRequestId(requestId: string): OrderItem | null;
  getByOfferId(offerId: string): OrderItem | null;
  save(order: OrderItem): boolean;
  updateStatus(id: string, status: OrderStatus): boolean;
}

export class OrderRepository implements IOrderRepository {
  public getAll(): OrderItem[] {
    const raw = appLocalStorage.getItem<any[]>(STORAGE_KEY, []);
    if (!Array.isArray(raw)) return [];

    const parsed: OrderItem[] = [];
    for (const r of raw) {
      if (!r || typeof r !== 'object' || !r.id || typeof r.id !== 'string') {
        continue;
      }

      // Status Validation
      const rawStatus = r.status;
      const validStatuses: OrderStatus[] = ['assigned', 'in_progress', 'completed', 'cancelled', 'pending'];
      if (!rawStatus || typeof rawStatus !== 'string' || !validStatuses.includes(rawStatus as OrderStatus)) {
        // Unknown, malformed, or missing status -> INVALID. Do not silently map to "assigned".
        continue;
      }
      const status = rawStatus as OrderStatus;

      // Price Validation
      let parsedPrice: number | undefined = undefined;
      const rawPrice = r.proposedPrice !== undefined ? r.proposedPrice : r.price;

      if (rawPrice !== undefined && rawPrice !== null) {
        const parsed = parseStartingPrice(rawPrice);
        if (parsed === null) {
          // Price is present but invalid (negative, NaN, Infinity, malformed, etc.) -> INVALID. Skip.
          continue;
        }
        parsedPrice = parsed;
      }

      parsed.push({
        id: String(r.id),
        requestId: r.requestId ? String(r.requestId) : undefined,
        offerId: r.offerId ? String(r.offerId) : undefined,
        clientId: r.clientId ? String(r.clientId) : undefined,
        clientEmail: r.clientEmail ? String(r.clientEmail) : undefined,
        artisanId: String(r.artisanId || ''),
        artisanName: String(r.artisanName || 'حرفي'),
        artisanProfession: r.artisanProfession ? String(r.artisanProfession) : undefined,
        clientName: r.clientName ? String(r.clientName) : 'عميل',
        clientPhone: r.clientPhone ? String(r.clientPhone) : '',
        preferredDate: r.preferredDate ? String(r.preferredDate) : '',
        serviceDetails: String(r.serviceDetails || r.title || 'خدمة'),
        proposedPrice: parsedPrice,
        status,
        createdAt: r.createdAt ? String(r.createdAt) : new Date().toISOString(),
      });
    }

    return parsed;
  }

  public getById(id: string): OrderItem | null {
    if (!id || typeof id !== 'string') return null;
    return this.getAll().find(o => o.id === id) || null;
  }

  public save(order: OrderItem): boolean {
    if (!order || typeof order !== 'object' || !order.id || typeof order.id !== 'string') {
      return false;
    }

    const validStatuses: OrderStatus[] = ['assigned', 'in_progress', 'completed', 'cancelled', 'pending'];

    // If proposedPrice is provided, validate price integrity
    if (order.proposedPrice !== undefined && order.proposedPrice !== null) {
      if (!isValidOrderPrice(order.proposedPrice)) {
        return false;
      }
    }

    const current = this.getAll();
    const existingIndex = current.findIndex(o => o.id === order.id);

    if (existingIndex >= 0) {
      // UPDATE PATH
      const existingOrder = current[existingIndex];

      // 1. Relationship & Identity Integrity Check
      // Reject any attempt to alter canonical relationships
      if (order.requestId !== undefined && order.requestId !== existingOrder.requestId) {
        return false;
      }
      if (order.offerId !== undefined && order.offerId !== existingOrder.offerId) {
        return false;
      }
      if (order.clientId !== undefined && order.clientId !== existingOrder.clientId) {
        return false;
      }
      if (order.artisanId !== undefined && order.artisanId !== existingOrder.artisanId) {
        return false;
      }

      // 2. Status & State Machine Transition Validation
      if ('status' in order) {
        const targetStatus = order.status;
        if (!targetStatus || !validStatuses.includes(targetStatus)) {
          return false;
        }

        if (targetStatus !== existingOrder.status) {
          if (!isValidOrderStateTransition(existingOrder.status, targetStatus)) {
            return false;
          }
        }
      }

      const updated = [...current];
      updated[existingIndex] = {
        ...existingOrder,
        ...order,
        id: existingOrder.id,
        requestId: existingOrder.requestId,
        offerId: existingOrder.offerId,
        clientId: existingOrder.clientId,
        artisanId: existingOrder.artisanId,
        createdAt: existingOrder.createdAt,
      };

      return appLocalStorage.setItem(STORAGE_KEY, updated);
    } else {
      // CREATION PATH
      // Validate status on new order
      if (!order.status || !validStatuses.includes(order.status)) {
        return false;
      }
      // New orders MUST NOT be created in 'pending' status
      if (order.status === 'pending') {
        return false;
      }
      if (!order.artisanId || typeof order.artisanId !== 'string') {
        return false;
      }

      const newOrder: OrderItem = {
        ...order,
        createdAt: order.createdAt || new Date().toISOString(),
      };

      const updated = [newOrder, ...current];
      return appLocalStorage.setItem(STORAGE_KEY, updated);
    }
  }

  public getByUser(userId: string, userEmail?: string): OrderItem[] {
    return filterUserOrders(this.getAll(), userId, userEmail);
  }

  public getByClient(clientId: string): OrderItem[] {
    if (!clientId || typeof clientId !== 'string') return [];
    return this.getAll().filter(o => o.clientId === clientId);
  }

  public getByArtisan(artisanId: string): OrderItem[] {
    if (!artisanId || typeof artisanId !== 'string') return [];
    return this.getAll().filter(o => o.artisanId === artisanId);
  }

  public getByRequestId(requestId: string): OrderItem | null {
    if (!requestId || typeof requestId !== 'string') return null;
    return this.getAll().find(o => o.requestId === requestId) || null;
  }

  public getByOfferId(offerId: string): OrderItem | null {
    if (!offerId || typeof offerId !== 'string') return null;
    return this.getAll().find(o => o.offerId === offerId) || null;
  }

  public updateStatus(id: string, status: OrderStatus): boolean {
    if (!id || typeof id !== 'string') return false;
    const validStatuses: OrderStatus[] = ['assigned', 'in_progress', 'completed', 'cancelled', 'pending'];
    if (!status || !validStatuses.includes(status)) return false;

    const current = this.getAll();
    const index = current.findIndex(o => o.id === id);
    if (index === -1) return false;

    const existingOrder = current[index];
    if (!isValidOrderStateTransition(existingOrder.status, status)) {
      return false;
    }

    const updated = [...current];
    updated[index] = { 
      ...existingOrder, 
      id: existingOrder.id,
      requestId: existingOrder.requestId,
      offerId: existingOrder.offerId,
      clientId: existingOrder.clientId,
      artisanId: existingOrder.artisanId,
      createdAt: existingOrder.createdAt,
      status 
    };
    return appLocalStorage.setItem(STORAGE_KEY, updated);
  }
}

export const orderRepository = new OrderRepository();

