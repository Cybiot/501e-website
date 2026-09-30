import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { Api, ApiError } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import { TPipe } from '../../core/i18n';
import { PublicConfig } from '../../core/models';
import { SeoService } from '../../core/seo.service';
import { ToastService } from '../../core/toast.service';
import { AvatarComponent } from '../../shared/avatar.component';
import { IconComponent } from '../../shared/icon.component';
import { InsigniaComponent } from '../../shared/insignia.component';

interface DemoAccount {
  discordId: string;
  displayName: string;
  avatarUrl: string | null;
  status: 'admin' | 'member' | 'none';
  rank: string | null;
}

const ERRORS: Record<string, string> = {
  refus: 'Tu as refusé l’autorisation sur Discord. Aucune donnée n’a été transmise.',
  discord: 'Discord ne répond pas pour le moment. Réessaie dans quelques instants.',
  session: 'La tentative de connexion a expiré. Recommence depuis ce bouton.',
};

@Component({
  selector: 'app-login-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, TPipe, IconComponent, InsigniaComponent, AvatarComponent],
  template: `
    <div class="container container--narrow login">
      <div class="card login__card">
        <app-insignia [size]="64" label="" />
        <h1>Connexion</h1>

        @if (errorMessage()) {
          <div class="alert alert--danger" role="alert">
            <app-icon name="alert-triangle" [size]="18" /><span>{{ errorMessage() }}</span>
          </div>
        }
        @if (raison() === 'membre') {
          <div class="alert alert--info"><app-icon name="lock" [size]="18" /><span>Cette page est réservée aux membres de la 501e. Connecte-toi avec Discord.</span></div>
        }
        @if (raison() === 'non-membre' || auth.isOutsider()) {
          <div class="alert alert--warning">
            <app-icon name="info" [size]="18" />
            <span>Ton compte Discord n'a pas encore le rôle membre de la 501e. <a routerLink="/rejoindre">Découvre comment nous rejoindre.</a></span>
          </div>
        }

        <p class="muted">
          La connexion se fait uniquement via Discord : le site lit ton pseudo, ton avatar et tes rôles sur le serveur de la
          communauté. Aucune adresse e-mail, aucun mot de passe.
        </p>

        @if (config()?.discordMode === 'mock') {
          <div class="demo">
            <p class="eyebrow">Mode démonstration</p>
            <p class="small muted">Discord est simulé (DISCORD_MODE=mock). Choisis un compte fictif :</p>
            <ul class="demo__list">
              @for (a of accounts(); track a.discordId) {
                <li>
                  <button type="button" class="demo__account" (click)="demoLogin(a)" [disabled]="busy()">
                    <app-avatar [src]="a.avatarUrl" [name]="a.displayName" [size]="36" [alt]="false" />
                    <span class="demo__who">
                      <strong>{{ a.displayName }}</strong>
                      <small class="muted">{{ a.rank ?? 'Sans grade' }}</small>
                    </span>
                    <span class="badge" [class.badge--gold]="a.status === 'admin'" [class.badge--olive]="a.status === 'member'">
                      {{ a.status === 'admin' ? 'Admin' : a.status === 'member' ? 'Membre' : 'Non-membre' }}
                    </span>
                  </button>
                </li>
              } @empty {
                <li class="small muted">Aucun compte de démonstration : lance « npm run db:seed ».</li>
              }
            </ul>
          </div>
        } @else {
          <a class="btn btn--discord btn--lg btn--block" [href]="auth.loginUrl(redirect() ?? '/')">
            <app-icon name="log-in" [size]="18" /> {{ 'nav.login' | t }}
          </a>
        }
        <p class="small muted" style="margin-top: var(--space-4)">
          En te connectant, tu acceptes notre <a routerLink="/confidentialite">politique de confidentialité</a>.
        </p>
      </div>
    </div>
  `,
  styles: `
    .login {
      padding-block: var(--space-8);
    }
    .login__card {
      max-width: 520px;
      margin: 0 auto;
      padding: var(--space-7) var(--space-6);
      text-align: center;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: var(--space-4);
    }
    .login__card h1 {
      margin: 0;
    }
    .login__card .alert {
      text-align: left;
      width: 100%;
    }
    .demo {
      width: 100%;
      text-align: left;
    }
    .demo__list {
      list-style: none;
      padding: 0;
      margin: 0;
      display: grid;
      gap: var(--space-2);
      max-height: 360px;
      overflow-y: auto;
    }
    .demo__account {
      width: 100%;
      display: flex;
      align-items: center;
      gap: var(--space-3);
      padding: var(--space-2) var(--space-3);
      border: 1px solid var(--border);
      border-radius: var(--radius-sm);
      background: var(--bg);
      cursor: pointer;
      text-align: left;
    }
    .demo__account:hover {
      border-color: var(--olive);
    }
    .demo__who {
      flex: 1;
      display: flex;
      flex-direction: column;
      line-height: 1.3;
    }
  `,
})
export class LoginPage {
  protected readonly auth = inject(AuthService);
  private readonly api = inject(Api);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);

  readonly erreur = input<string>();
  readonly raison = input<string>();
  readonly redirect = input<string>();

  protected readonly config = signal<PublicConfig | null>(null);
  protected readonly accounts = signal<DemoAccount[]>([]);
  protected readonly busy = signal(false);
  protected readonly errorMessage = computed(() => (this.erreur() ? (ERRORS[this.erreur()!] ?? ERRORS['discord']) : null));

  constructor() {
    inject(SeoService).set({ title: 'Connexion', path: '/connexion', noindex: true });
    this.api.get<PublicConfig>('/config').then((c) => {
      this.config.set(c);
      if (c.discordMode === 'mock') {
        this.api.get<DemoAccount[]>('/auth/demo/accounts').then((a) => this.accounts.set(a)).catch(() => undefined);
      }
    });
  }

  async demoLogin(a: DemoAccount) {
    this.busy.set(true);
    try {
      const res = await this.api.post<{ redirect: string }>('/auth/demo/login', { discordId: a.discordId, redirect: this.redirect() });
      await this.auth.load(true);
      await this.router.navigateByUrl(res.redirect);
    } catch (err) {
      this.toast.error((err as ApiError).message);
    } finally {
      this.busy.set(false);
    }
  }
}
