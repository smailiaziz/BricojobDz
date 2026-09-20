import { appLocalStorage } from './storage';
import { ServiceRequest, ServiceRequestStatus } from '../types';
import { isValidServiceRequestTransition } from '../domain/serviceRequests';

const STORAGE_KEY = 'bricojob_service_requests';

export interface IServiceRequestRepository {
  getAll(): ServiceRequest[];
  getById(id: string): ServiceRequest | null;
  getByClientId(clientId: string): ServiceRequest[];
  create(request: ServiceRequest): boolean;
  update(request: ServiceRequest): boolean;
  cancel(id: string, clientId: string): boolean;
  updateStatus(id: string, status: ServiceRequestStatus, extra?: Partial<ServiceRequest>): boolean;
}

export class ServiceRequestRepository implements IServiceRequestRepository {
  public getAll(): ServiceRequest[] {
    const raw = appLocalStorage.getItem<ServiceRequest[]>(STORAGE_KEY, []);
    return Array.isArray(raw) ? raw : [];
  }

  public getById(id: string): ServiceRequest | null {
    if (!id) return null;
    const all = this.getAll();
    return all.find(r => r.id === id) || null;
  }

  public getByClientId(clientId: string): ServiceRequest[] {
    if (!clientId) return [];
    return this.getAll().filter(r => r.clientId === clientId);
  }

  public create(request: ServiceRequest): boolean {
    if (!request || !request.id) return false;
    const current = this.getAll();
    // Prepend new request so newest appears first
    return appLocalStorage.setItem(STORAGE_KEY, [request, ...current]);
  }

  public update(request: ServiceRequest): boolean {
    if (!request || !request.id) return false;
    const current = this.getAll();
    const index = current.findIndex(r => r.id === request.id);
    if (index === -1) return false;

    const existingRequest = current[index];

    // If status is supplied, it must be a valid non-null/non-undefined status.
    if ('status' in request) {
      const requestedStatus = request.status;
      const validStatuses: ServiceRequestStatus[] = ['open', 'offers_received', 'assigned', 'completed', 'cancelled'];

      if (requestedStatus === null || requestedStatus === undefined || !validStatuses.includes(requestedStatus)) {
        return false;
      }

      if (requestedStatus !== existingRequest.status) {
        if (!isValidServiceRequestTransition(existingRequest.status, requestedStatus)) {
          return false;
        }
      }
    }

    const updated = [...current];
    updated[index] = { 
      ...existingRequest, 
      ...request, 
      id: existingRequest.id, 
      clientId: existingRequest.clientId 
    };
    return appLocalStorage.setItem(STORAGE_KEY, updated);
  }

  public cancel(id: string, clientId: string): boolean {
    if (!id) return false;
    const current = this.getAll();
    const index = current.findIndex(r => r.id === id && r.clientId === clientId);
    if (index === -1) return false;

    // Do not allow cancellation if already assigned or completed
    const req = current[index];
    if (req.status === 'assigned' || req.status === 'completed') {
      return false;
    }

    const updated = [...current];
    updated[index] = { ...req, status: 'cancelled' };
    return appLocalStorage.setItem(STORAGE_KEY, updated);
  }

  public updateStatus(id: string, status: ServiceRequestStatus, extra: Partial<ServiceRequest> = {}): boolean {
    if (!id) return false;
    const validStatuses: ServiceRequestStatus[] = ['open', 'offers_received', 'assigned', 'completed', 'cancelled'];
    if (!status || !validStatuses.includes(status)) {
      return false;
    }

    const current = this.getAll();
    const index = current.findIndex(r => r.id === id);
    if (index === -1) return false;

    const existingRequest = current[index];
    if (!isValidServiceRequestTransition(existingRequest.status, status)) {
      return false;
    }

    const updated = [...current];
    updated[index] = {
      ...existingRequest,
      ...extra,
      id: existingRequest.id,
      clientId: existingRequest.clientId,
      status,
    };
    return appLocalStorage.setItem(STORAGE_KEY, updated);
  }
}

export const serviceRequestRepository = new ServiceRequestRepository();
