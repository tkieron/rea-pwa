import { inject, Injectable } from '@angular/core';
import { Observable, shareReplay, tap, finalize, throwError } from 'rxjs';
import { AuthService, RefreshTokenResponseDto } from './auth';
import { AuthSessionService } from './auth-session';

@Injectable({
  providedIn: 'root',
})
export class AuthRefreshService {
  private readonly authService = inject(AuthService);
  private readonly authSession = inject(AuthSessionService);

  private refreshInFlight$: Observable<RefreshTokenResponseDto> | null = null;

  refreshTokens(): Observable<RefreshTokenResponseDto> {
    if (this.refreshInFlight$) {
      return this.refreshInFlight$;
    }

    const refreshToken = this.authSession.getValidRefreshToken();

    if (!refreshToken) {
      return throwError(() => new Error('Missing or expired refresh token'));
    }

    this.refreshInFlight$ = this.authService
      .refresh({ refreshToken })
      .pipe(
        tap((response) => this.authSession.updateTokenPair(response.tokens)),
        finalize(() => {
          this.refreshInFlight$ = null;
        }),
        shareReplay(1),
      );

    return this.refreshInFlight$;
  }
}
