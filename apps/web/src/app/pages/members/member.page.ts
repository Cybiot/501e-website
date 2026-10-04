import { DatePipe, isPlatformServer } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, effect, inject, input, PLATFORM_ID, RESPONSE_INIT, signal, untracked } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Api, ApiError } from '../../core/api.service';
import { t, TPipe } from '../../core/i18n';
import { MEDAL_TIERS, MedalTier, MemberDetail, TIER_LABELS, medalLabel } from '../../core/models';
import { SeoService } from '../../core/seo.service';
import { ToastService } from '../../core/toast.service';
import { BreadcrumbComponent } from '../../shared/breadcrumb.component';
import { IconComponent } from '../../shared/icon.component';
import { InsigniaComponent } from '../../shared/insignia.component';

@Component({
  selector: 'app-member-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DatePipe, RouterLink, TPipe, IconComponent, BreadcrumbComponent, InsigniaComponent],
  templateUrl: './member.page.html',
  styleUrl: './member.page.css',
})
export class MemberPage {
  private readonly api = inject(Api);
  private readonly seo = inject(SeoService);
  private readonly toast = inject(ToastService);
  private readonly responseInit = inject(RESPONSE_INIT, { optional: true });
  private readonly server = isPlatformServer(inject(PLATFORM_ID));

  readonly id = input.required<string>();
  protected readonly member = signal<MemberDetail | null>(null);
  protected readonly state = signal<'loading' | 'ready' | 'notfound' | 'error'>('loading');
  protected readonly openAward = signal<string | null>(null);

  /** Rubans : une entrée par médaille, avec toutes ses attributions, au palier le plus haut obtenu. */
  protected readonly ribbons = computed(() => {
    const m = this.member();
    if (!m) return [];
    const rank = (t: MedalTier | null | undefined) => (t ? MEDAL_TIERS.indexOf(t) : -1);
    const map = new Map<string, { medal: MemberDetail['awards'][number]['medal']; awards: MemberDetail['awards'] }>();
    for (const a of m.awards) {
      const entry = map.get(a.medal.id) ?? { medal: a.medal, awards: [] };
      if (rank(a.medal.tier) > rank(entry.medal.tier)) entry.medal = a.medal;
      entry.awards.push(a);
      map.set(a.medal.id, entry);
    }
    return [...map.values()];
  });
  protected readonly tierLabels = TIER_LABELS;
  protected readonly label = medalLabel;

  constructor() {
    effect(() => {
      const id = this.id();
      untracked(() => void this.load(id));
    });
  }

  private async load(id: string) {
    this.state.set('loading');
    try {
      const m = await this.api.get<MemberDetail>(`/members/${encodeURIComponent(id)}`);
      this.member.set(m);
      this.state.set('ready');
      this.seo.set({
        title: m.displayName,
        description: `${m.rank?.name ?? 'Membre'} de la 501e${m.awards.length ? ` · ${m.awards.length} décoration(s)` : ''}${m.tagline ? ` — « ${m.tagline} »` : ''}`,
        path: `/membres/${m.id}`,
        image: m.avatarUrl ?? undefined,
        type: 'profile',
      });
    } catch (err) {
      const status = (err as ApiError).status;
      this.state.set(status === 404 ? 'notfound' : 'error');
      if (this.server && this.responseInit) this.responseInit.status = status === 404 ? 404 : 500;
      this.seo.set({ title: t('members.title'), path: `/membres/${id}`, noindex: true });
    }
  }

  protected retry() {
    void this.load(this.id());
  }

  protected toggle(id: string) {
    this.openAward.set(this.openAward() === id ? null : id);
  }

  protected async share() {
    try {
      await navigator.clipboard.writeText(location.href);
      this.toast.success(t('members.copied'));
    } catch {
      this.toast.info(location.href);
    }
  }
}
