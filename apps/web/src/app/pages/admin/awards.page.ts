import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Api, ApiError } from '../../core/api.service';
import {
  AdminAward,
  AdminMedal,
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
      const [pending, history] = await Promise.all([
        this.api.get<AdminAward[]>('/admin/awards/pending'),
        this.api.get<AnnouncementHistory[]>('/admin/announcements'),
      ]);
      this.pending.set(pending);
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
      this.toast.success(`${this.label({ name: this.selectedMedal()?.name ?? '', tier: this.selectedTier() })} attribuée à ${member.displayName}. Rôle Discord ajouté.`);
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
      else if (e.code === 'DISCORD_ERROR') this.toast.error(e.message, () => void this.award(confirmDuplicate));
      else this.toast.error(e.message);
    } finally {
      this.submitting.set(false);
    }
  }

  protected async revoke(a: AdminAward) {
    if (!confirm(`Retirer « ${a.medal.name} » à ${a.member.displayName} ? Le rôle Discord sera retiré s'il n'en possède pas d'autre exemplaire.`)) return;
    try {
      await this.api.delete(`/admin/awards/${a.id}`);
      this.toast.success('Attribution retirée.');
      await this.refresh();
    } catch (err) {
      this.toast.error((err as ApiError).message, () => void this.revoke(a));
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
      const res = await this.api.post<{ awardsCount: number; partial: boolean }>('/admin/announcements', {});
      this.preview.set(null);
      if (res.partial) this.toast.show('warning', `Annonce partielle : ${res.awardsCount} attribution(s) publiées, les autres restent à annoncer.`);
      else this.toast.success(`Annonce publiée sur Discord (${res.awardsCount} décoration(s)).`);
      await this.refresh();
    } catch (err) {
      this.toast.error((err as ApiError).message, () => void this.announce());
    } finally {
      this.announcing.set(false);
    }
  }
}
