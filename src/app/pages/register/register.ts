import { Component, inject, signal } from '@angular/core';
import {
  AbstractControl,
  FormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  ValidatorFn,
  Validators,
} from '@angular/forms';
import { RouterLink } from '@angular/router';
import { finalize } from 'rxjs';
import { HttpErrorResponse } from '@angular/common/http';
import { AuthService, RegisterRequestDto } from '../../services/auth';

function fieldsMatchValidator(
  sourceField: string,
  confirmField: string,
  errorKey: string,
): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const source = control.get(sourceField)?.value;
    const confirm = control.get(confirmField)?.value;

    if (!source || !confirm) {
      return null;
    }

    return source === confirm ? null : { [errorKey]: true };
  };
}

@Component({
  selector: 'app-register-page',
  standalone: true,
  imports: [RouterLink, ReactiveFormsModule],
  templateUrl: './register.html',
  styleUrl: './register.scss',
})
export class RegisterPage {
  private readonly fb = inject(FormBuilder);
  private readonly authService = inject(AuthService);

  readonly submitting = signal(false);
  readonly submitError = signal<string | null>(null);
  readonly submitSuccess = signal<string | null>(null);

  readonly form = this.fb.nonNullable.group(
    {
      name: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(120)]],
      email: ['', [Validators.required, Validators.email, Validators.maxLength(190)]],
      login: ['', [Validators.required, Validators.minLength(3), Validators.maxLength(100)]],
      confirmLogin: ['', [Validators.required, Validators.minLength(3), Validators.maxLength(100)]],
      password: ['', [Validators.required, Validators.minLength(8), Validators.maxLength(255)]],
      confirmPassword: [
        '',
        [Validators.required, Validators.minLength(8), Validators.maxLength(255)],
      ],
    },
    {
      validators: [
        fieldsMatchValidator('login', 'confirmLogin', 'loginMismatch'),
        fieldsMatchValidator('password', 'confirmPassword', 'passwordMismatch'),
      ],
    },
  );

  onSubmit(): void {
    this.submitError.set(null);
    this.submitSuccess.set(null);

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const payload: RegisterRequestDto = this.form.getRawValue();

    this.submitting.set(true);
    this.authService
      .register(payload)
      .pipe(finalize(() => this.submitting.set(false)))
      .subscribe({
        next: () => {
          this.submitSuccess.set('Rejestracja wysłana poprawnie.');
          this.form.reset({
            name: '',
            email: '',
            login: '',
            confirmLogin: '',
            password: '',
            confirmPassword: '',
          });
        },
        error: (error: unknown) => {
          this.submitError.set(this.extractErrorMessage(error));
        },
      });
  }

  isInvalid(controlName: keyof RegisterRequestDto): boolean {
    const control = this.form.controls[controlName];
    return control.invalid && (control.touched || control.dirty);
  }

  hasGroupError(errorKey: 'loginMismatch' | 'passwordMismatch'): boolean {
    return Boolean(this.form.errors?.[errorKey]) && (this.form.touched || this.form.dirty);
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
        return 'Brak połączenia z API.';
      }
    }

    return 'Nie udało się zarejestrować konta.';
  }
}
