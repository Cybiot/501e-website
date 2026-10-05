import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Api, ApiError } from '../../core/api.service';
import { MemberSearchResult, Rank, RankChangeResult } from '../../core/models';
import { ToastService } from '../../core/toast.service';
import { AvatarComponent } from '../../shared/avatar.component';
import { IconComponent } from '../../shared/icon.component';

/** Promotion ou rétrogradation d'un membre : le rôle de grade est changé sur Discord. */
@Component({
  selector: 'app-ranks-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, RouterLink, IconComponent, AvatarComponent],
  templateUrl: './ranks.page.html',
  styleUrl: './admin.css',
})
export class RanksPage {
  private readonly api = inject(Api);
  private readonly toast = inject(ToastService);

  /** Grades associés à un rôle Discord, du plus haut au plus bas. */
  protected readonly ranks = signal<Rank[]>([]);
  protected rankQuery = '';
  protected readonly rankResults = signal<MemberSearchResult[]>([]);
  protected readonly rankMember = signal<MemberSearchResult | null>(null);
  protected readonly targetRankId = signal<string | null>(null);
  protected readonly changingRank = signal(false);
  private rankTimer?: ReturnType<typeof setTimeout>;

  protected readonly targetRank = computed(() => this.ranks().find((r) => r.id === this.targetRankId()) ?? null);
  /** Sens du changement : montée, descente, ou null (rien de choisi / grade actuel). */
  protected readonly rankDirection = computed(() => {
    const m = this.rankMember();
    const t = this.targetRank();
    if (!m || !t || m.rank?.id === t.id) return null;
    return !m.rank || t.order > m.rank.order ? 'promotion' : 'demotion';
  });

  protected onRankInput(q: string) {
    this.rankMember.set(null);
    this.targetRankId.set(null);
    clearTimeout(this.rankTimer);
    this.rankTimer = setTimeout(async () => {
      try {
        this.rankResults.set(await this.api.get<MemberSearchResult[]>('/admin/members/search', { q }));
      } catch {
        this.rankResults.set([]);
      }
    }, 250);
  }

  protected pickRankMember(m: MemberSearchResult) {
    this.rankMember.set(m);
    this.rankQuery = m.displayName;
    this.rankResults.set([]);
    this.targetRankId.set(null);
  }

  protected async changeRank() {
    const m = this.rankMember();
    const t = this.targetRank();
    const direction = this.rankDirection();
    if (!m || !t || !direction || this.changingRank()) return;
    const verb = direction === 'promotion' ? 'Promouvoir' : 'Rétrograder';
    if (!confirm(`${verb} ${m.displayName} : ${m.rank?.name ?? 'sans grade'} → ${t.name} ? Son rôle de grade sera changé sur Discord.`)) return;
    this.changingRank.set(true);
    try {
      const res = await this.api.post<RankChangeResult>(`/admin/members/${m.id}/rank`, { rankId: t.id });
      this.toast.success(
        res.direction === 'promotion'
          ? `Promotion de ${m.displayName} au grade de ${t.name}. Elle rejoint la liste « À annoncer ».`
          : `Rétrogradation de ${m.displayName} au grade de ${t.name}.`,
      );
      this.rankMember.set({ ...m, rank: res.toRank });
      this.targetRankId.set(null);
    } catch (err) {
      this.toast.error((err as ApiError).message);
    } finally {
      this.changingRank.set(false);
    }
  }

  constructor() {
    this.api.get<Rank[]>('/admin/ranks').then((r) => this.ranks.set(r)).catch((err) => this.toast.error((err as ApiError).message));
  }
}
