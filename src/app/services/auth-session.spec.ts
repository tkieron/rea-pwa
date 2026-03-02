import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { HttpAuthEventsService } from './http-auth-events';
import { AuthSessionService } from './auth-session';
import { TokenPairDto } from './auth';

const ACCESS_TOKEN_KEY = 'rea.auth.access_token';
const REFRESH_TOKEN_KEY = 'rea.auth.refresh_token';
const TOKEN_TYPE_KEY = 'rea.auth.token_type';
const USER_ID_KEY = 'rea.auth.user_id';
const USER_LOGIN_KEY = 'rea.auth.user_login';
const USER_ROLE_KEY = 'rea.auth.user_role';

function createJwtWithExp(expSeconds: number): string {
  const header = globalThis.btoa(JSON.stringify({ alg: 'none', typ: 'JWT' }));
  const payload = globalThis.btoa(JSON.stringify({ exp: expSeconds }));
  return `${header}.${payload}.signature`;
}

function futureJwt(offsetSeconds = 3600): string {
  const nowSeconds = Math.floor(Date.now() / 1000);
  return createJwtWithExp(nowSeconds + offsetSeconds);
}

function expiredJwt(offsetSeconds = 3600): string {
  const nowSeconds = Math.floor(Date.now() / 1000);
  return createJwtWithExp(nowSeconds - offsetSeconds);
}

function setTokenPair(tokens: Partial<TokenPairDto> & { accessToken?: string; refreshToken?: string } = {}) {
  if (tokens.accessToken !== undefined) {
    localStorage.setItem(ACCESS_TOKEN_KEY, tokens.accessToken);
  }
  if (tokens.refreshToken !== undefined) {
    localStorage.setItem(REFRESH_TOKEN_KEY, tokens.refreshToken);
  }
  if (tokens.tokenType !== undefined) {
    localStorage.setItem(TOKEN_TYPE_KEY, tokens.tokenType);
  }
}

describe('AuthSessionService', () => {
  let service: AuthSessionService;
  let routerMock: {
    url: string;
    navigateByUrl: ReturnType<typeof vi.fn<(url: string) => Promise<boolean>>>;
  };
  let authEventsMock: {
    emit: ReturnType<typeof vi.fn<(code: 401 | 403) => void>>;
  };

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-02-26T12:00:00Z'));
    localStorage.clear();

    routerMock = {
      url: '/pets',
      navigateByUrl: vi.fn(async () => true),
    };
    authEventsMock = {
      emit: vi.fn(),
    };

    TestBed.configureTestingModule({
      providers: [
        AuthSessionService,
        { provide: Router, useValue: routerMock },
        { provide: HttpAuthEventsService, useValue: authEventsMock },
      ],
    });

    service = TestBed.inject(AuthSessionService);
  });

  afterEach(() => {
    localStorage.clear();
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
  });

  it('should return false when no tokens exist', () => {
    expect(service.hasActiveSession()).toBe(false);
  });

  it('should return true when valid refresh token exists even without access token', () => {
    setTokenPair({ refreshToken: futureJwt() });

    expect(service.hasActiveSession()).toBe(true);
  });

  it('should clear session and return false when refresh token is expired', () => {
    setTokenPair({
      accessToken: futureJwt(),
      refreshToken: expiredJwt(),
      tokenType: 'Bearer',
    });
    localStorage.setItem(USER_ID_KEY, '1');

    expect(service.hasActiveSession()).toBe(false);

    expect(localStorage.getItem(ACCESS_TOKEN_KEY)).toBeNull();
    expect(localStorage.getItem(REFRESH_TOKEN_KEY)).toBeNull();
    expect(localStorage.getItem(USER_ID_KEY)).toBeNull();
  });

  it('should return authorization header with stored token type', () => {
    setTokenPair({
      accessToken: futureJwt(),
      refreshToken: futureJwt(7200),
      tokenType: 'Token',
    });

    expect(service.getAuthorizationHeaderValue()).toBe(`Token ${localStorage.getItem(ACCESS_TOKEN_KEY)}`);
  });

  it('should default authorization header type to Bearer', () => {
    const accessToken = futureJwt();
    setTokenPair({
      accessToken,
      refreshToken: futureJwt(7200),
    });

    expect(service.getAuthorizationHeaderValue()).toBe(`Bearer ${accessToken}`);
  });

  it('should clear only expired access token when refresh token is still valid', () => {
    setTokenPair({
      accessToken: expiredJwt(),
      refreshToken: futureJwt(7200),
      tokenType: 'Bearer',
    });

    expect(service.getValidAccessToken()).toBeNull();

    expect(localStorage.getItem(ACCESS_TOKEN_KEY)).toBeNull();
    expect(localStorage.getItem(REFRESH_TOKEN_KEY)).not.toBeNull();
    expect(authEventsMock.emit).not.toHaveBeenCalled();
  });

  it('should handle expired refresh token in getValidRefreshToken', () => {
    setTokenPair({
      accessToken: futureJwt(),
      refreshToken: expiredJwt(),
      tokenType: 'Bearer',
    });

    expect(service.getValidRefreshToken()).toBeNull();

    expect(authEventsMock.emit).toHaveBeenCalledWith(401);
    expect(routerMock.navigateByUrl).toHaveBeenCalledWith('/login');
    expect(localStorage.getItem(ACCESS_TOKEN_KEY)).toBeNull();
    expect(localStorage.getItem(REFRESH_TOKEN_KEY)).toBeNull();
  });

  it('should not navigate on expired token when already on login route', () => {
    routerMock.url = '/login';
    setTokenPair({
      refreshToken: expiredJwt(),
    });

    service.getValidRefreshToken();

    expect(authEventsMock.emit).toHaveBeenCalledWith(401);
    expect(routerMock.navigateByUrl).not.toHaveBeenCalled();
  });

  it('should persist login response data and tokens', () => {
    const payload = {
      id: 99,
      login: 'alice',
      role: 'USER',
      tokens: {
        accessToken: futureJwt(100),
        refreshToken: futureJwt(7200),
        tokenType: 'Bearer',
      },
    } as const;

    service.setSessionFromLoginResponse(payload);

    expect(localStorage.getItem(USER_ID_KEY)).toBe('99');
    expect(localStorage.getItem(USER_LOGIN_KEY)).toBe('alice');
    expect(localStorage.getItem(USER_ROLE_KEY)).toBe('USER');
    expect(localStorage.getItem(ACCESS_TOKEN_KEY)).toBe(payload.tokens.accessToken);
    expect(localStorage.getItem(REFRESH_TOKEN_KEY)).toBe(payload.tokens.refreshToken);
    expect(localStorage.getItem(TOKEN_TYPE_KEY)).toBe('Bearer');
  });

  it('should default token type to Bearer in updateTokenPair', () => {
    service.updateTokenPair({
      accessToken: futureJwt(100),
      refreshToken: futureJwt(200),
      tokenType: '',
    });

    expect(localStorage.getItem(TOKEN_TYPE_KEY)).toBe('Bearer');
  });

  it('should initialize lifecycle and clear expired access token when refresh token is valid', () => {
    setTokenPair({
      accessToken: expiredJwt(),
      refreshToken: futureJwt(7200),
      tokenType: 'Bearer',
    });

    service.initializeSessionLifecycle();

    expect(localStorage.getItem(ACCESS_TOKEN_KEY)).toBeNull();
    expect(localStorage.getItem(REFRESH_TOKEN_KEY)).not.toBeNull();
    expect(authEventsMock.emit).not.toHaveBeenCalled();
  });

  it('should initialize lifecycle and handle expired refresh token', () => {
    setTokenPair({
      accessToken: futureJwt(),
      refreshToken: expiredJwt(),
      tokenType: 'Bearer',
    });

    service.initializeSessionLifecycle();

    expect(authEventsMock.emit).toHaveBeenCalledWith(401);
    expect(routerMock.navigateByUrl).toHaveBeenCalledWith('/login');
  });

  it('should remove access token when scheduled expiry time is reached', () => {
    setTokenPair({
      accessToken: futureJwt(5),
      refreshToken: futureJwt(3600),
      tokenType: 'Bearer',
    });

    service.initializeSessionLifecycle();

    expect(localStorage.getItem(ACCESS_TOKEN_KEY)).not.toBeNull();

    vi.advanceTimersByTime(5000);

    expect(localStorage.getItem(ACCESS_TOKEN_KEY)).toBeNull();
    expect(localStorage.getItem(REFRESH_TOKEN_KEY)).not.toBeNull();
    expect(authEventsMock.emit).not.toHaveBeenCalled();
  });

  it('should treat malformed access token as expired', () => {
    setTokenPair({
      accessToken: 'not-a-jwt',
      refreshToken: futureJwt(3600),
      tokenType: 'Bearer',
    });

    expect(service.getAuthorizationHeaderValue()).toBeNull();
    expect(localStorage.getItem(ACCESS_TOKEN_KEY)).toBeNull();
    expect(localStorage.getItem(REFRESH_TOKEN_KEY)).not.toBeNull();
  });

  it('should clear all session fields explicitly', () => {
    setTokenPair({
      accessToken: futureJwt(),
      refreshToken: futureJwt(7200),
      tokenType: 'Bearer',
    });
    localStorage.setItem(USER_ID_KEY, '1');
    localStorage.setItem(USER_LOGIN_KEY, 'john');
    localStorage.setItem(USER_ROLE_KEY, 'USER');

    service.clearSession();

    expect(localStorage.getItem(ACCESS_TOKEN_KEY)).toBeNull();
    expect(localStorage.getItem(REFRESH_TOKEN_KEY)).toBeNull();
    expect(localStorage.getItem(TOKEN_TYPE_KEY)).toBeNull();
    expect(localStorage.getItem(USER_ID_KEY)).toBeNull();
    expect(localStorage.getItem(USER_LOGIN_KEY)).toBeNull();
    expect(localStorage.getItem(USER_ROLE_KEY)).toBeNull();
  });
});

