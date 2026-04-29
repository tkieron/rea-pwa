# Auth Session and Drawer Menu Design

Date: 2026-04-29

## Context

The app already stores access and refresh tokens in `localStorage`, attaches the access token through the auth interceptor, refreshes tokens after protected API `401` responses, and redirects to `/login` when refresh fails. The current behavior can still leave the user in a broken authenticated-looking state when stored tokens are stale or partially present, especially when a refresh token exists but the access token is missing or expired.

The app also lacks an explicit logout action. The main map view has a hamburger button, and authenticated pages already use bottom navigation. The drawer should become a full navigation alternative for cases where the bottom navigation is less convenient or visually obscured by the map sheet.

## Goals

- Expired, malformed, missing, or backend-rejected session tokens must not leave the user stuck in the app.
- A user can log out explicitly without a confirmation prompt.
- The hamburger button on the map opens a drawer menu.
- The drawer repeats the main bottom navigation items and includes logout.
- Existing bottom navigation remains as the fast primary navigation.

## Non-Goals

- No backend logout endpoint integration unless such endpoint already exists.
- No full authenticated application shell refactor in this step.
- No separate user profile screen in this step.
- No redesign of the bottom navigation.

## Proposed Approach

Implement a shared authenticated drawer component or a tightly scoped drawer in the main map view if reuse is not yet justified by the current page structure. The drawer opens from the hamburger button and contains:

- Map
- Pets
- Activity
- Profile
- Connect Device
- Wyloguj

`Wyloguj` runs immediately. It clears all local session keys and navigates to `/login`. It must not emit the "session expired" auth event, because this is an intentional user action.

## Session Handling

Add an explicit logout method to `AuthSessionService`.

Expected behavior:

- `logout()` clears access token, refresh token, token type, and stored user identity fields.
- `logout()` cancels any access-token expiry timer.
- `logout()` navigates to `/login` if the user is not already there.
- `logout()` does not emit `401`.

Keep automatic expiration handling separate:

- Expired or malformed refresh token: clear session, emit `401`, navigate to `/login`.
- Refresh endpoint rejects the refresh token: clear session, emit `401`, navigate to `/login`.
- Expired access token with valid refresh token: remove the access token and let the next protected request refresh.
- Missing access token with valid refresh token: first protected API request should refresh before retrying, or fail into the existing cleanup path if refresh fails.

## Drawer Behavior

The drawer is opened by the existing hamburger button in the map header overlay.

Behavior:

- Clicking the hamburger opens the drawer.
- Clicking a navigation item closes the drawer and navigates.
- Clicking the backdrop closes the drawer.
- Clicking a close button closes the drawer.
- Clicking `Wyloguj` calls `AuthSessionService.logout()`.
- The drawer should be usable on mobile first, with desktop behavior kept simple and stable.

The bottom navigation remains visible where it exists today. The drawer is an alternate route to the same destinations, plus logout.

## Error Feedback

Automatic session expiration continues to use the existing auth event and toast:

- Title: `Sesja wygasla`
- Message: `Zaloguj sie ponownie, aby kontynuowac.`

Manual logout should not show that toast. If a logout message is later desired, it should be a separate neutral toast, not part of this change.

## Testing

Add or update tests for:

- `AuthSessionService.logout()` clears all session fields and navigates to `/login`.
- Manual logout does not emit a `401` auth event.
- Expired refresh token still clears session, emits `401`, and navigates to `/login`.
- Refresh failure in the interceptor still clears session, emits `401`, and navigates to `/login`.
- The map hamburger opens the drawer.
- The drawer logout action calls `logout()`.

## Open Implementation Notes

- If the drawer is likely to be reused quickly across multiple authenticated pages, create a small standalone component.
- If reuse would require broader page refactoring, implement the drawer in `MainViewMapPage` first and extract later.
- The `Activity` route currently appears in navigation but no route is defined in `app.routes.ts`; preserve current behavior unless the implementation plan decides to hide or disable it.
