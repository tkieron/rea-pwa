import { TestBed } from '@angular/core/testing';
import { HttpErrorResponse, HttpRequest, HttpResponse } from '@angular/common/http';
import { Router } from '@angular/router';
import { firstValueFrom, of, throwError } from 'rxjs';
import { API_BASE_URL } from '../api.tokens';
import { authInterceptor } from './auth.interceptor';
import { AuthRefreshService } from '../../services/auth-refresh';
import { AuthSessionService } from '../../services/auth-session';
import { HttpAuthEventsService } from '../../services/http-auth-events';

describe('authInterceptor', () => {
  let routerMock: {
    url: string;
    navigateByUrl: ReturnType<typeof vi.fn<(url: string) => Promise<boolean>>>;
  };
  let sessionMock: {
    getAuthorizationHeaderValue: ReturnType<typeof vi.fn<() => string | null>>;
    clearSession: ReturnType<typeof vi.fn>;
  };
  let authEventsMock: {
    emit: ReturnType<typeof vi.fn<(code: 401 | 403) => void>>;
  };
  let refreshServiceMock: {
    refreshTokens: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    routerMock = {
      url: '/main-view-map',
      navigateByUrl: vi.fn(async () => true),
    };
    sessionMock = {
      getAuthorizationHeaderValue: vi.fn(() => 'Bearer access-token'),
      clearSession: vi.fn(),
    };
    authEventsMock = {
      emit: vi.fn(),
    };
    refreshServiceMock = {
      refreshTokens: vi.fn(),
    };

    TestBed.configureTestingModule({
      providers: [
        { provide: API_BASE_URL, useValue: '' },
        { provide: Router, useValue: routerMock },
        { provide: AuthSessionService, useValue: sessionMock },
        { provide: HttpAuthEventsService, useValue: authEventsMock },
        { provide: AuthRefreshService, useValue: refreshServiceMock },
      ],
    });
  });

  it('keeps the current session on forbidden protected API errors', async () => {
    const request = new HttpRequest('GET', '/api/v1/pets/12/route');
    const response = new HttpErrorResponse({
      status: 403,
      statusText: 'Forbidden',
      url: '/api/v1/pets/12/route',
    });

    await expect(
      TestBed.runInInjectionContext(() =>
        firstValueFrom(authInterceptor(request, () => throwError(() => response))),
      ),
    ).rejects.toBe(response);

    expect(authEventsMock.emit).toHaveBeenCalledWith(403);
    expect(sessionMock.clearSession).not.toHaveBeenCalled();
    expect(routerMock.navigateByUrl).not.toHaveBeenCalled();
  });

  it('refreshes before sending a protected API request when authorization header is missing', async () => {
    sessionMock.getAuthorizationHeaderValue
      .mockReturnValueOnce(null)
      .mockReturnValueOnce('Bearer refreshed-access');
    refreshServiceMock.refreshTokens.mockReturnValue(
      of({
        tokens: {
          accessToken: 'refreshed-access',
          refreshToken: 'refreshed-refresh',
          tokenType: 'Bearer',
        },
      }),
    );

    const request = new HttpRequest('GET', '/api/v1/pets');
    const next = vi.fn((req: HttpRequest<unknown>) => of(new HttpResponse({ body: { req } })));

    await firstValueFrom(
      TestBed.runInInjectionContext(() => authInterceptor(request, next as never)),
    );

    expect(refreshServiceMock.refreshTokens).toHaveBeenCalled();
    expect(next).toHaveBeenCalledTimes(1);
    expect(next.mock.calls[0][0].headers.get('Authorization')).toBe('Bearer refreshed-access');
  });

  it('clears session and navigates to login when preflight refresh fails', async () => {
    sessionMock.getAuthorizationHeaderValue.mockReturnValue(null);
    refreshServiceMock.refreshTokens.mockReturnValue(throwError(() => new Error('refresh failed')));

    const request = new HttpRequest('GET', '/api/v1/pets');
    const next = vi.fn();

    await expect(
      TestBed.runInInjectionContext(() => firstValueFrom(authInterceptor(request, next as never))),
    ).rejects.toThrow('refresh failed');

    expect(next).not.toHaveBeenCalled();
    expect(authEventsMock.emit).toHaveBeenCalledWith(401);
    expect(sessionMock.clearSession).toHaveBeenCalled();
    expect(routerMock.navigateByUrl).toHaveBeenCalledWith('/login');
  });
});
