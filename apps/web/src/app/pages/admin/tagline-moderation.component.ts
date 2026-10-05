import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Api, ApiError } from '../../core/api.service';
import { TaglineModerationItem } from '../../core/models';
import { ToastService } from '../../core/toast.service';
import { AvatarComponent } from '../../shared/avatar.component';
import { IconComponent } from '../../shared/icon.component';

/** File de modération des phrases personnalisées : textes courts, traités en liste. */
@Component({
  selector: 'app-tagline-moderation',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DatePipe, FormsModule, IconComponent, AvatarComponent],
  template: `
    @if (items() === null) {
      <div class="skeleton" style="height: 220px"></div>
    } @else if (items()!.length === 0) {
      <div class="empty"><app-icon name="check-circle" [size]="36" /><h3>File vide</h3><p>Aucune phrase en attente de validation.</p></div>
    } @else {
      <ul class="taglines stack">
        @for (it of items(); track it.userId) {
          <li class="card">
            <div class="row">
              <app-avatar [src]="it.member.discordAvatarUrl" [name]="it.member.displayName" [size]="36" />
              <div>
                <strong>{{ it.member.displayName }}</strong>
                <div class="small muted">{{ it.member.rank?.name ?? 'Sans grade' }} · envoyée le {{ it.submittedAt | date: 'dd/MM/yyyy HH:mm' }}</div>
              </div>
            </div>
            <blockquote class="taglines__text">« {{ it.text }} »</blockquote>
            <p class="small muted">Phrase actuelle : {{ it.currentText ? '« ' + it.currentText + ' »' : 'aucune' }}</p>

            @if (rejecting() === it.userId) {
              <div class="field" style="margin: 0">
                <label [for]="'reason-' + it.userId">Motif de rejet (obligatoire)</label>
                <select [id]="'reason-' + it.userId" class="select" [(ngModel)]="preset" (ngModelChange)="reason = $event">
                  <option value="">— Motif prédéfini —</option>
                  @for (r of reasons(); track r) {
                    <option [value]="r">{{ r }}</option>
                  }
                </select>
                <textarea class="textarea" rows="2" maxlength="300" [(ngModel)]="reason" placeholder="Ou précise le motif…" aria-label="Motif détaillé"></textarea>
              </div>
              <div class="row">
                <button type="button" class="btn btn--danger btn--sm" (click)="reject(it)" [disabled]="busy() || reason.trim().length < 3">
                  <app-icon name="x" [size]="14" /> Confirmer le rejet
                </button>
                <button type="button" class="btn btn--ghost btn--sm" (click)="rejecting.set(null)">Annuler</button>
              </div>
            } @else {
              <div class="row">
                <button type="button" class="btn btn--primary btn--sm" (click)="approve(it)" [disabled]="busy()"><app-icon name="check" [size]="14" /> Approuver</button>
                <button type="button" class="btn btn--danger btn--sm" (click)="startReject(it)" [disabled]="busy()"><app-icon name="x" [size]="14" /> Rejeter</button>
              </div>
            }
          </li>
        }
      </ul>
    }
  `,
  styles: `
    .taglines {
      list-style: none;
      margin: 0;
      padding: 0;
    }
    .taglines__text {
      margin: var(--space-4) 0 var(--space-2);
      font-size: 1.1rem;
      overflow-wrap: anywhere;
    }
  `,
})
export class TaglineModerationComponent {
  private readonly api = inject(Api);
  private readonly toast = inject(ToastService);

  protected readonly items = signal<TaglineModerationItem[] | null>(null);
  protected readonly reasons = signal<string[]>([]);
  protected readonly busy = signal(false);
  protected readonly rejecting = signal<string | null>(null);
  protected reason = '';
  protected preset = '';

  constructor() {
    void this.load();
  }

  private async load() {
    try {
      const r = await this.api.get<{ reasons: string[]; items: TaglineModerationItem[] }>('/admin/moderation/taglines');
      this.items.set(r.items);
      this.reasons.set(r.reasons);
    } catch (err) {
      this.toast.error((err as ApiError).message, () => void this.load());
    }
  }

  protected startReject(it: TaglineModerationItem) {
    this.rejecting.set(it.userId);
    this.reason = '';
    this.preset = '';
  }

  protected async approve(it: TaglineModerationItem) {
    if (this.busy()) return;
    this.busy.set(true);
    try {
      await this.api.post(`/admin/moderation/taglines/${it.userId}/approve`, { text: it.text });
      this.toast.success(`Phrase de ${it.member.displayName} approuvée.`);
    } catch (err) {
      this.toast.error((err as ApiError).message);
    } finally {
      this.busy.set(false);
      await this.load();
    }
  }

  protected async reject(it: TaglineModerationItem) {
    if (this.busy() || this.reason.trim().length < 3) return;
    this.busy.set(true);
    try {
      await this.api.post(`/admin/moderation/taglines/${it.userId}/reject`, { text: it.text, reason: this.reason.trim() });
      this.toast.success(`Phrase de ${it.member.displayName} rejetée. Le membre verra le motif.`);
      this.rejecting.set(null);
    } catch (err) {
      this.toast.error((err as ApiError).message);
    } finally {
      this.busy.set(false);
      await this.load();
    }
  }
}
