import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { AuthSessionService } from '../../services/auth-session';
import {
  anonymousOnlyGuard,
  anonymousOnlyMatchGuard,
  authRequiredGuard,
  authRequiredMatchGuard,
} from './auth.guards';

describe('auth guards', () => {
  let authSessionMock: { hasActiveSession: ReturnType<typeof vi.fn<() => boolean>> };
  let routerMock: {
    createUrlTree: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    authSessionMock = {
      hasActiveSession: vi.fn(() => false),
    };
    routerMock = {
      createUrlTree: vi.fn((commands: unknown[]) => ({ commands })),
    };

    TestBed.configureTestingModule({
      providers: [
        { provide: AuthSessionService, useValue: authSessionMock },
        { provide: Router, useValue: routerMock },
      ],
    });
  });

  it('authRequiredGuard should allow active session', () => {
    authSessionMock.hasActiveSession.mockReturnValue(true);

    const result = TestBed.runInInjectionContext(() => authRequiredGuard({} as never, {} as never));

    expect(result).toBe(true);
  });

  it('authRequiredGuard should redirect anonymous user to login', () => {
    const result = TestBed.runInInjectionContext(() => authRequiredGuard({} as never, {} as never));

    expect(routerMock.createUrlTree).toHaveBeenCalledWith(['/login']);
    expect(result).toEqual({ commands: ['/login'] });
  });

  it('anonymousOnlyGuard should allow anonymous user', () => {
    authSessionMock.hasActiveSession.mockReturnValue(false);

    const result = TestBed.runInInjectionContext(() => anonymousOnlyGuard({} as never, {} as never));

    expect(result).toBe(true);
  });

  it('anonymousOnlyGuard should redirect logged user to main map', () => {
    authSessionMock.hasActiveSession.mockReturnValue(true);

    const result = TestBed.runInInjectionContext(() => anonymousOnlyGuard({} as never, {} as never));

    expect(routerMock.createUrlTree).toHaveBeenCalledWith(['/main-view-map']);
    expect(result).toEqual({ commands: ['/main-view-map'] });
  });

  it('authRequiredMatchGuard should return session state', () => {
    authSessionMock.hasActiveSession.mockReturnValue(true);
    expect(TestBed.runInInjectionContext(() => authRequiredMatchGuard({} as never, []))).toBe(true);

    authSessionMock.hasActiveSession.mockReturnValue(false);
    expect(TestBed.runInInjectionContext(() => authRequiredMatchGuard({} as never, []))).toBe(false);
  });

  it('anonymousOnlyMatchGuard should invert session state', () => {
    authSessionMock.hasActiveSession.mockReturnValue(true);
    expect(TestBed.runInInjectionContext(() => anonymousOnlyMatchGuard({} as never, []))).toBe(false);

    authSessionMock.hasActiveSession.mockReturnValue(false);
    expect(TestBed.runInInjectionContext(() => anonymousOnlyMatchGuard({} as never, []))).toBe(true);
  });
});

