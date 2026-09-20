import { appLocalStorage } from './storage';
import { ServiceContactRequest, ContactRequestStatus } from '../types';

const STORAGE_KEY = 'bricojob_contact_requests_v1';

export interface IContactRequestRepository {
  getAll(): ServiceContactRequest[];
  save(request: Omit<ServiceContactRequest, 'id' | 'createdAt' | 'status'>): ServiceContactRequest;
  getByCustomer(customerId: string): ServiceContactRequest[];
  getByArtisan(artisanId: string): ServiceContactRequest[];
  updateStatus(id: string, status: ContactRequestStatus): boolean;
}

export class ContactRequestRepository implements IContactRequestRepository {
  public getAll(): ServiceContactRequest[] {
    const raw = appLocalStorage.getItem<any[]>(STORAGE_KEY, []);
    if (!Array.isArray(raw)) return [];
    return raw
      .filter((r): r is Record<string, any> => Boolean(r && typeof r === 'object' && r.id && typeof r.id === 'string'))
      .map(r => ({
        id: String(r.id),
        artisanId: String(r.artisanId || ''),
        artisanName: String(r.artisanName || 'حرفي'),
        customerId: r.customerId ? String(r.customerId) : (r.clientId ? String(r.clientId) : undefined),
        customerName: String(r.customerName || 'عميل'),
        customerPhone: r.customerPhone ? String(r.customerPhone) : undefined,
        service: String(r.service || 'خدمة عامة'),
        description: String(r.description || ''),
        preferredContact: r.preferredContact === 'whatsapp' ? 'whatsapp' : 'phone',
        createdAt: r.createdAt ? String(r.createdAt) : new Date().toISOString(),
        status: (r.status === 'handled' ? 'handled' : 'pending') as ContactRequestStatus,
      }));
  }

  public save(requestData: Omit<ServiceContactRequest, 'id' | 'createdAt' | 'status'>): ServiceContactRequest {
    const current = this.getAll();
    const newRequest: ServiceContactRequest = {
      ...requestData,
      id: `req_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      createdAt: new Date().toISOString(),
      status: 'pending',
    };
    const persisted = appLocalStorage.setItem(STORAGE_KEY, [newRequest, ...current]);
    if (!persisted) {
      throw new Error('Failed to persist contact request to storage');
    }
    return newRequest;
  }

  public getByCustomer(customerId: string): ServiceContactRequest[] {
    if (!customerId || typeof customerId !== 'string') return [];
    return this.getAll().filter(r => r.customerId === customerId || (r as any).clientId === customerId);
  }

  public getByArtisan(artisanId: string): ServiceContactRequest[] {
    if (!artisanId || typeof artisanId !== 'string') return [];
    return this.getAll().filter(r => r.artisanId === artisanId);
  }

  public updateStatus(id: string, status: ContactRequestStatus): boolean {
    if (!id || typeof id !== 'string') return false;
    if (!status || (status !== 'pending' && status !== 'handled')) {
      return false;
    }
    const current = this.getAll();
    const index = current.findIndex(r => r.id === id);
    if (index === -1) return false;
    current[index] = { ...current[index], status };
    return appLocalStorage.setItem(STORAGE_KEY, current);
  }
}

export const contactRequestRepository = new ContactRequestRepository();
