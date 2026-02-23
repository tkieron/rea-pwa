import { Injectable, signal } from '@angular/core';

export type AuthHttpErrorCode = 401 | 403;

@Injectable({
  providedIn: 'root',
})
export class HttpAuthEventsService {
  readonly lastAuthError = signal<AuthHttpErrorCode | null>(null);

  emit(errorCode: AuthHttpErrorCode): void {
    this.lastAuthError.set(errorCode);
  }

  clear(): void {
    this.lastAuthError.set(null);
  }
}
