import { Component, inject, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { catchError, EMPTY } from 'rxjs';
import { AuthSessionService } from './services/auth-session';
import { PingService } from './services/ping';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App {
  private readonly authSession = inject(AuthSessionService);
  private readonly pingService = inject(PingService);
  protected readonly title = signal('rea-pwa');

  constructor() {
    this.authSession.initializeSessionLifecycle();

    if (this.authSession.hasActiveSession()) {
      this.pingService
        .ping()
        .pipe(catchError(() => EMPTY))
        .subscribe();
    }
  }
}
