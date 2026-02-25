import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, switchMap, throwError } from 'rxjs';
import { API_BASE_URL } from '../api.tokens';
import { AUTH_RETRY_ATTEMPTED, SKIP_AUTH_INTERCEPTOR } from './http-context.tokens';
import { AuthSessionService } from '../../services/auth-session';
import { HttpAuthEventsService } from '../../services/http-auth-events';
import { AuthRefreshService } from '../../services/auth-refresh';

function isApiRequest(url: string, apiBaseUrl: string): boolean {
  if (url.startsWith('/api/')) {
    return true;
  }

  if (apiBaseUrl && url.startsWith(apiBaseUrl + '/api/')) {
    return true;
  }

  return false;
}

function isAuthEndpoint(url: string): boolean {
  return url.includes('/api/v1/auth/');
}

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const session = inject(AuthSessionService);
  const router = inject(Router);
  const authEvents = inject(HttpAuthEventsService);
  const refreshService = inject(AuthRefreshService);
  const apiBaseUrl = inject(API_BASE_URL);

  const skipInterceptor = req.context.get(SKIP_AUTH_INTERCEPTOR);
  const retryAttempted = req.context.get(AUTH_RETRY_ATTEMPTED);
  const shouldAttachToken =
    !skipInterceptor && isApiRequest(req.url, apiBaseUrl) && !req.headers.has('Authorization');

  const authorizationHeader = shouldAttachToken ? session.getAuthorizationHeaderValue() : null;

  const request = authorizationHeader
    ? req.clone({
        setHeaders: {
          Authorization: authorizationHeader,
        },
      })
    : req;

  return next(request).pipe(
    catchError((error: unknown) => {
      if (!(error instanceof HttpErrorResponse)) {
        return throwError(() => error);
      }

      if (error.status === 403) {
        const authEndpoint = isAuthEndpoint(request.url);
        if (!authEndpoint) {
          authEvents.emit(403);
        }

        const protectedApiRequest =
          isApiRequest(request.url, apiBaseUrl) && !authEndpoint && !skipInterceptor;

        if (protectedApiRequest) {
          session.clearSession();

          if (router.url !== '/login') {
            void router.navigateByUrl('/login');
          }
        }

        return throwError(() => error);
      }

      if (error.status !== 401) {
        return throwError(() => error);
      }

      if (isAuthEndpoint(request.url) || skipInterceptor) {
        return throwError(() => error);
      }

      if (retryAttempted) {
        authEvents.emit(401);
        session.clearSession();

        if (router.url !== '/login') {
          void router.navigateByUrl('/login');
        }

        return throwError(() => error);
      }

      return refreshService.refreshTokens().pipe(
        switchMap(() => {
          const refreshedAuthorization = session.getAuthorizationHeaderValue();
          const retriedRequest = request.clone({
            context: request.context.set(AUTH_RETRY_ATTEMPTED, true),
            ...(refreshedAuthorization
              ? {
                  setHeaders: {
                    Authorization: refreshedAuthorization,
                  },
                }
              : {}),
          });

          return next(retriedRequest);
        }),
        catchError((refreshError: unknown) => {
          authEvents.emit(401);
          session.clearSession();

          if (router.url !== '/login') {
            void router.navigateByUrl('/login');
          }

          return throwError(() => refreshError);
        }),
      );
    }),
  );
};
