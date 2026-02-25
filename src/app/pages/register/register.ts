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
import { AuthService, RegisterRequestDto } from '../../services/auth';
import { ApiFeedbackService } from '../../services/api-feedback';

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
  private readonly apiFeedback = inject(ApiFeedbackService);

  readonly submitting = signal(false);

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
          this.apiFeedback.showSuccess(
            'Rejestracja wyslana',
            'Konto zostalo utworzone lub zgloszenie zostalo przyjete.',
          );
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
          this.apiFeedback.showError(error, {
            title: 'Rejestracja nieudana',
            fallbackMessage: 'Nie udalo sie zarejestrowac konta.',
          });
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
}
