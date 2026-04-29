# Auth Session and Drawer Menu Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make stale auth sessions recover automatically and add a hamburger drawer with navigation plus immediate logout.

**Architecture:** Keep session ownership in `AuthSessionService`, refresh ownership in `AuthRefreshService` and the HTTP interceptor, and UI ownership in `MainViewMapPage`. Avoid a global app shell refactor; implement the drawer in the map view first because the hamburger exists there today.

**Tech Stack:** Angular 20 standalone components, Angular Router, functional HTTP interceptor, RxJS, Vitest, Angular TestBed.

---

## File Structure

- Modify `src/app/services/auth-session.ts`: add explicit `logout()`, keep automatic expiration behavior separate.
- Modify `src/app/services/auth-session.spec.ts`: cover manual logout and no `401` event on manual logout.
- Modify `src/app/core/http/auth.interceptor.ts`: ensure protected API requests without an access token but with an active refresh token refresh before sending the protected request.
- Modify `src/app/core/http/auth.interceptor.spec.ts`: cover missing access token refresh behavior and refresh failure cleanup.
- Modify `src/app/pages/main-view-map/main-view-map.ts`: add drawer state, menu navigation helpers, logout handler, and inject `AuthSessionService`.
- Modify `src/app/pages/main-view-map/main-view-map.html`: wire hamburger button and drawer markup.
- Modify `src/app/pages/main-view-map/main-view-map.scss`: drawer/backdrop styling.
- Modify `src/app/pages/main-view-map/main-view-map.spec.ts`: cover drawer open/close and logout action.
- Modify `src/test-helpers/service-mocks.ts`: add `logout` to auth session mock if tests need it.

## Task 1: Manual Logout API

**Files:**
- Modify: `src/app/services/auth-session.ts`
- Test: `src/app/services/auth-session.spec.ts`

- [ ] **Step 1: Write failing tests**

Add tests:

```ts
it('should logout without emitting session expired event', () => {
  setTokenPair({
    accessToken: futureJwt(),
    refreshToken: futureJwt(7200),
    tokenType: 'Bearer',
  });
  localStorage.setItem(USER_ID_KEY, '1');
  localStorage.setItem(USER_LOGIN_KEY, 'john');
  localStorage.setItem(USER_ROLE_KEY, 'USER');

  service.logout();

  expect(localStorage.getItem(ACCESS_TOKEN_KEY)).toBeNull();
  expect(localStorage.getItem(REFRESH_TOKEN_KEY)).toBeNull();
  expect(localStorage.getItem(TOKEN_TYPE_KEY)).toBeNull();
  expect(localStorage.getItem(USER_ID_KEY)).toBeNull();
  expect(localStorage.getItem(USER_LOGIN_KEY)).toBeNull();
  expect(localStorage.getItem(USER_ROLE_KEY)).toBeNull();
  expect(authEventsMock.emit).not.toHaveBeenCalled();
  expect(routerMock.navigateByUrl).toHaveBeenCalledWith('/login');
});

it('should not navigate during logout when already on login route', () => {
  routerMock.url = '/login';

  service.logout();

  expect(routerMock.navigateByUrl).not.toHaveBeenCalled();
  expect(authEventsMock.emit).not.toHaveBeenCalled();
});
```

- [ ] **Step 2: Run failing test**

Run: `npm test -- src/app/services/auth-session.spec.ts`

Expected: FAIL because `logout` does not exist.

- [ ] **Step 3: Implement `logout()`**

Add to `AuthSessionService`:

```ts
logout(): void {
  this.clearSession();

  if (this.router.url !== '/login') {
    void this.router.navigateByUrl('/login');
  }
}
```

- [ ] **Step 4: Run passing test**

Run: `npm test -- src/app/services/auth-session.spec.ts`

Expected: PASS.

## Task 2: Refresh Before Sending Tokenless Protected Requests

**Files:**
- Modify: `src/app/core/http/auth.interceptor.ts`
- Test: `src/app/core/http/auth.interceptor.spec.ts`

- [ ] **Step 1: Write failing tests**

Extend the session mock shape with `getValidRefreshToken` if needed, or spy through `AuthRefreshService`.

Add tests:

```ts
it('refreshes before sending a protected API request when authorization header is missing', async () => {
  sessionMock.getAuthorizationHeaderValue
    .mockReturnValueOnce(null)
    .mockReturnValueOnce('Bearer refreshed-access');
  refreshServiceMock.refreshTokens.mockReturnValue(of({ tokens: {
    accessToken: 'refreshed-access',
    refreshToken: 'refreshed-refresh',
    tokenType: 'Bearer',
  }}));

  const request = new HttpRequest('GET', '/api/v1/pets');
  const next = vi.fn((req: HttpRequest<unknown>) => of({ req }));

  await firstValueFrom(TestBed.runInInjectionContext(() => authInterceptor(request, next as never)));

  expect(refreshServiceMock.refreshTokens).toHaveBeenCalled();
  expect(next).toHaveBeenCalledTimes(1);
  expect(next.mock.calls[0][0].headers.get('Authorization')).toBe('Bearer refreshed-access');
});

it('clears session and navigates to login when preflight refresh fails', async () => {
  sessionMock.getAuthorizationHeaderValue.mockReturnValue(null);
  refreshServiceMock.refreshTokens.mockReturnValue(throwError(() => new Error('refresh failed')));

  const request = new HttpRequest('GET', '/api/v1/pets');

  await expect(
    TestBed.runInInjectionContext(() =>
      firstValueFrom(authInterceptor(request, vi.fn() as never)),
    ),
  ).rejects.toThrow('refresh failed');

  expect(authEventsMock.emit).toHaveBeenCalledWith(401);
  expect(sessionMock.clearSession).toHaveBeenCalled();
  expect(routerMock.navigateByUrl).toHaveBeenCalledWith('/login');
});
```

- [ ] **Step 2: Run failing tests**

Run: `npm test -- src/app/core/http/auth.interceptor.spec.ts`

Expected: FAIL because tokenless protected requests are sent without preflight refresh.

- [ ] **Step 3: Implement preflight refresh**

In `authInterceptor`, before `next(request)`, if:

- request is a protected API request,
- auth interceptor is not skipped,
- request has no explicit `Authorization`,
- `session.getAuthorizationHeaderValue()` returns `null`,
- retry has not already been attempted,

call `refreshService.refreshTokens()`, then clone the original request with the refreshed authorization header and `AUTH_RETRY_ATTEMPTED`. On refresh error, emit `401`, clear session, navigate to `/login`, and rethrow.

- [ ] **Step 4: Run passing tests**

Run: `npm test -- src/app/core/http/auth.interceptor.spec.ts`

Expected: PASS.

## Task 3: Drawer State and Logout Handler

**Files:**
- Modify: `src/app/pages/main-view-map/main-view-map.ts`
- Test: `src/app/pages/main-view-map/main-view-map.spec.ts`
- Modify if needed: `src/test-helpers/service-mocks.ts`

- [ ] **Step 1: Write failing tests**

Add `AuthSessionService` provider mock with `logout: vi.fn()`.

Add tests:

```ts
it('opens and closes the drawer menu', () => {
  const fixture = TestBed.createComponent(MainViewMapPage);
  fixture.detectChanges();

  const menuButton = fixture.nativeElement.querySelector('[data-testid="main-menu-button"]') as HTMLButtonElement;
  menuButton.click();
  fixture.detectChanges();

  expect(fixture.nativeElement.querySelector('.app-drawer')).not.toBeNull();

  const closeButton = fixture.nativeElement.querySelector('[data-testid="drawer-close-button"]') as HTMLButtonElement;
  closeButton.click();
  fixture.detectChanges();

  expect(fixture.nativeElement.querySelector('.app-drawer')).toBeNull();
});

it('logs out from the drawer menu', () => {
  const fixture = TestBed.createComponent(MainViewMapPage);
  fixture.detectChanges();

  fixture.componentInstance.openDrawer();
  fixture.detectChanges();

  const logoutButton = fixture.nativeElement.querySelector('[data-testid="drawer-logout-button"]') as HTMLButtonElement;
  logoutButton.click();

  expect(mockAuthSession.logout).toHaveBeenCalled();
  expect(fixture.componentInstance.drawerOpen()).toBe(false);
});
```

- [ ] **Step 2: Run failing tests**

Run: `npm test -- src/app/pages/main-view-map/main-view-map.spec.ts`

Expected: FAIL because drawer state and handlers do not exist.

- [ ] **Step 3: Implement component state**

Add to `MainViewMapPage`:

```ts
private readonly authSession = inject(AuthSessionService);
readonly drawerOpen = signal(false);

openDrawer(): void {
  this.drawerOpen.set(true);
}

closeDrawer(): void {
  this.drawerOpen.set(false);
}

logout(): void {
  this.closeDrawer();
  this.authSession.logout();
}
```

- [ ] **Step 4: Run passing tests**

Run: `npm test -- src/app/pages/main-view-map/main-view-map.spec.ts`

Expected: PASS.

## Task 4: Drawer Markup and Styling

**Files:**
- Modify: `src/app/pages/main-view-map/main-view-map.html`
- Modify: `src/app/pages/main-view-map/main-view-map.scss`
- Test: `src/app/pages/main-view-map/main-view-map.spec.ts`

- [ ] **Step 1: Update HTML**

Change the hamburger button:

```html
<button type="button" class="circle" data-testid="main-menu-button" aria-label="Open menu" (click)="openDrawer()">☰</button>
```

Add drawer markup near the end of `.main-view`:

```html
@if (drawerOpen()) {
<div class="drawer-backdrop" (click)="closeDrawer()"></div>
<aside class="app-drawer" aria-label="Main menu">
  <header class="drawer-header">
    <div>
      <strong>PetTrack</strong>
      <span>Menu</span>
    </div>
    <button type="button" class="drawer-close" data-testid="drawer-close-button" aria-label="Close menu" (click)="closeDrawer()">×</button>
  </header>
  <nav class="drawer-nav">
    <a routerLink="/main-view-map" routerLinkActive="active-drawer-nav" [routerLinkActiveOptions]="{exact: true}" (click)="closeDrawer()">
      <span class="material-symbols-outlined">map</span>
      <span>Map</span>
    </a>
    <a routerLink="/pets" routerLinkActive="active-drawer-nav" [routerLinkActiveOptions]="{exact: true}" (click)="closeDrawer()">
      <span class="material-symbols-outlined">pets</span>
      <span>Pets</span>
    </a>
    <a routerLink="/activity" (click)="closeDrawer()">
      <span class="material-symbols-outlined">monitoring</span>
      <span>Activity</span>
    </a>
    <a [routerLink]="profileLink()" routerLinkActive="active-drawer-nav" (click)="closeDrawer()">
      <span class="material-symbols-outlined">person</span>
      <span>Profile</span>
    </a>
    <a routerLink="/connect-device" routerLinkActive="active-drawer-nav" (click)="closeDrawer()">
      <span class="material-symbols-outlined">qr_code_scanner</span>
      <span>Connect Device</span>
    </a>
  </nav>
  <button type="button" class="drawer-logout" data-testid="drawer-logout-button" (click)="logout()">
    <span class="material-symbols-outlined">logout</span>
    <span>Wyloguj</span>
  </button>
</aside>
}
```

- [ ] **Step 2: Add styles**

Style `.drawer-backdrop`, `.app-drawer`, `.drawer-header`, `.drawer-nav`, `.active-drawer-nav`, and `.drawer-logout` to sit above the map and sheet with a fixed left drawer.

- [ ] **Step 3: Run drawer tests**

Run: `npm test -- src/app/pages/main-view-map/main-view-map.spec.ts`

Expected: PASS.

## Task 5: Focused Regression Run

**Files:**
- No new files.

- [ ] **Step 1: Run auth/session tests**

Run:

```bash
npm test -- src/app/services/auth-session.spec.ts src/app/core/http/auth.interceptor.spec.ts src/app/pages/main-view-map/main-view-map.spec.ts
```

Expected: PASS.

- [ ] **Step 2: Run full suite if focused tests pass**

Run:

```bash
npm test
```

Expected: PASS or only unrelated pre-existing failures documented with exact failing tests.

- [ ] **Step 3: Review git diff**

Run:

```bash
git diff -- src/app/services/auth-session.ts src/app/services/auth-session.spec.ts src/app/core/http/auth.interceptor.ts src/app/core/http/auth.interceptor.spec.ts src/app/pages/main-view-map/main-view-map.ts src/app/pages/main-view-map/main-view-map.html src/app/pages/main-view-map/main-view-map.scss src/app/pages/main-view-map/main-view-map.spec.ts src/test-helpers/service-mocks.ts
```

Expected: Diff only contains session recovery and drawer menu changes.
