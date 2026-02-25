import { Injectable, signal } from '@angular/core';

export type ToastKind = 'info' | 'success' | 'warning' | 'error';

export interface ToastMessage {
  id: number;
  kind: ToastKind;
  title: string;
  message?: string;
}

@Injectable({
  providedIn: 'root',
})
export class ToastService {
  readonly items = signal<ToastMessage[]>([]);

  private nextId = 1;

  show(input: Omit<ToastMessage, 'id'>, options?: { durationMs?: number }): number {
    const id = this.nextId++;
    const toast: ToastMessage = { id, ...input };

    this.items.update((current) => [...current, toast]);

    const durationMs = options?.durationMs ?? 4000;
    if (durationMs > 0) {
      globalThis.setTimeout(() => this.dismiss(id), durationMs);
    }

    return id;
  }

  dismiss(id: number): void {
    this.items.update((current) => current.filter((item) => item.id !== id));
  }

  clearAll(): void {
    this.items.set([]);
  }
}
