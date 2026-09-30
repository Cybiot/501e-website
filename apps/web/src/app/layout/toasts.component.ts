import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ToastService } from '../core/toast.service';
import { IconComponent } from '../shared/icon.component';

const ICON = { success: 'check-circle', error: 'x-circle', info: 'info', warning: 'alert-triangle' } as const;

@Component({
  selector: 'app-toasts',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent],
  template: `
    <div class="toasts" aria-live="polite" aria-relevant="additions">
      @for (toast of toasts.toasts(); track toast.id) {
        <div class="toast toast--{{ toast.kind }}" [attr.role]="toast.kind === 'error' ? 'alert' : 'status'">
          <app-icon [name]="icon[toast.kind]" [size]="18" />
          <p>{{ toast.message }}</p>
          @if (toast.action; as action) {
            <button type="button" class="btn btn--sm" (click)="action.run(); toasts.dismiss(toast.id)">{{ action.label }}</button>
          }
          <button type="button" class="toast__close" (click)="toasts.dismiss(toast.id)" aria-label="Fermer la notification">
            <app-icon name="x" [size]="16" />
          </button>
        </div>
      }
    </div>
  `,
  styles: `
    .toasts {
      position: fixed;
      z-index: 300;
      right: var(--gutter);
      bottom: var(--gutter);
      left: var(--gutter);
      display: flex;
      flex-direction: column;
      align-items: flex-end;
      gap: var(--space-2);
      pointer-events: none;
    }
    .toast {
      pointer-events: auto;
      display: flex;
      align-items: center;
      gap: var(--space-3);
      max-width: 440px;
      width: 100%;
      padding: var(--space-3) var(--space-3) var(--space-3) var(--space-4);
      border-radius: var(--radius);
      background: var(--surface-2);
      border: 1px solid var(--border-strong);
      border-left: 4px solid var(--info);
      box-shadow: var(--shadow-3);
      animation: pop-in var(--dur) var(--ease);
    }
    .toast p {
      margin: 0;
      flex: 1;
      font-size: var(--fs-sm);
    }
    .toast--success {
      border-left-color: var(--success);
    }
    .toast--success app-icon {
      color: var(--success);
    }
    .toast--error {
      border-left-color: var(--danger);
    }
    .toast--error app-icon {
      color: var(--danger);
    }
    .toast--warning {
      border-left-color: var(--warning);
    }
    .toast__close {
      background: none;
      border: 0;
      color: var(--text-muted);
      cursor: pointer;
      padding: var(--space-1);
      border-radius: var(--radius-sm);
    }
  `,
})
export class ToastsComponent {
  protected readonly toasts = inject(ToastService);
  protected readonly icon = ICON;
}
