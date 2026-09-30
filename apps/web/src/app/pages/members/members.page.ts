import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { Api } from '../../core/api.service';
import { t, TPipe } from '../../core/i18n';
import { Filters, MemberCard, Page } from '../../core/models';
import { SeoService } from '../../core/seo.service';
import { BreadcrumbComponent } from '../../shared/breadcrumb.component';
import { DogTagComponent } from '../../shared/dog-tag.component';
import { IconComponent } from '../../shared/icon.component';

type Sort = 'rank' | 'seniority' | 'alpha';

/**
 * Liste des membres. Les filtres vivent dans l'URL (?q=&rank=&…) : liens partageables,
 * rendu serveur de chaque combinaison, bouton « précédent » du navigateur cohérent.
 */
@Component({
  selector: 'app-members-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, RouterLink, TPipe, IconComponent, DogTagComponent, BreadcrumbComponent],
  templateUrl: './members.page.html',
  styles: `
    .filters {
      display: grid;
      gap: var(--space-3);
      grid-template-columns: 1fr;
      padding: var(--space-4);
      background: var(--surface-1);
      border: 1px solid var(--border);
      border-radius: var(--radius);
      margin-bottom: var(--space-5);
    }
    @media (min-width: 720px) {
      .filters {
        grid-template-columns: 2fr repeat(4, 1fr);
      }
    }
    .toolbar {
      margin-bottom: var(--space-4);
    }
    .group-title {
      grid-column: 1 / -1;
      display: flex;
      align-items: center;
      gap: var(--space-3);
      font-size: var(--fs-lg);
      margin: var(--space-4) 0 0;
      color: var(--gold-text);
    }
    .group-title::after {
      content: '';
      flex: 1;
      height: 1px;
      background: var(--border);
    }
    .group-title:first-child {
      margin-top: 0;
    }
  `,
})
export class MembersPage {
  private readonly api = inject(Api);
  private readonly router = inject(Router);

  // Paramètres d'URL (liaison automatique des query params)
  readonly q = input<string>();
  readonly rank = input<string>();
  readonly responsibility = input<string>();
  readonly medal = input<string>();
  readonly sort = input<Sort>();
  readonly page = input<string>();

  protected readonly filters = signal<Filters | null>(null);
  protected readonly result = signal<Page<MemberCard> | null>(null);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly grouped = signal(true);
  protected search = '';

  protected readonly currentSort = computed<Sort>(() => this.sort() ?? 'rank');
  protected readonly currentPage = computed(() => Math.max(1, Number(this.page()) || 1));
  protected readonly hasFilters = computed(() => Boolean(this.q() || this.rank() || this.responsibility() || this.medal()));

  /** Insère des en-têtes de groupe (par grade) quand le tri est « par grade ». */
  protected readonly rows = computed(() => {
    const items = this.result()?.items ?? [];
    const groups: { title: string | null; members: MemberCard[] }[] = [];
    const group = this.grouped() && this.currentSort() === 'rank';
    for (const m of items) {
      const title = group ? (m.rank?.name ?? t('members.noRank')) : null;
      const last = groups[groups.length - 1];
      if (last && last.title === title) last.members.push(m);
      else groups.push({ title, members: [m] });
    }
    return groups;
  });

  private searchTimer?: ReturnType<typeof setTimeout>;

  constructor() {
    inject(SeoService).set({
      title: t('members.title'),
      description: 'Les membres de la communauté 501st PIR : grades, décorations et responsabilités.',
      path: '/membres',
    });
    this.api.get<Filters>('/filters').then((f) => this.filters.set(f)).catch(() => undefined);

    effect(() => {
      const params = {
        q: this.q(),
        rank: this.rank(),
        responsibility: this.responsibility(),
        medal: this.medal(),
        sort: this.currentSort(),
        page: this.currentPage(),
        pageSize: 24,
      };
      untracked(() => {
        this.search = params.q ?? '';
        void this.load(params);
      });
    });
  }

  private async load(params: Record<string, string | number | undefined>) {
    this.loading.set(true);
    this.error.set(null);
    try {
      this.result.set(await this.api.get<Page<MemberCard>>('/members', params));
    } catch (err) {
      this.error.set((err as Error).message);
    } finally {
      this.loading.set(false);
    }
  }

  protected retry() {
    void this.load({ q: this.q(), rank: this.rank(), responsibility: this.responsibility(), medal: this.medal(), sort: this.currentSort(), page: this.currentPage() });
  }

  protected setParam(key: string, value: string | number | null) {
    void this.router.navigate([], {
      queryParams: { [key]: value || null, ...(key === 'page' ? {} : { page: null }) },
      queryParamsHandling: 'merge',
      replaceUrl: key === 'q',
    });
  }

  protected onSearch(value: string) {
    clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(() => this.setParam('q', value.trim()), 300);
  }

  protected reset() {
    void this.router.navigate([], { queryParams: {} });
  }
}
