import { Injectable, signal } from '@angular/core';

export type ToastKind = 'success' | 'error' | 'info' | 'warning';

export interface Toast {
  id: number;
  kind: ToastKind;
  message: string;
  action?: { label: string; run: () => void };
}

/** Retours visuels systématiques (succès, erreur avec « Réessayer », info). */
@Injectable({ providedIn: 'root' })
export class ToastService {
  readonly toasts = signal<Toast[]>([]);
  private seq = 0;

  show(kind: ToastKind, message: string, action?: Toast['action'], durationMs = kind === 'error' ? 8000 : 4500) {
    const id = ++this.seq;
    this.toasts.update((t) => [...t.slice(-3), { id, kind, message, action }]);
    setTimeout(() => this.dismiss(id), durationMs);
  }

  success(message: string) {
    this.show('success', message);
  }
  error(message: string, retry?: () => void) {
    this.show('error', message, retry ? { label: 'Réessayer', run: retry } : undefined);
  }
  info(message: string) {
    this.show('info', message);
  }

  dismiss(id: number) {
    this.toasts.update((t) => t.filter((x) => x.id !== id));
  }
}
