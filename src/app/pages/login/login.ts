import { Component, inject, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { finalize } from 'rxjs';
import { AuthService, LoginRequestDto, LoginResponseDto } from '../../services/auth';
import { AuthSessionService } from '../../services/auth-session';

@Component({
  selector: 'app-login-page',
  standalone: true,
  imports: [RouterLink, ReactiveFormsModule],
  templateUrl: './login.html',
  styleUrl: './login.scss',
})
export class LoginPage {
  private readonly fb = inject(FormBuilder);
  private readonly authService = inject(AuthService);
  private readonly authSession = inject(AuthSessionService);
  private readonly router = inject(Router);

  readonly submitting = signal(false);
  readonly submitError = signal<string | null>(null);

  readonly form = this.fb.nonNullable.group({
    login: ['', [Validators.required, Validators.minLength(3), Validators.maxLength(100)]],
    password: ['', [Validators.required, Validators.minLength(8), Validators.maxLength(255)]],
  });

  onSubmit(): void {
    this.submitError.set(null);

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const payload: LoginRequestDto = this.form.getRawValue();

    this.submitting.set(true);
    this.authService
      .login(payload)
      .pipe(finalize(() => this.submitting.set(false)))
      .subscribe({
        next: (response: LoginResponseDto) => {
          this.authSession.setSessionFromLoginResponse(response);
          void this.router.navigateByUrl('/main-view-map');
        },
        error: (error: unknown) => {
          this.submitError.set(this.extractErrorMessage(error));
        },
      });
  }

  isInvalid(controlName: keyof LoginRequestDto): boolean {
    const control = this.form.controls[controlName];
    return control.invalid && (control.touched || control.dirty);
  }

  private extractErrorMessage(error: unknown): string {
    if (error instanceof HttpErrorResponse) {
      const apiMessage =
        (typeof error.error === 'string' && error.error) ||
        (typeof error.error?.message === 'string' && error.error.message) ||
        (typeof error.error?.error === 'string' && error.error.error);

      if (apiMessage) {
        return apiMessage;
      }

      if (error.status === 0) {
        return 'Brak polaczenia z API.';
      }

      if (error.status === 401) {
        return 'Niepoprawny login lub haslo.';
      }

      if (error.status === 403) {
        return 'Email nie jest jeszcze zweryfikowany.';
      }
    }

    return 'Nie udalo sie zalogowac.';
  }
}
