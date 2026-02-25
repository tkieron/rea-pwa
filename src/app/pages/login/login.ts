import { Component, inject, signal } from '@angular/core';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { finalize } from 'rxjs';
import { AuthService, LoginRequestDto, LoginResponseDto } from '../../services/auth';
import { AuthSessionService } from '../../services/auth-session';
import { ApiFeedbackService } from '../../services/api-feedback';

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
  private readonly apiFeedback = inject(ApiFeedbackService);

  readonly submitting = signal(false);

  readonly form = this.fb.nonNullable.group({
    login: ['', [Validators.required, Validators.minLength(3), Validators.maxLength(100)]],
    password: ['', [Validators.required, Validators.minLength(8), Validators.maxLength(255)]],
  });

  onSubmit(): void {
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
          this.apiFeedback.showError(error, {
            title: 'Logowanie nieudane',
            fallbackMessage: 'Nie udalo sie zalogowac.',
            statusMessages: {
              401: 'Niepoprawny login lub haslo.',
              403: 'Email nie jest jeszcze zweryfikowany.',
            },
          });
        },
      });
  }

  isInvalid(controlName: keyof LoginRequestDto): boolean {
    const control = this.form.controls[controlName];
    return control.invalid && (control.touched || control.dirty);
  }
}
