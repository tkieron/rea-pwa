import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpContext } from '@angular/common/http';
import { Observable } from 'rxjs';
import { API_BASE_URL } from '../core/api.tokens';
import { SKIP_AUTH_INTERCEPTOR } from '../core/http/http-context.tokens';

export interface RegisterRequestDto {
  name: string;
  email: string;
  login: string;
  confirmLogin: string;
  password: string;
  confirmPassword: string;
}

export interface LoginRequestDto {
  login: string;
  password: string;
}

export type UserRole = 'ADMIN' | 'OPERATOR' | 'USER';

export interface TokenPairDto {
  accessToken: string;
  refreshToken: string;
  tokenType: string;
}

export interface LoginResponseDto {
  id: number;
  login: string;
  role: UserRole;
  tokens: TokenPairDto;
}

export interface RefreshTokenRequestDto {
  refreshToken: string;
}

export interface RefreshTokenResponseDto {
  tokens: TokenPairDto;
}

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly apiBaseUrl = inject(API_BASE_URL);

  register(payload: RegisterRequestDto): Observable<unknown> {
    return this.http.post<unknown>(`${this.apiBaseUrl}/api/v1/auth/register`, payload, {
      context: new HttpContext().set(SKIP_AUTH_INTERCEPTOR, true),
    });
  }

  login(payload: LoginRequestDto): Observable<LoginResponseDto> {
    return this.http.post<LoginResponseDto>(`${this.apiBaseUrl}/api/v1/auth/login`, payload, {
      context: new HttpContext().set(SKIP_AUTH_INTERCEPTOR, true),
    });
  }

  refresh(payload: RefreshTokenRequestDto): Observable<RefreshTokenResponseDto> {
    return this.http.post<RefreshTokenResponseDto>(`${this.apiBaseUrl}/api/v1/auth/refresh`, payload, {
      context: new HttpContext().set(SKIP_AUTH_INTERCEPTOR, true),
    });
  }
}
