import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Api, ApiError } from '../../core/api.service';
import { AdminCompany, AdminPlatoon, AdminRank, AdminResponsibility, AppSettings, DiscordRole, RANK_BRANCHES, RankBranch, ResponsibilityKind } from '../../core/models';
import { ToastService } from '../../core/toast.service';
import { IconComponent } from '../../shared/icon.component';

interface SettingsResponse {
  discordMode: 'mock' | 'live';
  guildId: string | null;
  settings: AppSettings;
  /** Rôles « État-major » (Admin) et « 501e » (Membre), fixés par l'environnement. */
  statusRoles: { adminRoleId: string; memberRoleId: string };
  ranks: AdminRank[];
  responsibilities: AdminResponsibility[];
  companies: AdminCompany[];
}

@Component({
  selector: 'app-settings-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, IconComponent],
  templateUrl: './settings.page.html',
  styleUrl: './admin.css',
})
export class SettingsPage {
  private readonly api = inject(Api);
  private readonly toast = inject(ToastService);

  protected readonly data = signal<SettingsResponse | null>(null);
  protected readonly roles = signal<DiscordRole[]>([]);
  protected form: AppSettings | null = null;
  protected readonly saving = signal(false);
  protected readonly checks = signal<{ ok: boolean; checks: { label: string; ok: boolean; detail?: string }[] } | null>(null);
  protected readonly checking = signal(false);
  protected readonly syncing = signal(false);

  protected readonly branches = RANK_BRANCHES;
  protected newRank: { name: string; abbreviation: string; branch: RankBranch; order: number; discordRoleId: string } = {
    name: '',
    abbreviation: '',
    branch: 'enlisted',
    order: 10,
    discordRoleId: '',
  };
  protected newResp: { name: string; description: string; kind: ResponsibilityKind; order: number; discordRoleId: string; rankBranch: RankBranch | null } = {
    name: '',
    description: '',
    kind: 'pole',
    order: 0,
    discordRoleId: '',
    rankBranch: null,
  };

  /** Ligne « nouveau platoon » de chaque compagnie, par id de compagnie. */
  protected newPlatoon: Record<string, { name: string; order: number; discordRoleId: string }> = {};

  constructor() {
    void this.load();
    this.api.get<DiscordRole[]>('/admin/discord/roles').then((r) => this.roles.set(r)).catch(() => undefined);
  }

  protected async load() {
    try {
      const d = await this.api.get<SettingsResponse>('/admin/settings');
      this.data.set(d);
      this.form = structuredClone(d.settings);
      this.newPlatoon = Object.fromEntries(
        d.companies.map((c) => [c.id, { name: '', order: (c.platoons.length + 1) * 10, discordRoleId: '' }]),
      );
    } catch (err) {
      this.toast.error((err as ApiError).message, () => void this.load());
    }
  }

  protected roleName(id: string) {
    return this.roles().find((r) => r.id === id)?.name ?? id;
  }

  protected async save() {
    if (!this.form) return;
    const before = this.data()?.settings;
    if (before && before.consentVersion !== this.form.consentVersion) {
      if (!confirm('Changer la version du consentement obligera tous les membres à le valider à nouveau. Continuer ?')) return;
    }
    this.saving.set(true);
    try {
      await this.api.put('/admin/settings', this.form);
      this.toast.success('Paramètres enregistrés.');
      await this.load();
    } catch (err) {
      this.toast.error((err as ApiError).message);
    } finally {
      this.saving.set(false);
    }
  }

  protected async check() {
    this.checking.set(true);
    try {
      this.checks.set(await this.api.post('/admin/settings/check-integration'));
    } catch (err) {
      this.toast.error((err as ApiError).message);
    } finally {
      this.checking.set(false);
    }
  }

  protected async syncRoles() {
    this.syncing.set(true);
    try {
      const r = await this.api.post<{ users: number; changed: number }>('/admin/settings/sync-roles');
      this.toast.success(`Synchronisation terminée : ${r.users} comptes vérifiés, ${r.changed} statut(s) modifié(s).`);
    } catch (err) {
      this.toast.error((err as ApiError).message);
    } finally {
      this.syncing.set(false);
    }
  }

  // --- Grades -------------------------------------------------------------------------

  protected async saveRank(r: AdminRank) {
    try {
      await this.api.patch(`/admin/ranks/${r.id}`, { name: r.name, abbreviation: r.abbreviation, branch: r.branch, order: Number(r.order), discordRoleId: r.discordRoleId || null });
      this.toast.success(`Grade « ${r.name} » enregistré.`);
    } catch (err) {
      this.toast.error((err as ApiError).message);
      await this.load();
    }
  }

  protected async addRank() {
    try {
      await this.api.post('/admin/ranks', { ...this.newRank, order: Number(this.newRank.order), discordRoleId: this.newRank.discordRoleId || null });
      this.newRank = { name: '', abbreviation: '', branch: 'enlisted', order: 10, discordRoleId: '' };
      this.toast.success('Grade ajouté.');
      await this.load();
    } catch (err) {
      this.toast.error((err as ApiError).message);
    }
  }

  protected async deleteRank(r: AdminRank) {
    if (!confirm(`Supprimer le grade « ${r.name} » ? Les membres concernés n'auront plus de grade affiché.`)) return;
    try {
      await this.api.delete(`/admin/ranks/${r.id}`);
      await this.load();
    } catch (err) {
      this.toast.error((err as ApiError).message);
    }
  }

  // --- Responsabilités ------------------------------------------------------------------

  protected async saveResp(r: AdminResponsibility) {
    try {
      await this.api.patch(`/admin/responsibilities/${r.id}`, { name: r.name, description: r.description, kind: r.kind, order: Number(r.order), discordRoleId: r.discordRoleId || null, rankBranch: r.rankBranch });
      this.toast.success(`Responsabilité « ${r.name} » enregistrée.`);
    } catch (err) {
      this.toast.error((err as ApiError).message);
      await this.load();
    }
  }

  protected async addResp() {
    try {
      await this.api.post('/admin/responsibilities', { ...this.newResp, order: Number(this.newResp.order), discordRoleId: this.newResp.discordRoleId || null });
      this.newResp = { name: '', description: '', kind: 'pole', order: 0, discordRoleId: '', rankBranch: null };
      this.toast.success('Responsabilité ajoutée.');
      await this.load();
    } catch (err) {
      this.toast.error((err as ApiError).message);
    }
  }

  protected async deleteResp(r: AdminResponsibility) {
    if (!confirm(`Supprimer la responsabilité « ${r.name} » ?`)) return;
    try {
      await this.api.delete(`/admin/responsibilities/${r.id}`);
      await this.load();
    } catch (err) {
      this.toast.error((err as ApiError).message);
    }
  }

  // --- Compagnies et platoons -----------------------------------------------------------

  protected async saveCompany(c: AdminCompany) {
    try {
      await this.api.patch(`/admin/companies/${c.id}`, { discordRoleId: c.discordRoleId || null });
      this.toast.success(`Compagnie « ${c.name} » enregistrée.`);
    } catch (err) {
      this.toast.error((err as ApiError).message);
      await this.load();
    }
  }

  protected async savePlatoon(p: AdminPlatoon) {
    try {
      await this.api.patch(`/admin/platoons/${p.id}`, { name: p.name, order: Number(p.order), discordRoleId: p.discordRoleId || null });
      this.toast.success(`Platoon « ${p.name} » enregistré.`);
    } catch (err) {
      this.toast.error((err as ApiError).message);
      await this.load();
    }
  }

  protected async addPlatoon(c: AdminCompany) {
    const p = this.newPlatoon[c.id]!;
    try {
      await this.api.post(`/admin/companies/${c.id}/platoons`, { name: p.name, order: Number(p.order), discordRoleId: p.discordRoleId || null });
      this.toast.success('Platoon ajouté.');
      await this.load();
    } catch (err) {
      this.toast.error((err as ApiError).message);
    }
  }

  protected async deletePlatoon(p: AdminPlatoon) {
    if (!confirm(`Supprimer le platoon « ${p.name} » ? Ses membres resteront dans la compagnie, hors platoon.`)) return;
    try {
      await this.api.delete(`/admin/platoons/${p.id}`);
      await this.load();
    } catch (err) {
      this.toast.error((err as ApiError).message);
    }
  }
}
