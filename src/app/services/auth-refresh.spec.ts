import { TestBed } from '@angular/core/testing';
import { Observable, Subject, firstValueFrom, of } from 'rxjs';
import { AuthService, RefreshTokenResponseDto } from './auth';
import { AuthRefreshService } from './auth-refresh';
import { AuthSessionService } from './auth-session';

describe('AuthRefreshService', () => {
  let service: AuthRefreshService;
  let authServiceMock: {
    refresh: ReturnType<typeof vi.fn<(payload: { refreshToken: string }) => Observable<RefreshTokenResponseDto>>>;
  };
  let authSessionMock: {
    getValidRefreshToken: ReturnType<typeof vi.fn<() => string | null>>;
    updateTokenPair: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    authServiceMock = {
      refresh: vi.fn(),
    };
    authSessionMock = {
      getValidRefreshToken: vi.fn(() => 'refresh-token'),
      updateTokenPair: vi.fn(),
    };

    TestBed.configureTestingModule({
      providers: [
        AuthRefreshService,
        { provide: AuthService, useValue: authServiceMock },
        { provide: AuthSessionService, useValue: authSessionMock },
      ],
    });

    service = TestBed.inject(AuthRefreshService);
  });

  it('should fail when refresh token is missing', async () => {
    authSessionMock.getValidRefreshToken.mockReturnValue(null);

    await expect(firstValueFrom(service.refreshTokens())).rejects.toThrow(
      'Missing or expired refresh token',
    );
    expect(authServiceMock.refresh).not.toHaveBeenCalled();
  });

  it('should refresh tokens and update session token pair', async () => {
    const response: RefreshTokenResponseDto = {
      tokens: {
        accessToken: 'new-access',
        refreshToken: 'new-refresh',
        tokenType: 'Bearer',
      },
    };
    authServiceMock.refresh.mockReturnValue(of(response));

    await expect(firstValueFrom(service.refreshTokens())).resolves.toEqual(response);

    expect(authServiceMock.refresh).toHaveBeenCalledWith({ refreshToken: 'refresh-token' });
    expect(authSessionMock.updateTokenPair).toHaveBeenCalledWith(response.tokens);
  });

  it('should share in-flight refresh request and reset after completion', async () => {
    const refreshSubject = new Subject<RefreshTokenResponseDto>();
    authServiceMock.refresh.mockReturnValue(refreshSubject.asObservable());

    const first$ = service.refreshTokens();
    const second$ = service.refreshTokens();

    const firstPromise = firstValueFrom(first$);
    const secondPromise = firstValueFrom(second$);

    expect(authServiceMock.refresh).toHaveBeenCalledTimes(1);
    expect(first$).toBe(second$);

    const response: RefreshTokenResponseDto = {
      tokens: {
        accessToken: 'a1',
        refreshToken: 'r1',
        tokenType: 'Bearer',
      },
    };
    refreshSubject.next(response);
    refreshSubject.complete();

    await expect(firstPromise).resolves.toEqual(response);
    await expect(secondPromise).resolves.toEqual(response);

    authServiceMock.refresh.mockReturnValue(
      of({
        tokens: {
          accessToken: 'a2',
          refreshToken: 'r2',
          tokenType: 'Bearer',
        },
      }),
    );

    await firstValueFrom(service.refreshTokens());
    expect(authServiceMock.refresh).toHaveBeenCalledTimes(2);
  });
});

