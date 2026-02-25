import { Component, effect, inject, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { catchError, EMPTY } from 'rxjs';
import { AuthSessionService } from './services/auth-session';
import { PingService } from './services/ping';
import { HttpAuthEventsService } from './services/http-auth-events';
import { ToastService } from './services/toast';
import { ToastHostComponent } from './components/toast-host/toast-host';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, ToastHostComponent],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App {
  private readonly authSession = inject(AuthSessionService);
  private readonly pingService = inject(PingService);
  private readonly authEvents = inject(HttpAuthEventsService);
  private readonly toastService = inject(ToastService);
  protected readonly title = signal('rea-pwa');

  constructor() {
    this.authSession.initializeSessionLifecycle();

    if (this.authSession.hasActiveSession()) {
      this.pingService
        .ping()
        .pipe(catchError(() => EMPTY))
        .subscribe();
    }

    effect(() => {
      const authError = this.authEvents.lastAuthError();

      if (authError === null) {
        return;
      }

      if (authError === 401) {
        this.toastService.show(
          {
            kind: 'warning',
            title: 'Sesja wygasla',
            message: 'Zaloguj sie ponownie, aby kontynuowac.',
          },
          { durationMs: 5000 },
        );
      }

      if (authError === 403) {
        this.toastService.show(
          {
            kind: 'error',
            title: 'Brak dostepu',
            message: 'Operacja zostala odrzucona przez API.',
          },
          { durationMs: 4500 },
        );
      }

      this.authEvents.clear();
    });
  }
}
