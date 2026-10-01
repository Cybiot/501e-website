import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Api, ApiError } from '../../core/api.service';
import { AdminMedal, DiscordRole, MEDAL_TIERS, MedalTier, MemberCard, TIER_LABELS } from '../../core/models';
import { ToastService } from '../../core/toast.service';
import { DogTagComponent } from '../../shared/dog-tag.component';
import { IconComponent } from '../../shared/icon.component';

interface MedalForm {
  id: string | null;
  name: string;
  description: string;
  category: string;
  order: number;
  repeatable: boolean;
  isActive: boolean;
  roleMode: 'none' | 'existing' | 'create' | 'keep';
  discordRoleId: string;
  roleColor: string;
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
  roleMode: 'create',
  discordRoleId: '',
  roleColor: '#c9a24b',
  currentImageUrl: null,
  currentTierImages: null,
  removeTiers: false,
});

@Component({
  selector: 'app-catalog-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, RouterLink, IconComponent, DogTagComponent],
  templateUrl: './catalog.page.html',
  styleUrl: './admin.css',
})
export class CatalogPage {
  private readonly api = inject(Api);
  private readonly toast = inject(ToastService);

  protected readonly medals = signal<AdminMedal[] | null>(null);
  protected readonly categories = signal<string[]>([]);
  protected readonly roles = signal<DiscordRole[]>([]);
  protected readonly editing = signal<MedalForm | null>(null);
  protected readonly imageFile = signal<File | null>(null);
  protected readonly imagePreview = signal<string | null>(null);
  /** Images de palier envoyées (bronze, argent, or) et leurs aperçus. */
  protected readonly tierFiles = signal<Partial<Record<MedalTier, File>>>({});
  protected readonly tierPreviews = signal<Partial<Record<MedalTier, string>>>({});
  protected readonly tiers = MEDAL_TIERS;
  protected readonly tierLabels = TIER_LABELS;
  protected readonly saving = signal(false);

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

  private async loadRoles() {
    if (this.roles().length) return;
    try {
      this.roles.set(await this.api.get<DiscordRole[]>('/admin/discord/roles'));
    } catch (err) {
      this.toast.error((err as ApiError).message);
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
    void this.loadRoles();
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
      roleMode: 'keep',
      discordRoleId: m.discordRoleId ?? '',
      roleColor: '#c9a24b',
      currentImageUrl: m.imageUrl,
      currentTierImages: m.tierImages,
      removeTiers: false,
    });
    void this.loadRoles();
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

  protected roleName(id: string | null) {
    if (!id) return 'Aucun';
    return this.roles().find((r) => r.id === id)?.name ?? id;
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
    if (f.roleMode !== 'keep') {
      form.append('roleMode', f.roleMode);
      if (f.roleMode === 'existing') form.append('discordRoleId', f.discordRoleId);
      if (f.roleMode === 'create') form.append('roleColor', f.roleColor);
    }
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
      this.roles.set([]);
      await this.load();
    } catch (err) {
      this.toast.error((err as ApiError).message);
    } finally {
      this.saving.set(false);
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
