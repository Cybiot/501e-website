import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, HostListener, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { Api, ApiError } from '../../core/api.service';
import { ModerationItem } from '../../core/models';
import { ToastService } from '../../core/toast.service';
import { AvatarComponent } from '../../shared/avatar.component';
import { IconComponent } from '../../shared/icon.component';
import { TaglineModerationComponent } from './tagline-moderation.component';

/**
 * Files de modération (images et phrases). Raccourcis des images : A = approuver, R = rejeter, J/K ou ←/→ = image suivante/précédente.
 */
@Component({
  selector: 'app-moderation-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DatePipe, FormsModule, IconComponent, AvatarComponent, TaglineModerationComponent],
  template: `
    <div class="row row--between">
      <h1 class="admin-title">Modération</h1>
      @if (tab() === 'images') {
        <span class="small muted kbd-hint"><kbd>A</kbd> approuver · <kbd>R</kbd> rejeter · <kbd>J</kbd>/<kbd>K</kbd> naviguer</span>
      }
    </div>

    <div class="tabs" role="tablist">
      <button type="button" role="tab" [attr.aria-selected]="tab() === 'images'" (click)="tab.set('images')">
        <app-icon name="image" [size]="16" /> Images
      </button>
      <button type="button" role="tab" [attr.aria-selected]="tab() === 'phrases'" (click)="tab.set('phrases')">
        <app-icon name="message" [size]="16" /> Phrases
      </button>
    </div>

    @if (tab() === 'phrases') {
      <app-tagline-moderation />
    } @else if (items() === null) {
      <div class="skeleton" style="height: 420px"></div>
    } @else if (items()!.length === 0) {
      <div class="empty"><app-icon name="check-circle" [size]="36" /><h3>File vide</h3><p>Aucune image en attente de validation.</p></div>
    } @else if (current(); as it) {
      <p class="small muted">Image {{ index() + 1 }} sur {{ items()!.length }}</p>
      <div class="mod">
        <figure class="mod__main">
          <img [src]="it.url" [alt]="'Image proposée par ' + it.member.displayName" width="360" height="480" />
          <figcaption class="small muted">Envoyée le {{ it.submittedAt | date: 'dd/MM/yyyy HH:mm' }}</figcaption>
        </figure>
        <div class="mod__side">
          <div class="row">
            <app-avatar [src]="it.member.discordAvatarUrl" [name]="it.member.displayName" [size]="44" />
            <div>
              <strong>{{ it.member.displayName }}</strong>
              <div class="small muted">{{ it.member.rank?.name ?? 'Sans grade' }}</div>
            </div>
          </div>
          <p class="label" style="margin-top: var(--space-4)">Image actuelle</p>
          @if (it.member.currentImageUrl) {
            <img [src]="it.member.currentImageUrl" alt="Image actuellement affichée" width="90" height="120" class="thumb" />
          } @else {
            <p class="small muted">Avatar Discord</p>
          }

          <div class="stack" style="margin-top: var(--space-5)">
            <button type="button" class="btn btn--primary btn--block" (click)="approve()" [disabled]="busy()"><app-icon name="check" [size]="16" /> Approuver</button>
            <div class="field" style="margin: 0">
              <label for="reason">Motif de rejet (obligatoire)</label>
              <select id="reason" class="select" [(ngModel)]="preset" (ngModelChange)="reason = $event">
                <option value="">— Motif prédéfini —</option>
                @for (r of reasons(); track r) {
                  <option [value]="r">{{ r }}</option>
                }
              </select>
              <textarea class="textarea" rows="2" maxlength="300" [(ngModel)]="reason" placeholder="Ou précise le motif…" aria-label="Motif détaillé"></textarea>
            </div>
            <button type="button" class="btn btn--danger btn--block" (click)="reject()" [disabled]="busy() || reason.trim().length < 3"><app-icon name="x" [size]="16" /> Rejeter</button>
          </div>
          <div class="row" style="justify-content: space-between; margin-top: var(--space-5)">
            <button type="button" class="btn btn--sm" (click)="move(-1)" [disabled]="index() === 0"><app-icon name="chevron-left" [size]="14" /> Précédente</button>
            <button type="button" class="btn btn--sm" (click)="move(1)" [disabled]="index() >= items()!.length - 1">Suivante <app-icon name="chevron-right" [size]="14" /></button>
          </div>
        </div>
      </div>
    }
  `,
  styles: `
    /* Raccourcis clavier inutiles sur écran tactile sans clavier. */
    @media (hover: none) {
      .kbd-hint {
        display: none;
      }
    }
    kbd {
      font-family: var(--font-mono);
      font-size: 11px;
      padding: 1px 5px;
      border: 1px solid var(--border-strong);
      border-radius: 4px;
      background: var(--surface-2);
    }
    .mod {
      display: grid;
      gap: var(--space-5);
      grid-template-columns: 1fr;
    }
    @media (min-width: 900px) {
      .mod {
        grid-template-columns: minmax(280px, 400px) 1fr;
      }
    }
    .mod__main {
      margin: 0;
    }
    .mod__main img {
      width: 100%;
      height: auto;
      aspect-ratio: 3/4;
      object-fit: cover;
      border-radius: var(--radius);
      border: 1px solid var(--border-strong);
      background: repeating-conic-gradient(#222 0 25%, #1a1a1a 0 50%) 0 0 / 20px 20px;
    }
    .mod__side {
      background: var(--surface-1);
      border: 1px solid var(--border);
      border-radius: var(--radius);
      padding: var(--space-5);
      align-self: start;
    }
    .thumb {
      border-radius: var(--radius-sm);
      object-fit: cover;
    }
  `,
})
export class ModerationPage {
  private readonly api = inject(Api);
  private readonly toast = inject(ToastService);

  protected readonly tab = signal<'images' | 'phrases'>(
    inject(ActivatedRoute).snapshot.queryParamMap.get('onglet') === 'phrases' ? 'phrases' : 'images',
  );
  protected readonly items = signal<ModerationItem[] | null>(null);
  protected readonly reasons = signal<string[]>([]);
  protected readonly index = signal(0);
  protected readonly busy = signal(false);
  protected readonly current = computed(() => this.items()?.[this.index()] ?? null);
  protected reason = '';
  protected preset = '';

  constructor() {
    void this.load();
  }

  private async load() {
    try {
      const r = await this.api.get<{ reasons: string[]; items: ModerationItem[] }>('/admin/moderation');
      this.items.set(r.items);
      this.reasons.set(r.reasons);
      this.index.set(Math.min(this.index(), Math.max(0, r.items.length - 1)));
    } catch (err) {
      this.toast.error((err as ApiError).message, () => void this.load());
    }
  }

  protected move(d: number) {
    const n = this.items()?.length ?? 0;
    this.index.set(Math.max(0, Math.min(n - 1, this.index() + d)));
    this.reason = '';
    this.preset = '';
  }

  protected async approve() {
    const it = this.current();
    if (!it || this.busy()) return;
    this.busy.set(true);
    try {
      await this.api.post(`/admin/moderation/${it.id}/approve`);
      this.toast.success(`Image de ${it.member.displayName} approuvée.`);
      await this.load();
    } catch (err) {
      this.toast.error((err as ApiError).message);
    } finally {
      this.busy.set(false);
    }
  }

  protected async reject() {
    const it = this.current();
    if (!it || this.busy() || this.reason.trim().length < 3) return;
    this.busy.set(true);
    try {
      await this.api.post(`/admin/moderation/${it.id}/reject`, { reason: this.reason.trim() });
      this.toast.success(`Image de ${it.member.displayName} rejetée. Le membre verra le motif.`);
      this.reason = '';
      this.preset = '';
      await this.load();
    } catch (err) {
      this.toast.error((err as ApiError).message);
    } finally {
      this.busy.set(false);
    }
  }

  @HostListener('document:keydown', ['$event'])
  onKey(e: KeyboardEvent) {
    if (this.tab() !== 'images') return;
    const tag = (e.target as HTMLElement).tagName;
    if (['INPUT', 'TEXTAREA', 'SELECT'].includes(tag) || e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.key === 'a' || e.key === 'A') void this.approve();
    else if (e.key === 'r' || e.key === 'R') document.getElementById('reason')?.focus();
    else if (e.key === 'j' || e.key === 'ArrowRight') this.move(1);
    else if (e.key === 'k' || e.key === 'ArrowLeft') this.move(-1);
    else return;
    e.preventDefault();
  }
}
