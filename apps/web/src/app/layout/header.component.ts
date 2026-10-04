import {
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  HostListener,
  inject,
  signal,
} from '@angular/core';
import { NavigationEnd, Router, RouterLink, RouterLinkActive } from '@angular/router';
import { filter } from 'rxjs';
import { AuthService } from '../core/auth.service';
import { TPipe } from '../core/i18n';
import { NotificationsService } from '../core/notifications.service';
import { ThemeService } from '../core/theme.service';
import { AvatarComponent } from '../shared/avatar.component';
import { IconComponent } from '../shared/icon.component';
import { InsigniaComponent } from '../shared/insignia.component';

@Component({
  selector: 'app-header',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, RouterLinkActive, TPipe, IconComponent, InsigniaComponent, AvatarComponent],
  template: `
    <header class="header" [class.header--scrolled]="scrolled()">
      <div class="container header__inner">
        <a routerLink="/" class="brand" aria-label="501e — accueil">
          <app-insignia [size]="34" label="" />
          <span class="brand__text">
            <strong>501e</strong>
            <small>Squad 44 · RP</small>
          </span>
        </a>

        <nav
          class="nav"
          [class.nav--open]="menuOpen()"
          [attr.aria-label]="'nav.mainNav' | t"
          id="main-nav"
        >
          <ul>
            @for (item of links(); track item.path) {
              <li>
                <a
                  [routerLink]="item.path"
                  routerLinkActive="active"
                  [routerLinkActiveOptions]="{ exact: item.path === '/' }"
                  ariaCurrentWhenActive="page"
                  >{{ item.label | t }}</a
                >
              </li>
            }
            @if (auth.isAdmin()) {
              <li>
                <a routerLink="/admin" routerLinkActive="active" class="nav__admin">
                  <app-icon name="shield" [size]="16" />
                  {{ 'nav.admin' | t }}
                  @if (unread() > 0) {
                    <span
                      class="count-badge"
                      [attr.aria-label]="unread() + ' notifications non lues'"
                      >{{ unread() }}</span
                    >
                  }
                </a>
              </li>
            }
          </ul>
          @if (!auth.isLoggedIn()) {
            <a class="btn btn--discord nav__login-mobile" [href]="auth.loginUrl()">
              <app-icon name="log-in" [size]="18" /> {{ 'nav.login' | t }}
            </a>
          }
        </nav>

        <div class="header__actions">
          <button
            class="btn btn--ghost btn--icon"
            type="button"
            (click)="theme.toggle()"
            [attr.aria-label]="(theme.theme() === 'nuit' ? 'nav.themeToJour' : 'nav.themeToNuit') | t"
            [attr.title]="(theme.theme() === 'nuit' ? 'nav.themeToJour' : 'nav.themeToNuit') | t"
          >
            <app-icon [name]="theme.theme() === 'nuit' ? 'sun' : 'moon'" [size]="20" />
          </button>
          @if (auth.isLoggedIn()) {
            <div class="user-menu">
              <button
                class="user-menu__trigger"
                type="button"
                [attr.aria-expanded]="userOpen()"
                aria-haspopup="menu"
                aria-controls="user-menu"
                (click)="userOpen.set(!userOpen())"
              >
                <app-avatar
                  [src]="auth.user()?.avatarUrl"
                  [name]="auth.user()?.displayName ?? ''"
                  [size]="32"
                  [alt]="false"
                />
                <span class="sr-only">{{ 'nav.userMenu' | t }}</span>
                <app-icon name="chevron-down" [size]="16" />
              </button>
              @if (userOpen()) {
                <div class="user-menu__panel" id="user-menu" role="menu">
                  <div class="user-menu__who">
                    <strong>{{ auth.user()?.displayName }}</strong>
                    <span
                      class="badge"
                      [class.badge--gold]="auth.isAdmin()"
                      [class.badge--olive]="auth.isMember() && !auth.isAdmin()"
                    >
                      {{ auth.statusLabel() }}
                    </span>
                  </div>
                  @if (auth.isMember()) {
                    <a role="menuitem" routerLink="/profil" (click)="userOpen.set(false)"
                      ><app-icon name="user" [size]="16" /> {{ 'nav.profile' | t }}</a
                    >
                    <a role="menuitem" routerLink="/carte" (click)="userOpen.set(false)"
                      ><app-icon name="map" [size]="16" /> {{ 'nav.map' | t }}</a
                    >
                  }
                  @if (auth.isAdmin()) {
                    <a role="menuitem" routerLink="/admin" (click)="userOpen.set(false)"
                      ><app-icon name="shield" [size]="16" /> {{ 'nav.admin' | t }}</a
                    >
                  }
                  <button role="menuitem" type="button" (click)="logout()">
                    <app-icon name="log-out" [size]="16" /> {{ 'nav.logout' | t }}
                  </button>
                </div>
              }
            </div>
          } @else {
            <a class="btn btn--discord btn--sm header__login" [href]="auth.loginUrl()">
              <app-icon name="log-in" [size]="16" /> <span>{{ 'nav.loginShort' | t }}</span>
            </a>
          }
          <button
            class="btn btn--ghost btn--icon burger"
            type="button"
            [attr.aria-expanded]="menuOpen()"
            aria-controls="main-nav"
            (click)="menuOpen.set(!menuOpen())"
          >
            <app-icon [name]="menuOpen() ? 'x' : 'menu'" [size]="22" />
            <span class="sr-only">{{ (menuOpen() ? 'nav.close' : 'nav.menu') | t }}</span>
          </button>
        </div>
      </div>
    </header>
  `,
  styles: `
    .header {
      position: sticky;
      top: 0;
      z-index: 100;
      height: var(--header-h);
      background: rgb(var(--bg-rgb) / 0.72);
      backdrop-filter: blur(12px);
      border-bottom: 1px solid transparent;
      transition:
        border-color var(--dur),
        background var(--dur);
    }
    .header--scrolled {
      border-bottom-color: var(--border);
      background: rgb(var(--bg-rgb) / 0.92);
    }
    .header__inner {
      height: 100%;
      display: flex;
      align-items: center;
      gap: var(--space-5);
    }
    .brand {
      display: flex;
      align-items: center;
      gap: var(--space-3);
      color: var(--text);
      text-decoration: none;
      flex-shrink: 0;
    }
    .brand__text {
      display: flex;
      flex-direction: column;
      line-height: 1.1;
    }
    .brand strong {
      font-family: var(--font-display);
      font-size: 1.05rem;
      letter-spacing: -0.01em;
    }
    .brand small {
      font-family: var(--font-mono);
      font-size: 10px;
      color: var(--text-muted);
      letter-spacing: 0.14em;
      text-transform: uppercase;
    }
    .nav ul {
      list-style: none;
      display: flex;
      gap: var(--space-1);
      margin: 0;
      padding: 0;
    }
    .nav a {
      display: inline-flex;
      align-items: center;
      gap: var(--space-2);
      padding: var(--space-2) var(--space-3);
      border-radius: var(--radius-sm);
      color: var(--text-muted);
      text-decoration: none;
      font-weight: 500;
      font-size: var(--fs-sm);
      transition:
        color var(--dur-fast),
        background var(--dur-fast);
    }
    .nav a:hover {
      color: var(--text);
      background: var(--surface-2);
    }
    .nav a.active {
      color: var(--text);
      box-shadow: inset 0 -2px 0 var(--gold);
      border-radius: 0;
    }
    .nav__admin {
      color: var(--gold-text) !important;
    }
    .nav .nav__login-mobile {
      display: none;
    }
    .header__actions {
      margin-left: auto;
      display: flex;
      align-items: center;
      gap: var(--space-2);
    }
    .burger {
      display: none;
    }
    .user-menu {
      position: relative;
    }
    .user-menu__trigger {
      display: flex;
      align-items: center;
      gap: var(--space-1);
      background: none;
      border: 1px solid transparent;
      border-radius: 999px;
      padding: 2px 6px 2px 2px;
      cursor: pointer;
      color: var(--text-muted);
    }
    .user-menu__trigger:hover {
      border-color: var(--border);
    }
    .user-menu__panel {
      position: absolute;
      right: 0;
      top: calc(100% + 8px);
      min-width: 240px;
      background: var(--surface-1);
      border: 1px solid var(--border-strong);
      border-radius: var(--radius);
      box-shadow: var(--shadow-3);
      padding: var(--space-2);
      animation: pop-in var(--dur-fast) var(--ease);
    }
    .user-menu__who {
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      gap: var(--space-2);
      padding: var(--space-3);
      border-bottom: 1px solid var(--border);
      margin-bottom: var(--space-2);
    }
    .user-menu__panel a,
    .user-menu__panel button {
      display: flex;
      align-items: center;
      gap: var(--space-3);
      width: 100%;
      padding: var(--space-2) var(--space-3);
      border-radius: var(--radius-sm);
      color: var(--text);
      text-decoration: none;
      background: none;
      border: 0;
      cursor: pointer;
      font-size: var(--fs-sm);
      text-align: left;
    }
    .user-menu__panel a:hover,
    .user-menu__panel button:hover {
      background: var(--surface-2);
    }
    @media (max-width: 960px) {
      .burger {
        display: inline-flex;
      }
      .nav {
        position: fixed;
        inset: var(--header-h) 0 auto 0;
        max-height: calc(100vh - var(--header-h));
        overflow-y: auto;
        background: var(--bg);
        border-bottom: 1px solid var(--border);
        padding: var(--space-4) var(--gutter) var(--space-6);
        display: none;
      }
      .nav--open {
        display: block;
        animation: fade-in var(--dur-fast);
      }
      .nav ul {
        flex-direction: column;
      }
      .nav a {
        padding: var(--space-3);
        font-size: var(--fs-md);
      }
      .nav a.active {
        box-shadow: inset 3px 0 0 var(--gold);
      }
      .nav .nav__login-mobile {
        display: flex;
        margin-top: var(--space-4);
        color: #fff;
        background: #5865f2;
      }
    }
    @media (max-width: 480px) {
      .header__login span,
      .brand small {
        display: none;
      }
    }
  `,
})
export class HeaderComponent {
  protected readonly auth = inject(AuthService);
  protected readonly theme = inject(ThemeService);
  private readonly router = inject(Router);
  private readonly host = inject(ElementRef);

  protected readonly menuOpen = signal(false);
  protected readonly userOpen = signal(false);
  protected readonly scrolled = signal(false);
  protected readonly unread = inject(NotificationsService).unread;

  protected readonly links = computed(() => [
    { path: '/', label: 'nav.home' },
    { path: '/communaute', label: 'nav.community' },
    { path: '/compagnies', label: 'nav.companies' },
    { path: '/membres', label: 'nav.members' },
    ...(this.auth.isMember() ? [{ path: '/carte', label: 'nav.map' }] : []),
    { path: '/rejoindre', label: 'nav.join' },
  ]);

  constructor() {
    this.router.events.pipe(filter((e) => e instanceof NavigationEnd)).subscribe(() => {
      this.menuOpen.set(false);
      this.userOpen.set(false);
    });
  }

  @HostListener('window:scroll')
  onScroll() {
    this.scrolled.set(window.scrollY > 8);
  }

  @HostListener('document:click', ['$event'])
  onDocClick(e: Event) {
    if (!this.host.nativeElement.querySelector('.user-menu')?.contains(e.target))
      this.userOpen.set(false);
  }

  @HostListener('document:keydown.escape')
  onEscape() {
    this.menuOpen.set(false);
    this.userOpen.set(false);
  }

  async logout() {
    this.userOpen.set(false);
    await this.auth.logout();
  }
}
