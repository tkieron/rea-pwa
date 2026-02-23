import { inject, Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { HttpAuthEventsService } from './http-auth-events';
import { TokenPairDto } from './auth';

const ACCESS_TOKEN_KEY = 'rea.auth.access_token';
const REFRESH_TOKEN_KEY = 'rea.auth.refresh_token';
const TOKEN_TYPE_KEY = 'rea.auth.token_type';
const USER_ID_KEY = 'rea.auth.user_id';
const USER_LOGIN_KEY = 'rea.auth.user_login';
const USER_ROLE_KEY = 'rea.auth.user_role';

interface JwtPayload {
  exp?: number;
}

@Injectable({
  providedIn: 'root',
})
export class AuthSessionService {
  private readonly router = inject(Router);
  private readonly authEvents = inject(HttpAuthEventsService);
  private accessTokenExpiryTimerId: number | null = null;

  initializeSessionLifecycle(): void {
    const refreshToken = this.peekRefreshToken();
    const accessToken = this.peekAccessToken();

    if (!refreshToken && !accessToken) {
      this.clearExpiryTimer();
      return;
    }

    if (refreshToken && this.isJwtExpired(refreshToken)) {
      this.handleExpiredToken();
      return;
    }

    if (!accessToken) {
      this.clearExpiryTimer();
      return;
    }

    if (this.isJwtExpired(accessToken)) {
      this.clearExpiredAccessTokenOnly();
      return;
    }

    this.scheduleAccessTokenExpiry(accessToken);
  }

  setSessionFromLoginResponse(payload: {
    id: number;
    login: string;
    role: string;
    tokens: TokenPairDto;
  }): void {
    try {
      localStorage.setItem(USER_ID_KEY, String(payload.id));
      localStorage.setItem(USER_LOGIN_KEY, payload.login);
      localStorage.setItem(USER_ROLE_KEY, payload.role);
      localStorage.setItem(ACCESS_TOKEN_KEY, payload.tokens.accessToken);
      localStorage.setItem(REFRESH_TOKEN_KEY, payload.tokens.refreshToken);
      localStorage.setItem(TOKEN_TYPE_KEY, payload.tokens.tokenType || 'Bearer');
    } catch {
      // Ignore storage errors.
    }

    this.scheduleAccessTokenExpiry(payload.tokens.accessToken);
  }

  getAuthorizationHeaderValue(): string | null {
    const accessToken = this.getValidAccessToken();

    if (!accessToken) {
      return null;
    }

    const tokenType = this.peekTokenType() ?? 'Bearer';
    return `${tokenType} ${accessToken}`;
  }

  getValidAccessToken(): string | null {
    const accessToken = this.peekAccessToken();

    if (!accessToken) {
      return null;
    }

    if (this.isJwtExpired(accessToken)) {
      this.clearExpiredAccessTokenOnly();
      return null;
    }

    return accessToken;
  }

  getValidRefreshToken(): string | null {
    const refreshToken = this.peekRefreshToken();

    if (!refreshToken) {
      return null;
    }

    if (this.isJwtExpired(refreshToken)) {
      this.handleExpiredToken();
      return null;
    }

    return refreshToken;
  }

  hasActiveSession(): boolean {
    const refreshToken = this.peekRefreshToken();
    const accessToken = this.peekAccessToken();

    if (!refreshToken && !accessToken) {
      return false;
    }

    if (refreshToken) {
      if (this.isJwtExpired(refreshToken)) {
        this.clearSession();
        return false;
      }

      return true;
    }

    if (!accessToken) {
      return false;
    }

    if (this.isJwtExpired(accessToken)) {
      this.clearSession();
      return false;
    }

    return true;
  }

  updateTokenPair(tokens: TokenPairDto): void {
    try {
      localStorage.setItem(ACCESS_TOKEN_KEY, tokens.accessToken);
      localStorage.setItem(REFRESH_TOKEN_KEY, tokens.refreshToken);
      localStorage.setItem(TOKEN_TYPE_KEY, tokens.tokenType || 'Bearer');
    } catch {
      // Ignore storage errors.
    }

    this.scheduleAccessTokenExpiry(tokens.accessToken);
  }

  clearSession(): void {
    this.clearExpiryTimer();

    try {
      localStorage.removeItem(ACCESS_TOKEN_KEY);
      localStorage.removeItem(REFRESH_TOKEN_KEY);
      localStorage.removeItem(TOKEN_TYPE_KEY);
      localStorage.removeItem(USER_ID_KEY);
      localStorage.removeItem(USER_LOGIN_KEY);
      localStorage.removeItem(USER_ROLE_KEY);
    } catch {
      // Intentionally ignore storage errors.
    }
  }

  handleExpiredToken(): void {
    this.clearSession();
    this.authEvents.emit(401);

    if (this.router.url !== '/login') {
      void this.router.navigateByUrl('/login');
    }
  }

  private peekAccessToken(): string | null {
    try {
      return localStorage.getItem(ACCESS_TOKEN_KEY);
    } catch {
      return null;
    }
  }

  private peekRefreshToken(): string | null {
    try {
      return localStorage.getItem(REFRESH_TOKEN_KEY);
    } catch {
      return null;
    }
  }

  private peekTokenType(): string | null {
    try {
      return localStorage.getItem(TOKEN_TYPE_KEY);
    } catch {
      return null;
    }
  }

  private isJwtExpired(token: string): boolean {
    const payload = this.parseJwtPayload(token);
    const exp = payload?.exp;

    if (!exp) {
      return true;
    }

    const nowSeconds = Math.floor(Date.now() / 1000);
    return exp <= nowSeconds;
  }

  private scheduleAccessTokenExpiry(token: string): void {
    this.clearExpiryTimer();

    const payload = this.parseJwtPayload(token);
    const exp = payload?.exp;

    if (!exp) {
      this.handleExpiredToken();
      return;
    }

    const expiresAtMs = exp * 1000;
    const delayMs = expiresAtMs - Date.now();

    if (delayMs <= 0) {
      this.clearExpiredAccessTokenOnly();
      return;
    }

    this.accessTokenExpiryTimerId = globalThis.setTimeout(() => {
      this.clearExpiredAccessTokenOnly();
    }, delayMs);
  }

  private clearExpiredAccessTokenOnly(): void {
    this.clearExpiryTimer();

    const refreshToken = this.peekRefreshToken();
    if (!refreshToken || this.isJwtExpired(refreshToken)) {
      this.handleExpiredToken();
      return;
    }

    try {
      localStorage.removeItem(ACCESS_TOKEN_KEY);
    } catch {
      // Ignore storage errors.
    }
  }

  private clearExpiryTimer(): void {
    if (this.accessTokenExpiryTimerId !== null) {
      globalThis.clearTimeout(this.accessTokenExpiryTimerId);
      this.accessTokenExpiryTimerId = null;
    }
  }

  private parseJwtPayload(token: string): JwtPayload | null {
    const segments = token.split('.');

    if (segments.length < 2) {
      return null;
    }

    try {
      const base64 = segments[1].replace(/-/g, '+').replace(/_/g, '/');
      const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, '=');
      const json = globalThis.atob(padded);
      return JSON.parse(json) as JwtPayload;
    } catch {
      return null;
    }
  }
}
