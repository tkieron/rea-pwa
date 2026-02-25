import { Injectable, inject } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { ToastService } from './toast';

@Injectable({
  providedIn: 'root',
})
export class ApiFeedbackService {
  private readonly toastService = inject(ToastService);

  showError(
    error: unknown,
    options: {
      title: string;
      fallbackMessage: string;
      networkMessage?: string;
      statusMessages?: Partial<Record<number, string>>;
    },
  ): void {
    this.toastService.show({
      kind: 'error',
      title: options.title,
      message: this.extractErrorMessage(error, options),
    });
  }

  showSuccess(title: string, message?: string, durationMs = 3000): void {
    this.toastService.show(
      {
        kind: 'success',
        title,
        message,
      },
      { durationMs },
    );
  }

  private extractErrorMessage(
    error: unknown,
    options: {
      fallbackMessage: string;
      networkMessage?: string;
      statusMessages?: Partial<Record<number, string>>;
    },
  ): string {
    if (error instanceof HttpErrorResponse) {
      const apiMessage =
        (typeof error.error === 'string' && error.error) ||
        (typeof error.error?.message === 'string' && error.error.message) ||
        (typeof error.error?.error === 'string' && error.error.error);

      if (apiMessage) {
        return apiMessage;
      }

      const mapped = options.statusMessages?.[error.status];
      if (mapped) {
        return mapped;
      }

      if (error.status === 0) {
        return options.networkMessage ?? 'Brak polaczenia z API.';
      }
    }

    return options.fallbackMessage;
  }
}
