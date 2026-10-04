import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Api, ApiError } from '../../core/api.service';
import {
  AdminAward,
  AdminMedal,
  AdminPromotion,
  AnnouncementHistory,
  AnnouncementPreview,
  MEDAL_TIERS,
  MedalTier,
  MemberSearchResult,
  TIER_LABELS,
  medalLabel,
} from '../../core/models';
import { ToastService } from '../../core/toast.service';
import { AvatarComponent } from '../../shared/avatar.component';
import { IconComponent } from '../../shared/icon.component';
import { newIdempotencyKey } from './labels';

const REASON_MAX = 200;

@Component({
  selector: 'app-awards-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DatePipe, FormsModule, RouterLink, IconComponent, AvatarComponent],
  templateUrl: './awards.page.html',
  styleUrl: './admin.css',
})
export class AwardsPage {
  private readonly api = inject(Api);
  private readonly toast = inject(ToastService);

  protected readonly medals = signal<AdminMedal[]>([]);
  protected readonly pending = signal<AdminAward[] | null>(null);
  protected readonly pendingPromotions = signal<AdminPromotion[] | null>(null);
  protected readonly history = signal<AnnouncementHistory[]>([]);

  // Formulaire
  protected memberQuery = '';
  protected readonly memberResults = signal<MemberSearchResult[]>([]);
  protected readonly selectedMember = signal<MemberSearchResult | null>(null);
  protected readonly selectedMedalId = signal<string | null>(null);
  /** Palier choisi (médailles à paliers) ; null : image de base. */
  protected readonly selectedTier = signal<MedalTier | null>(null);
  protected readonly reason = signal('');
  protected readonly submitting = signal(false);
  protected readonly duplicate = signal<string | null>(null);
  private idempotencyKey = newIdempotencyKey();
  private searchTimer?: ReturnType<typeof setTimeout>;
  protected readonly reasonMax = REASON_MAX;
  protected readonly tiers = MEDAL_TIERS;
  protected readonly tierLabels = TIER_LABELS;
  protected readonly label = medalLabel;

  // Annonce
  protected readonly preview = signal<AnnouncementPreview | null>(null);
  protected readonly announcing = signal(false);

  /** Total à annoncer (médailles + promotions). */
  protected readonly pendingCount = computed(() => (this.pending()?.length ?? 0) + (this.pendingPromotions()?.length ?? 0));
  protected readonly activeMedals = computed(() => this.medals().filter((m) => m.isActive));
  protected readonly selectedMedal = computed(() => this.medals().find((m) => m.id === this.selectedMedalId()) ?? null);
  protected readonly alreadyHeld = computed(() => {
    const m = this.selectedMember();
    const id = this.selectedMedalId();
    return m && id ? m.medalIds.filter((x) => x === id).length : 0;
  });
  protected readonly canSubmit = computed(
    () => !!this.selectedMember() && !!this.selectedMedalId() && this.reason().trim().length >= 3 && !this.submitting(),
  );

  constructor() {
    void this.refresh();
    this.api.get<{ items: AdminMedal[] }>('/admin/medals').then((r) => this.medals.set(r.items)).catch(() => undefined);
  }

  protected async refresh() {
    try {
      const [pending, promotions, history] = await Promise.all([
        this.api.get<AdminAward[]>('/admin/awards/pending'),
        this.api.get<AdminPromotion[]>('/admin/promotions/pending'),
        this.api.get<AnnouncementHistory[]>('/admin/announcements'),
      ]);
      this.pending.set(pending);
      this.pendingPromotions.set(promotions);
      this.history.set(history);
    } catch (err) {
      this.toast.error((err as ApiError).message, () => void this.refresh());
    }
  }

  protected onMemberInput(q: string) {
    this.selectedMember.set(null);
    clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(async () => {
      try {
        this.memberResults.set(await this.api.get<MemberSearchResult[]>('/admin/members/search', { q }));
      } catch {
        this.memberResults.set([]);
      }
    }, 250);
  }

  protected pickMember(m: MemberSearchResult) {
    this.selectedMember.set(m);
    this.memberQuery = m.displayName;
    this.memberResults.set([]);
    this.resetKey();
  }

  protected pickMedal(id: string) {
    this.selectedMedalId.set(id);
    this.selectedTier.set(null);
    this.resetKey();
  }

  /** Nouvelle clé d'idempotence dès que le contenu du formulaire change. */
  protected resetKey() {
    this.idempotencyKey = newIdempotencyKey();
    this.duplicate.set(null);
  }

  protected async award(confirmDuplicate = false) {
    if (!this.canSubmit() && !confirmDuplicate) return;
    this.submitting.set(true);
    const member = this.selectedMember()!;
    try {
      await this.api.post<AdminAward>('/admin/awards', {
        userId: member.id,
        medalId: this.selectedMedalId(),
        reason: this.reason().trim(),
        tier: this.selectedTier(),
        idempotencyKey: this.idempotencyKey,
        confirmDuplicate: confirmDuplicate || undefined,
      });
      this.toast.success(`${this.label({ name: this.selectedMedal()?.name ?? '', tier: this.selectedTier() })} attribuée à ${member.displayName}.`);
      this.selectedMember.set(null);
      this.memberQuery = '';
      this.selectedMedalId.set(null);
      this.selectedTier.set(null);
      this.reason.set('');
      this.resetKey();
      await this.refresh();
    } catch (err) {
      const e = err as ApiError;
      if (e.code === 'CONFIRM_DUPLICATE') this.duplicate.set(e.message);
      else this.toast.error(e.message);
    } finally {
      this.submitting.set(false);
    }
  }

  protected async revoke(a: AdminAward) {
    if (!confirm(`Supprimer l'attribution de « ${a.medal.name} » à ${a.member.displayName} ? Elle n'a pas encore été annoncée.`)) return;
    try {
      await this.api.delete(`/admin/awards/${a.id}`);
      this.toast.success('Attribution supprimée.');
      await this.refresh();
    } catch (err) {
      this.toast.error((err as ApiError).message, () => void this.revoke(a));
    }
  }

  // --- Désattribution d'une médaille déjà annoncée ---

  protected unawardQuery = '';
  protected readonly unawardResults = signal<MemberSearchResult[]>([]);
  protected readonly unawardMember = signal<MemberSearchResult | null>(null);
  /** Médailles officielles du membre choisi (null : chargement). */
  protected readonly unawardAwards = signal<AdminAward[] | null>(null);
  private unawardTimer?: ReturnType<typeof setTimeout>;

  protected onUnawardInput(q: string) {
    this.unawardMember.set(null);
    this.unawardAwards.set(null);
    clearTimeout(this.unawardTimer);
    this.unawardTimer = setTimeout(async () => {
      try {
        this.unawardResults.set(await this.api.get<MemberSearchResult[]>('/admin/members/search', { q }));
      } catch {
        this.unawardResults.set([]);
      }
    }, 250);
  }

  protected async pickUnawardMember(m: MemberSearchResult) {
    this.unawardMember.set(m);
    this.unawardQuery = m.displayName;
    this.unawardResults.set([]);
    await this.loadUnawardAwards(m);
  }

  private async loadUnawardAwards(m: MemberSearchResult) {
    this.unawardAwards.set(null);
    try {
      const all = await this.api.get<AdminAward[]>('/admin/awards', { userId: m.id });
      this.unawardAwards.set(all.filter((a) => a.announcedAt && !a.revokedAt));
    } catch (err) {
      this.toast.error((err as ApiError).message);
    }
  }

  protected async unaward(a: AdminAward) {
    if (!confirm(`Désattribuer « ${this.label(a.medal)} » à ${a.member.displayName} ?`)) return;
    try {
      await this.api.delete(`/admin/awards/${a.id}`);
      this.toast.success(`Médaille désattribuée à ${a.member.displayName}.`);
      this.unawardAwards.update((list) => list?.filter((x) => x.id !== a.id) ?? list);
    } catch (err) {
      this.toast.error((err as ApiError).message, () => void this.unaward(a));
    }
  }

  /** Retire une promotion de la file : elle ne sera pas annoncée (le grade reste celui de Discord). */
  protected async dismissPromotion(p: AdminPromotion) {
    if (!confirm(`Ne pas annoncer la promotion de ${p.member.displayName} (${p.toRank.name}) ?`)) return;
    try {
      await this.api.delete(`/admin/promotions/${p.id}`);
      this.toast.success('Promotion retirée de l’annonce.');
      await this.refresh();
    } catch (err) {
      this.toast.error((err as ApiError).message, () => void this.dismissPromotion(p));
    }
  }

  protected async openPreview() {
    try {
      this.preview.set(await this.api.get<AnnouncementPreview>('/admin/announcements/preview'));
    } catch (err) {
      this.toast.error((err as ApiError).message);
    }
  }

  /** Aperçu : remplace les mentions <@id> par @pseudo. */
  protected render(text: string | undefined) {
    const names = this.preview()?.names ?? {};
    return (text ?? '')
      .replace(/\*\*/g, '')
      .replace(/<@(\w[\w-]*)>/g, (_, id: string) => `@${names[id] ?? id}`);
  }

  protected color(c?: number) {
    return `#${(c ?? 0xc9a24b).toString(16).padStart(6, '0')}`;
  }

  protected async announce() {
    this.announcing.set(true);
    try {
      const res = await this.api.post<{ awardsCount: number; promotionsCount: number; partial: boolean }>('/admin/announcements', {});
      this.preview.set(null);
      const done = `${res.awardsCount} décoration(s), ${res.promotionsCount} promotion(s)`;
      if (res.partial) this.toast.show('warning', `Annonce partielle : ${done} publiées, le reste demeure à annoncer.`);
      else this.toast.success(`Annonce publiée sur Discord (${done}).`);
      await this.refresh();
    } catch (err) {
      this.toast.error((err as ApiError).message, () => void this.announce());
    } finally {
      this.announcing.set(false);
    }
  }
}
