import { describe, it, expect, beforeEach } from 'vitest';
import { serviceRequestRepository } from '../repositories/serviceRequestRepository';
import { appLocalStorage } from '../repositories/storage';
import { ServiceRequest, ServiceRequestStatus } from '../types';

describe('Stage 9 — ServiceRequestRepository.update() State Machine Bypass Hardening', () => {
  const STORAGE_KEY = 'bricojob_service_requests';

  beforeEach(() => {
    // Reset/Clear mock storage specifically for service requests
    appLocalStorage.removeItem(STORAGE_KEY);
  });

  const getMockRequest = (overrides: Partial<ServiceRequest> = {}): ServiceRequest => ({
    id: 'req-abc',
    clientId: 'client-123',
    clientName: 'Aziz',
    category: 'plumbing',
    title: 'Water Leak',
    description: 'Leaking pipe under kitchen sink.',
    wilaya: 'الجزائر',
    city: 'باب الزوار',
    urgency: 'now',
    status: 'open',
    createdAt: new Date().toISOString(),
    ...overrides
  });

  // 1. Valid non-status partial update succeeds
  it('allows a valid non-status partial update to succeed', () => {
    const original = getMockRequest();
    serviceRequestRepository.create(original);

    const updateObj = {
      id: original.id,
      description: 'Brand new description without changing status'
    } as any;

    const result = serviceRequestRepository.update(updateObj);
    expect(result).toBe(true);

    const persisted = serviceRequestRepository.getById(original.id);
    expect(persisted).not.toBeNull();
    expect(persisted?.description).toBe('Brand new description without changing status');
    expect(persisted?.status).toBe('open'); // status remains unchanged
  });

  // 2. Unchanged status behaves correctly
  it('allows updates when status is supplied but unchanged', () => {
    const original = getMockRequest({ status: 'offers_received' });
    serviceRequestRepository.create(original);

    const updateObj = {
      id: original.id,
      title: 'Water Leak Urgent',
      status: 'offers_received' as ServiceRequestStatus
    } as any;

    const result = serviceRequestRepository.update(updateObj);
    expect(result).toBe(true);

    const persisted = serviceRequestRepository.getById(original.id);
    expect(persisted).not.toBeNull();
    expect(persisted?.title).toBe('Water Leak Urgent');
    expect(persisted?.status).toBe('offers_received');
  });

  // 3. Valid existing transition succeeds
  it('allows update when a valid status transition is requested', () => {
    const original = getMockRequest({ status: 'open' });
    serviceRequestRepository.create(original);

    const updateObj = {
      id: original.id,
      status: 'offers_received' as ServiceRequestStatus
    } as any;

    const result = serviceRequestRepository.update(updateObj);
    expect(result).toBe(true);

    const persisted = serviceRequestRepository.getById(original.id);
    expect(persisted?.status).toBe('offers_received');
  });

  // 4. Invalid transition is rejected
  it('rejects an invalid status transition at repository update level', () => {
    // Transition from 'open' straight to 'completed' is invalid
    const original = getMockRequest({ status: 'open' });
    serviceRequestRepository.create(original);

    const updateObj = {
      id: original.id,
      status: 'completed' as ServiceRequestStatus
    } as any;

    const result = serviceRequestRepository.update(updateObj);
    expect(result).toBe(false);

    const persisted = serviceRequestRepository.getById(original.id);
    expect(persisted?.status).toBe('open'); // remains open
  });

  // 5. Unknown status is rejected
  it('rejects update if status is unknown/invalid', () => {
    const original = getMockRequest({ status: 'open' });
    serviceRequestRepository.create(original);

    const updateObj = {
      id: original.id,
      status: 'super_completed' as any
    };

    const result = serviceRequestRepository.update(updateObj as any);
    expect(result).toBe(false);

    const persisted = serviceRequestRepository.getById(original.id);
    expect(persisted?.status).toBe('open');
  });

  // 6. Malformed status is rejected
  it('rejects update if status is malformed or null', () => {
    const original = getMockRequest({ status: 'open' });
    serviceRequestRepository.create(original);

    const updateObj = {
      id: original.id,
      status: null as any
    };

    const result = serviceRequestRepository.update(updateObj as any);
    expect(result).toBe(false);

    const persisted = serviceRequestRepository.getById(original.id);
    expect(persisted?.status).toBe('open');
  });

  // 7. Invalid transition with another field change does NOT partially persist that field
  it('ensures updates are atomic: invalid transition with another field change does NOT partially persist that field', () => {
    const original = getMockRequest({ status: 'open', description: 'Original description' });
    serviceRequestRepository.create(original);

    const updateObj = {
      id: original.id,
      description: 'Malicious changed description',
      status: 'completed' as ServiceRequestStatus // Invalid transition from open -> completed
    } as any;

    const result = serviceRequestRepository.update(updateObj);
    expect(result).toBe(false); // Entire operation rejected

    const persisted = serviceRequestRepository.getById(original.id);
    expect(persisted).not.toBeNull();
    expect(persisted?.description).toBe('Original description'); // Unaffected/Not partially persisted
    expect(persisted?.status).toBe('open'); // Unaffected
  });

  // 8. Existing authorization/ownership behavior remains unchanged
  it('ensures existing authorization/ownership controls and client identity rules remain completely unchanged and protected', () => {
    const original = getMockRequest({ clientId: 'client-123' });
    serviceRequestRepository.create(original);

    // Attempting to bypass clientId via update must be neutralized (clientId should be preserved as immutable)
    const updateObj = {
      id: original.id,
      clientId: 'attacker-client-id', // Try to hijack the service request
      title: 'Legitimate updated title'
    } as any;

    const result = serviceRequestRepository.update(updateObj);
    expect(result).toBe(true); // Update succeeded but hijacked field was neutralized

    const persisted = serviceRequestRepository.getById(original.id);
    expect(persisted).not.toBeNull();
    expect(persisted?.clientId).toBe('client-123'); // Still protected!
    expect(persisted?.title).toBe('Legitimate updated title');
  });
});
