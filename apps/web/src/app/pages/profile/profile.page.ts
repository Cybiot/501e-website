import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Api, ApiError } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import { MemberCard, MyProfile, medalLabel } from '../../core/models';
import { SeoService } from '../../core/seo.service';
import { ToastService } from '../../core/toast.service';
import { AvatarComponent } from '../../shared/avatar.component';
import { DogTagComponent } from '../../shared/dog-tag.component';
import { IconComponent } from '../../shared/icon.component';
import { ImageCropperComponent } from '../../shared/image-cropper.component';

const TAGLINE_MAX = 140;

@Component({
  selector: 'app-profile-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DatePipe, FormsModule, RouterLink, IconComponent, AvatarComponent, DogTagComponent, ImageCropperComponent],
  templateUrl: './profile.page.html',
  styleUrl: './profile.page.css',
})
export class ProfilePage {
  private readonly api = inject(Api);
  private readonly toast = inject(ToastService);
  protected readonly auth = inject(AuthService);

  protected readonly profile = signal<MyProfile | null>(null);
  protected readonly label = medalLabel;
  protected readonly error = signal<string | null>(null);
  protected readonly tagline = signal('');
  protected readonly savingTagline = signal(false);
  protected readonly uploading = signal(false);
  protected readonly showCropper = signal(false);
  protected readonly confirmDelete = signal(false);
  protected deleteConfirmText = '';
  protected readonly deleting = signal(false);
  protected readonly taglineMax = TAGLINE_MAX;

  /** Aperçu en direct de la carte « dog tag » avec la phrase en cours d'édition. */
  protected readonly preview = computed<MemberCard | null>(() => {
    const p = this.profile();
    return p ? { ...p, tagline: this.tagline().trim() || null } : null;
  });
  protected readonly taglineDirty = computed(() => (this.profile()?.tagline ?? '') !== this.tagline().trim());

  constructor() {
    inject(SeoService).set({ title: 'Mon profil', path: '/profil', noindex: true });
    // Chargement (et rechargement automatique dès que la modale de consentement est validée).
    effect(() => {
      if (this.auth.consentRequired()) return;
      untracked(() => void this.load());
    });
  }

  protected async load() {
    this.error.set(null);
    try {
      const p = await this.api.get<MyProfile>('/me/profile');
      this.profile.set(p);
      this.tagline.set(p.tagline ?? '');
    } catch (err) {
      // Consentement en attente : la modale est affichée, on patiente sans message d'erreur.
      if ((err as ApiError).code !== 'CONSENT_REQUIRED') this.error.set((err as ApiError).message);
    }
  }

  protected async saveTagline() {
    this.savingTagline.set(true);
    try {
      await this.api.patch('/me/profile', { tagline: this.tagline().trim() || null });
      this.toast.success('Phrase enregistrée.');
      await this.load();
    } catch (err) {
      this.toast.error((err as ApiError).message);
    } finally {
      this.savingTagline.set(false);
    }
  }

  protected async setFlag(field: 'publicProfileEnabled' | 'consentCustomImage' | 'consentLocation', value: boolean) {
    const p = this.profile();
    if (!p) return;
    const warnings: Record<string, string> = {
      consentCustomImage: 'Retirer ce consentement supprime immédiatement ton image personnalisée. Continuer ?',
      consentLocation: 'Retirer ce consentement supprime immédiatement tes villes de la carte. Continuer ?',
    };
    if (!value && warnings[field] && !confirm(warnings[field])) {
      await this.load(); // remet l'interrupteur dans son état
      return;
    }
    try {
      await this.api.patch('/me/profile', { [field]: value });
      this.toast.success('Préférence enregistrée.');
      await this.load();
    } catch (err) {
      this.toast.error((err as ApiError).message);
      await this.load();
    }
  }

  protected async upload(blob: Blob) {
    this.uploading.set(true);
    try {
      const form = new FormData();
      form.append('image', blob, 'portrait.jpg');
      await this.api.upload('/me/image', form);
      this.showCropper.set(false);
      this.toast.success('Image envoyée : elle sera visible après validation par un admin.');
      await this.load();
    } catch (err) {
      this.toast.error((err as ApiError).message, () => void this.upload(blob));
    } finally {
      this.uploading.set(false);
    }
  }

  protected async removeImage() {
    if (!confirm('Supprimer ton image personnalisée et revenir à ton avatar Discord ?')) return;
    try {
      await this.api.delete('/me/image');
      this.toast.success('Image supprimée.');
      await this.load();
    } catch (err) {
      this.toast.error((err as ApiError).message);
    }
  }

  protected async removeCity(id: string) {
    try {
      await this.api.delete(`/me/locations/${id}`);
      this.toast.success('Ville supprimée.');
      await this.load();
    } catch (err) {
      this.toast.error((err as ApiError).message);
    }
  }

  protected async exportData() {
    try {
      const data = await this.api.get<unknown>('/me/export');
      const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = 'mes-donnees-501e.json';
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      this.toast.error((err as ApiError).message);
    }
  }

  protected async deleteAccount() {
    this.deleting.set(true);
    try {
      await this.api.delete('/me', { confirm: 'SUPPRIMER' });
      this.toast.success('Ton compte et tes données ont été supprimés.');
      this.auth.me.set({ user: null, status: 'visitor' });
      location.assign('/');
    } catch (err) {
      this.toast.error((err as ApiError).message);
    } finally {
      this.deleting.set(false);
    }
  }
}
