import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Api, ApiError } from '../../core/api.service';
import { AdminAward, AdminMedal, MEDAL_TIERS, MedalTier, MemberCard, TIER_LABELS } from '../../core/models';
import { ToastService } from '../../core/toast.service';
import { MemberPlaqueComponent } from '../../shared/member-plaque.component';
import { IconComponent } from '../../shared/icon.component';

interface MedalForm {
  id: string | null;
  name: string;
  description: string;
  category: string;
  order: number;
  repeatable: boolean;
  isActive: boolean;
  currentImageUrl: string | null;
  currentTierImages: Record<MedalTier, string> | null;
  removeTiers: boolean;
}

const empty = (): MedalForm => ({
  id: null,
  name: '',
  description: '',
  category: '',
  order: 0,
  repeatable: true,
  isActive: true,
  currentImageUrl: null,
  currentTierImages: null,
  removeTiers: false,
});

@Component({
  selector: 'app-catalog-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DatePipe, FormsModule, RouterLink, IconComponent, MemberPlaqueComponent],
  templateUrl: './catalog.page.html',
  styleUrl: './admin.css',
})
export class CatalogPage {
  private readonly api = inject(Api);
  private readonly toast = inject(ToastService);

  protected readonly medals = signal<AdminMedal[] | null>(null);
  protected readonly categories = signal<string[]>([]);
  protected readonly editing = signal<MedalForm | null>(null);
  protected readonly imageFile = signal<File | null>(null);
  protected readonly imagePreview = signal<string | null>(null);
  /** Images de palier envoyées (bronze, argent, or) et leurs aperçus. */
  protected readonly tierFiles = signal<Partial<Record<MedalTier, File>>>({});
  protected readonly tierPreviews = signal<Partial<Record<MedalTier, string>>>({});
  protected readonly tiers = MEDAL_TIERS;
  protected readonly tierLabels = TIER_LABELS;
  protected readonly saving = signal(false);
  /** Récipiendaires de la médaille ouverte (null : liste en cours de chargement). */
  protected readonly recipients = signal<{ medal: AdminMedal; items: AdminAward[] | null } | null>(null);

  /** Aperçu de la médaille telle qu'elle apparaîtra sur une carte membre. */
  protected readonly previewCard = computed<MemberCard | null>(() => {
    const f = this.editing();
    if (!f) return null;
    const img = this.imagePreview() ?? f.currentImageUrl ?? '';
    return {
      id: 'apercu',
      displayName: 'Pvt. Exemple',
      avatarUrl: null,
      rank: { id: 'r', name: 'Private First Class', abbreviation: 'Pfc.', branch: 'enlisted', order: 20 },
      tagline: 'Aperçu de la médaille sur une carte membre.',
      responsibilities: [],
      medals: img ? [{ medal: { id: 'm', name: f.name || 'Nouvelle médaille', description: f.description, imageUrl: img, category: f.category }, count: 1 }] : [],
      medalsTotal: img ? 1 : 0,
      joinedAt: null,
      company: null,
    };
  });

  constructor() {
    void this.load();
  }

  protected async load() {
    try {
      const r = await this.api.get<{ categories: string[]; items: AdminMedal[] }>('/admin/medals');
      this.medals.set(r.items);
      this.categories.set(r.categories);
    } catch (err) {
      this.toast.error((err as ApiError).message, () => void this.load());
    }
  }

  private resetFiles() {
    this.imageFile.set(null);
    this.imagePreview.set(null);
    this.tierFiles.set({});
    this.tierPreviews.set({});
  }

  protected create() {
    this.resetFiles();
    this.editing.set({ ...empty(), category: this.categories()[0] ?? '' });
  }

  protected edit(m: AdminMedal) {
    this.resetFiles();
    this.editing.set({
      id: m.id,
      name: m.name,
      description: m.description,
      category: m.category,
      order: m.order,
      repeatable: m.repeatable,
      isActive: m.isActive,
      currentImageUrl: m.imageUrl,
      currentTierImages: m.tierImages,
      removeTiers: false,
    });
  }

  protected patch(p: Partial<MedalForm>) {
    this.editing.update((f) => (f ? { ...f, ...p } : f));
  }

  protected onImage(e: Event) {
    const file = (e.target as HTMLInputElement).files?.[0] ?? null;
    if (file && file.size > 1024 * 1024) {
      this.toast.error('Image trop lourde (1 Mo maximum).');
      return;
    }
    this.imageFile.set(file);
    this.imagePreview.set(file ? URL.createObjectURL(file) : null);
  }

  protected onTierImage(tier: MedalTier, e: Event) {
    const file = (e.target as HTMLInputElement).files?.[0] ?? null;
    if (file && file.size > 1024 * 1024) {
      this.toast.error('Image trop lourde (1 Mo maximum).');
      return;
    }
    this.tierFiles.update((f) => ({ ...f, [tier]: file ?? undefined }));
    this.tierPreviews.update((p) => ({ ...p, [tier]: file ? URL.createObjectURL(file) : undefined }));
  }

  /** Image de palier affichée : nouvelle image envoyée, sinon image actuelle. */
  protected tierImage(f: MedalForm, tier: MedalTier) {
    return this.tierPreviews()[tier] ?? (f.removeTiers ? null : f.currentTierImages?.[tier]) ?? null;
  }

  protected async save() {
    const f = this.editing();
    if (!f) return;
    if (!f.id && !this.imageFile()) {
      this.toast.error("L'image de la médaille est obligatoire.");
      return;
    }
    const tierCount = this.tiers.filter((t) => this.tierImage(f, t)).length;
    if (!f.removeTiers && tierCount > 0 && tierCount < this.tiers.length) {
      this.toast.error('Une médaille à paliers a besoin des trois images (bronze, argent et or).');
      return;
    }
    const form = new FormData();
    form.append('name', f.name);
    form.append('description', f.description);
    form.append('category', f.category);
    form.append('order', String(f.order));
    form.append('repeatable', String(f.repeatable));
    form.append('isActive', String(f.isActive));
    const file = this.imageFile();
    if (file) form.append('image', file);
    if (f.removeTiers) form.append('removeTiers', 'true');
    else {
      const tierFiles = this.tierFiles();
      if (tierFiles.bronze) form.append('imageBronze', tierFiles.bronze);
      if (tierFiles.silver) form.append('imageSilver', tierFiles.silver);
      if (tierFiles.gold) form.append('imageGold', tierFiles.gold);
    }

    this.saving.set(true);
    try {
      if (f.id) await this.api.upload(`/admin/medals/${f.id}`, form, 'PATCH');
      else await this.api.upload('/admin/medals', form);
      this.toast.success(f.id ? 'Médaille mise à jour.' : 'Médaille créée.');
      this.editing.set(null);
      await this.load();
    } catch (err) {
      this.toast.error((err as ApiError).message);
    } finally {
      this.saving.set(false);
    }
  }

  protected async openRecipients(m: AdminMedal) {
    this.recipients.set({ medal: m, items: null });
    try {
      const items = await this.api.get<AdminAward[]>(`/admin/medals/${m.id}/awards`);
      if (this.recipients()?.medal.id === m.id) this.recipients.set({ medal: m, items });
    } catch (err) {
      this.recipients.set(null);
      this.toast.error((err as ApiError).message);
    }
  }

  protected async unaward(a: AdminAward) {
    if (!confirm(`Désattribuer « ${a.medal.name} » à ${a.member.displayName} ?`)) return;
    try {
      await this.api.delete(`/admin/awards/${a.id}`);
      this.toast.success(`Médaille désattribuée à ${a.member.displayName}.`);
      this.recipients.update((r) => (r && r.items ? { ...r, items: r.items.filter((x) => x.id !== a.id) } : r));
      await this.load();
    } catch (err) {
      this.toast.error((err as ApiError).message);
    }
  }

  protected async toggleActive(m: AdminMedal) {
    const form = new FormData();
    form.append('isActive', String(!m.isActive));
    try {
      await this.api.upload(`/admin/medals/${m.id}`, form, 'PATCH');
      this.toast.success(m.isActive ? 'Médaille désactivée.' : 'Médaille réactivée.');
      await this.load();
    } catch (err) {
      this.toast.error((err as ApiError).message);
    }
  }

  protected async remove(m: AdminMedal) {
    if (!confirm(`Supprimer définitivement « ${m.name} » ?`)) return;
    try {
      await this.api.delete(`/admin/medals/${m.id}`);
      this.toast.success('Médaille supprimée.');
      await this.load();
    } catch (err) {
      this.toast.error((err as ApiError).message);
    }
  }
}
