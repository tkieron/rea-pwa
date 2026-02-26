import { signal } from '@angular/core';
import { of } from 'rxjs';

export function createAuthSessionServiceMock() {
  return {
    initializeSessionLifecycle: vi.fn(),
    hasActiveSession: vi.fn(() => false),
  };
}

export function createPingServiceMock() {
  return {
    ping: vi.fn(() => of({ service: 'api', status: 'ok', timestamp: '' })),
  };
}

export function createHttpAuthEventsServiceMock() {
  return {
    lastAuthError: signal<401 | 403 | null>(null),
    clear: vi.fn(),
  };
}

export function createToastServiceMock() {
  return {
    items: signal([]),
    show: vi.fn(),
    dismiss: vi.fn(),
  };
}

export function createPetsServiceMock() {
  return {
    list: vi.fn(),
    resolvePhotoUrl: vi.fn((url: string | null) => (url ? `resolved/${url}` : null)),
  };
}

export function createDevicesServiceMock() {
  return {
    list: vi.fn(),
  };
}

export function createApiFeedbackServiceMock() {
  return {
    showError: vi.fn(),
  };
}

