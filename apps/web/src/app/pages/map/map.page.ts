import { isPlatformBrowser } from '@angular/common';
import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  ElementRef,
  inject,
  effect,
  Injector,
  PLATFORM_ID,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import type * as Leaflet from 'leaflet';
import { Api, ApiError } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import { CitySuggestion, Location, MapMember, MyProfile, PublicConfig } from '../../core/models';
import { SeoService } from '../../core/seo.service';
import { ToastService } from '../../core/toast.service';
import { AvatarComponent, initialsOf } from '../../shared/avatar.component';
import { IconComponent } from '../../shared/icon.component';

const MAX_CITIES = 2;

@Component({
  selector: 'app-map-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, RouterLink, IconComponent, AvatarComponent],
  templateUrl: './map.page.html',
  styleUrl: './map.page.css',
})
export class MapPage {
  private readonly api = inject(Api);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);
  private readonly browser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly mapEl = viewChild<ElementRef<HTMLDivElement>>('map');
  private readonly injector = inject(Injector);

  protected readonly members = signal<MapMember[]>([]);
  protected readonly myCities = signal<Location[]>([]);
  protected readonly consentLocation = signal(false);
  protected readonly loading = signal(true);
  protected readonly panel = signal<'cities' | 'list' | null>(null);

  protected memberQuery = '';

  // Ajout de ville
  protected cityQuery = '';
  protected readonly suggestions = signal<CitySuggestion[]>([]);
  protected readonly searching = signal(false);
  protected readonly activeSuggestion = signal(-1);
  protected consentChecked = false;
  protected readonly saving = signal(false);

  /** Liste par pays (complément utile sur mobile). */
  protected readonly byCountry = computed(() => {
    const map = new Map<string, { member: MapMember; city: string }[]>();
    for (const m of this.members()) {
      for (const l of m.locations) {
        const list = map.get(l.country) ?? [];
        list.push({ member: m, city: l.cityLabel });
        map.set(l.country, list);
      }
    }
    return [...map.entries()]
      .map(([country, entries]) => ({ country, entries: entries.sort((a, b) => a.city.localeCompare(b.city)) }))
      .sort((a, b) => b.entries.length - a.entries.length);
  });

  protected readonly canAddCity = computed(() => this.myCities().length < MAX_CITIES);
  protected readonly maxCities = MAX_CITIES;

  private L?: typeof Leaflet;
  private map?: Leaflet.Map;
  private cluster?: Leaflet.MarkerClusterGroup;
  private markers = new Map<string, Leaflet.Marker[]>();
  private geocodeTimer?: ReturnType<typeof setTimeout>;

  constructor() {
    inject(SeoService).set({ title: 'Carte des membres', path: '/carte', noindex: true });
    if (!this.browser) return;
    const auth = inject(AuthService);
    let started = false;
    afterNextRender(() => {
      // La carte attend que le consentement RGPD éventuel soit validé.
      effect(
        () => {
          if (auth.consentRequired() || started) return;
          started = true;
          untracked(() => void this.init());
        },
        { injector: this.injector },
      );
    });
    inject(DestroyRef).onDestroy(() => this.map?.remove());
  }

  private async init() {
    try {
      const [config, members, profile] = await Promise.all([
        this.api.get<PublicConfig>('/config'),
        this.api.get<MapMember[]>('/map/members'),
        this.api.get<MyProfile>('/me/profile'),
        this.loadLeaflet(),
      ]);
      this.members.set(members);
      this.myCities.set(profile.locations);
      this.consentLocation.set(profile.consents.location);
      this.createMap(config);
      this.renderMarkers();
    } catch (err) {
      this.toast.error((err as ApiError).message ?? 'Chargement de la carte impossible.', () => void this.init());
    } finally {
      this.loading.set(false);
    }
  }

  /** Leaflet est chargé uniquement dans le navigateur, à la demande (bundle séparé). */
  private async loadLeaflet() {
    const L = (await import('leaflet')).default;
    (window as unknown as { L: typeof Leaflet }).L = L;
    await import('leaflet.markercluster');
    this.L = L;
  }

  private createMap(config: PublicConfig) {
    const L = this.L!;
    const el = this.mapEl()!.nativeElement;
    this.map = L.map(el, { zoomControl: false, worldCopyJump: true, minZoom: 2 }).setView([47, 3], 5);
    L.control.zoom({ position: 'bottomright' }).addTo(this.map);
    L.tileLayer(config.map.tileUrl, {
      attribution: config.map.attribution,
      maxZoom: 12,
      className: config.map.filter === 'dark' ? 'tiles--dark' : '',
    }).addTo(this.map);
    this.cluster = L.markerClusterGroup({
      showCoverageOnHover: false,
      maxClusterRadius: 50,
      iconCreateFunction: (c) =>
        L.divIcon({
          html: `<span>${c.getChildCount()}</span>`,
          className: 'map-cluster',
          iconSize: [42, 42],
        }),
    });
    this.map.addLayer(this.cluster);
  }

  private markerIcon(m: MapMember) {
    const wrap = document.createElement('div');
    wrap.className = 'map-pin';
    // Initiales, comme partout sur le site ; remplacées par l'avatar dès qu'il est chargé.
    const span = document.createElement('span');
    span.textContent = initialsOf(m.displayName);
    wrap.appendChild(span);
    if (m.avatarUrl) {
      const img = document.createElement('img');
      img.alt = '';
      img.referrerPolicy = 'no-referrer';
      img.addEventListener('load', () => span.replaceWith(img), { once: true });
      img.src = m.avatarUrl;
    }
    return this.L!.divIcon({ html: wrap, className: 'map-pin-wrap', iconSize: [40, 48], iconAnchor: [20, 48], popupAnchor: [0, -44] });
  }

  /** Mini-carte membre : construite en DOM (textContent) pour éviter toute injection HTML. */
  private popupFor(m: MapMember, city: string) {
    const root = document.createElement('div');
    root.className = 'map-popup';
    const name = document.createElement('strong');
    name.textContent = m.displayName;
    const rank = document.createElement('span');
    rank.className = 'map-popup__rank';
    rank.textContent = m.rank?.name ?? 'Sans grade';
    const where = document.createElement('span');
    where.className = 'map-popup__city';
    where.textContent = `📍 ${city}`;
    root.append(name, rank, where);
    if (m.tagline) {
      const q = document.createElement('em');
      q.textContent = `« ${m.tagline} »`;
      root.appendChild(q);
    }
    const link = document.createElement('a');
    link.href = `/membres/${m.id}`;
    link.textContent = 'Voir la fiche →';
    link.addEventListener('click', (e) => {
      e.preventDefault();
      void this.router.navigate(['/membres', m.id]);
    });
    root.appendChild(link);
    return root;
  }

  protected renderMarkers() {
    if (!this.L || !this.cluster) return;
    this.cluster.clearLayers();
    this.markers.clear();
    for (const m of this.members()) {
      const list: Leaflet.Marker[] = [];
      for (const loc of m.locations) {
        const marker = this.L.marker([loc.lat, loc.lng], { icon: this.markerIcon(m), title: m.displayName, alt: m.displayName, keyboard: true });
        marker.bindPopup(() => this.popupFor(m, loc.cityLabel), { closeButton: true, maxWidth: 260 });
        list.push(marker);
      }
      this.markers.set(m.id, list);
      this.cluster.addLayers(list);
    }
  }

  /** Recherche d'un membre : zoom automatique et ouverture de sa mini-carte. */
  protected focusMember(name: string) {
    const m = this.members().find((x) => x.displayName.toLowerCase() === name.trim().toLowerCase());
    if (!m) return;
    this.focusOn(m.id);
  }

  protected focusOn(memberId: string) {
    const marker = this.markers.get(memberId)?.[0];
    if (!marker || !this.cluster) {
      this.toast.info("Ce membre n'est pas sur la carte.");
      return;
    }
    this.panel.set(null);
    this.cluster.zoomToShowLayer(marker, () => marker.openPopup());
  }

  // --- Mes villes ---------------------------------------------------------------------

  protected onCityInput(value: string) {
    clearTimeout(this.geocodeTimer);
    this.activeSuggestion.set(-1);
    if (value.trim().length < 2) {
      this.suggestions.set([]);
      return;
    }
    this.geocodeTimer = setTimeout(async () => {
      this.searching.set(true);
      try {
        this.suggestions.set(await this.api.get<CitySuggestion[]>('/me/geocode', { q: value.trim() }));
      } catch (err) {
        this.toast.error((err as ApiError).message);
      } finally {
        this.searching.set(false);
      }
    }, 300);
  }

  protected onCityKey(e: KeyboardEvent) {
    const list = this.suggestions();
    if (!list.length) return;
    if (e.key === 'ArrowDown') this.activeSuggestion.set((this.activeSuggestion() + 1) % list.length);
    else if (e.key === 'ArrowUp') this.activeSuggestion.set((this.activeSuggestion() - 1 + list.length) % list.length);
    else if (e.key === 'Enter' && this.activeSuggestion() >= 0) void this.addCity(list[this.activeSuggestion()]!);
    else if (e.key === 'Escape') this.suggestions.set([]);
    else return;
    e.preventDefault();
  }

  protected async addCity(s: CitySuggestion) {
    if (!this.consentLocation() && !this.consentChecked) {
      this.toast.error('Coche la case de consentement pour publier ta ville.');
      return;
    }
    this.saving.set(true);
    try {
      const created = await this.api.post<Location>('/me/locations', {
        cityLabel: s.label,
        country: s.country,
        lat: s.lat,
        lng: s.lng,
        consent: this.consentChecked || undefined,
      });
      this.consentLocation.set(true);
      this.myCities.update((c) => [...c, created]);
      this.cityQuery = '';
      this.suggestions.set([]);
      this.toast.success(`${s.city} ajoutée à la carte.`);
      await this.reloadMembers();
    } catch (err) {
      this.toast.error((err as ApiError).message);
    } finally {
      this.saving.set(false);
    }
  }

  protected async removeCity(l: Location) {
    try {
      await this.api.delete(`/me/locations/${l.id}`);
      this.myCities.update((c) => c.filter((x) => x.id !== l.id));
      this.toast.success(`${l.cityLabel} supprimée.`);
      await this.reloadMembers();
    } catch (err) {
      this.toast.error((err as ApiError).message, () => void this.removeCity(l));
    }
  }

  private async reloadMembers() {
    this.members.set(await this.api.get<MapMember[]>('/map/members'));
    this.renderMarkers();
  }
}
