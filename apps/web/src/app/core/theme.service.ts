import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import { inject, Injectable, PLATFORM_ID, signal } from '@angular/core';

export type Theme = 'nuit' | 'jour';

/** Clé du choix explicite de l'utilisateur ; sans elle, le thème suit le réglage clair/sombre de l'appareil. */
const STORAGE_KEY = 'theme';
/** Couleur de la barre du navigateur mobile (= --bg de chaque thème, voir styles/tokens.css). */
const THEME_COLOR: Record<Theme, string> = { nuit: '#070b1a', jour: '#221e17' };

/**
 * Thème d'affichage, porté par l'attribut data-theme de <html>.
 * Le script inline de index.html pose ce thème avant le premier rendu (pas de flash) ;
 * ce service prend le relais pour le bouton de l'en-tête.
 */
@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly doc = inject(DOCUMENT);
  readonly theme = signal<Theme>('nuit');

  constructor() {
    if (!isPlatformBrowser(inject(PLATFORM_ID))) return;
    this.theme.set(this.doc.documentElement.dataset['theme'] === 'jour' ? 'jour' : 'nuit');
    matchMedia('(prefers-color-scheme: light)').addEventListener('change', (e) => {
      if (!this.stored()) this.apply(e.matches ? 'jour' : 'nuit');
    });
  }

  toggle() {
    const next: Theme = this.theme() === 'nuit' ? 'jour' : 'nuit';
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Stockage indisponible (navigation privée…) : le choix vaut pour cette page seulement.
    }
    this.apply(next);
  }

  private stored(): Theme | null {
    try {
      const v = localStorage.getItem(STORAGE_KEY);
      return v === 'jour' || v === 'nuit' ? v : null;
    } catch {
      return null;
    }
  }

  private apply(theme: Theme) {
    this.theme.set(theme);
    this.doc.documentElement.dataset['theme'] = theme;
    this.doc.querySelector('meta[name="theme-color"]')?.setAttribute('content', THEME_COLOR[theme]);
  }
}
