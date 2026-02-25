import { inject } from '@angular/core';
import { CanActivateFn, CanMatchFn, Router } from '@angular/router';
import { AuthSessionService } from '../../services/auth-session';

export const authRequiredGuard: CanActivateFn = () => {
  const authSession = inject(AuthSessionService);
  const router = inject(Router);

  return authSession.hasActiveSession() ? true : router.createUrlTree(['/login']);
};

export const anonymousOnlyGuard: CanActivateFn = () => {
  const authSession = inject(AuthSessionService);
  const router = inject(Router);

  return authSession.hasActiveSession() ? router.createUrlTree(['/main-view-map']) : true;
};

export const authRequiredMatchGuard: CanMatchFn = () => {
  const authSession = inject(AuthSessionService);
  return authSession.hasActiveSession();
};

export const anonymousOnlyMatchGuard: CanMatchFn = () => {
  const authSession = inject(AuthSessionService);
  return !authSession.hasActiveSession();
};
