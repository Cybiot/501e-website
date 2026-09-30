import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Api, ApiError } from '../core/api.service';
import { AuthService } from '../core/auth.service';
import { ToastService } from '../core/toast.service';
import { IconComponent } from '../shared/icon.component';
import { InsigniaComponent } from '../shared/insignia.component';

/**
 * Modale de consentement RGPD : affichée à la première connexion d'un membre
 * (et à chaque nouvelle version du texte). Consentements granulaires.
 */
@Component({
  selector: 'app-consent-modal',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, RouterLink, IconComponent, InsigniaComponent],
  template: `
    <div class="modal-backdrop">
      <div class="modal modal--wide" role="dialog" aria-modal="true" aria-labelledby="consent-title">
        <div class="row" style="margin-bottom: var(--space-4)">
          <app-insignia [size]="40" label="" />
          <div>
            <p class="eyebrow" style="margin:0">Bienvenue dans l'espace membre</p>
            <h2 id="consent-title" style="margin:0">Tes données, tes choix</h2>
          </div>
        </div>
        <div class="consent-text">
          @for (line of lines(); track $index) {
            <p>{{ line }}</p>
          }
        </div>

        <fieldset class="stack">
          <legend class="label">Options facultatives (modifiables à tout moment dans « Mon profil »)</legend>
          <label class="check">
            <input type="checkbox" [(ngModel)]="publicProfile" name="publicProfile" />
            <div>
              <strong>Profil visible sur le site public</strong>
              <span>Ta fiche (pseudo, grade, médailles, phrase) est visible des visiteurs. Sinon, seuls les membres connectés la voient.</span>
            </div>
          </label>
          <label class="check">
            <input type="checkbox" [(ngModel)]="customImage" name="customImage" />
            <div>
              <strong>Image personnalisée</strong>
              <span>Autoriser l'envoi et l'affichage d'une image, après validation par un admin.</span>
            </div>
          </label>
          <label class="check">
            <input type="checkbox" [(ngModel)]="location" name="location" />
            <div>
              <strong>Localisation sur la carte des membres</strong>
              <span>Jusqu'à 2 villes (jamais d'adresse), visibles uniquement des membres connectés.</span>
            </div>
          </label>
        </fieldset>

        <p class="small muted" style="margin-top: var(--space-4)">
          Version {{ auth.me().consent?.version }} ·
          <a routerLink="/confidentialite" target="_blank">Politique de confidentialité</a>
        </p>
        <div class="modal__actions">
          <button type="button" class="btn btn--ghost" (click)="auth.logout()">Me déconnecter</button>
          <button type="button" class="btn btn--primary" (click)="accept()" [disabled]="saving()">
            @if (saving()) {
              <app-icon name="loader" class="spin" [size]="16" />
            }
            Valider et accéder à l'espace membre
          </button>
        </div>
      </div>
    </div>
  `,
  styles: `
    .consent-text {
      background: var(--bg);
      border: 1px solid var(--border);
      border-radius: var(--radius-sm);
      padding: var(--space-4);
      margin-bottom: var(--space-5);
      max-height: 220px;
      overflow-y: auto;
      font-size: var(--fs-sm);
      color: var(--text-muted);
    }
    .consent-text p:last-child {
      margin-bottom: 0;
    }
    fieldset {
      border: 0;
      padding: 0;
      margin: 0;
    }
    legend {
      margin-bottom: var(--space-3);
    }
  `,
})
export class ConsentModalComponent {
  protected readonly auth = inject(AuthService);
  private readonly api = inject(Api);
  private readonly toast = inject(ToastService);

  // [HYPOTHÈSE §15.14] profil public coché par défaut, avec information claire ; le reste en opt-in.
  protected publicProfile = true;
  protected customImage = false;
  protected location = false;
  protected readonly saving = signal(false);
  protected readonly lines = () => (this.auth.me().consent?.text ?? '').split('\n');

  async accept() {
    this.saving.set(true);
    try {
      await this.api.post('/me/consent', {
        publicProfile: this.publicProfile,
        customImage: this.customImage,
        location: this.location,
      });
      await this.auth.load(true);
      this.toast.success('Merci ! Bienvenue dans l’espace membre.');
    } catch (err) {
      this.toast.error((err as ApiError).message, () => this.accept());
    } finally {
      this.saving.set(false);
    }
  }
}
