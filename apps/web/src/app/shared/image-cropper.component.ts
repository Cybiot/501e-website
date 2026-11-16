import { ChangeDetectionStrategy, Component, ElementRef, output, signal, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { IconComponent } from './icon.component';

const OUT_W = 600;
const OUT_H = 800; // ratio portrait 3:4
/** Décalage vertical des avatars ronds : doit rester aligné sur object-position de .avatar et .map-pin img. */
const AVATAR_Y = 0.2;
const MAX_BYTES = 2 * 1024 * 1024;
const TYPES = ['image/jpeg', 'image/png', 'image/webp'];

/**
 * Recadrage côté client au ratio 3:4 : glisser pour déplacer, curseur (ou molette) pour zoomer,
 * flèches du clavier pour ajuster finement. Émet un Blob JPEG 600×800.
 */
@Component({
  selector: 'app-image-cropper',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, IconComponent],
  template: `
    @if (!image()) {
      <label class="drop" (dragover)="$event.preventDefault()" (drop)="onDrop($event)">
        <app-icon name="upload" [size]="28" />
        <strong>Choisir une image</strong>
        <span class="small muted">JPG, PNG ou WebP · 2 Mo max · format portrait 3:4 recommandé</span>
        <input type="file" accept="image/jpeg,image/png,image/webp" (change)="onFile($event)" class="sr-only" />
      </label>
      @if (error()) {
        <p class="field__error" role="alert">{{ error() }}</p>
      }
    } @else {
      <div class="workspace">
      <div
        class="frame"
        #frame
        tabindex="0"
        role="img"
        aria-label="Zone de recadrage : glisse pour déplacer, flèches pour ajuster"
        (pointerdown)="onDown($event)"
        (pointermove)="onMove($event)"
        (pointerup)="dragging = false"
        (pointercancel)="dragging = false"
        (wheel)="onWheel($event)"
        (keydown)="onKey($event)"
      >
        <img
          [src]="image()!.src"
          alt=""
          draggable="false"
          [style.width.px]="dispW()"
          [style.height.px]="dispH()"
          [style.transform]="'translate(' + x() + 'px,' + y() + 'px)'"
        />
        <span class="frame__grid" aria-hidden="true"></span>
        <span class="frame__avatar" [style.top.px]="avatarTop" aria-hidden="true"></span>
      </div>

      <!-- Aperçus en direct : mêmes cadrages que sur le site (object-position 50 % 20 %). -->
      <div class="previews" aria-label="Aperçus du cadrage">
        <figure>
          <div class="pv pv--sheet">
            <img [src]="image()!.src" alt="" [style]="pv(66, 0)" />
          </div>
          <figcaption>Fiche</figcaption>
        </figure>
        <figure>
          <div class="pv pv--plaque">
            <img [src]="image()!.src" alt="" [style]="pv(72, avatarTop)" />
          </div>
          <figcaption>Carte membre</figcaption>
        </figure>
        <figure>
          <div class="pv pv--pin">
            <div class="pv-pin__inner">
              <img [src]="image()!.src" alt="" [style]="pv(36, avatarTop)" />
            </div>
          </div>
          <figcaption>Carte</figcaption>
        </figure>
      </div>
      </div>
      <p class="small muted hint">Place le visage dans le cercle : c'est la partie visible sur les cartes et dans les avatars ronds.</p>
      <div class="controls">
        <app-icon name="image" [size]="14" />
        <label class="sr-only" for="zoom">Zoom</label>
        <input id="zoom" type="range" min="1" max="3" step="0.01" [ngModel]="zoom()" (ngModelChange)="setZoom($event)" />
        <app-icon name="image" [size]="20" />
      </div>
      <div class="row">
        <button type="button" class="btn btn--ghost btn--sm" (click)="reset()">Changer d'image</button>
        <button type="button" class="btn btn--primary btn--sm" (click)="confirm()"><app-icon name="check" [size]="14" /> Valider le cadrage</button>
      </div>
    }
  `,
  styles: `
    .drop {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: var(--space-2);
      padding: var(--space-6) var(--space-4);
      border: 2px dashed var(--border-strong);
      border-radius: var(--radius);
      cursor: pointer;
      text-align: center;
      transition: border-color var(--dur-fast);
    }
    .drop:hover,
    .drop:focus-within {
      border-color: var(--olive);
    }
    .frame {
      position: relative;
      width: 240px;
      height: 320px;
      overflow: hidden;
      border-radius: var(--radius);
      background: #000;
      cursor: grab;
      touch-action: none;
      margin-bottom: var(--space-3);
    }
    .frame:active {
      cursor: grabbing;
    }
    .frame img {
      position: absolute;
      left: 0;
      top: 0;
      max-width: none;
      user-select: none;
      pointer-events: none;
    }
    .frame__grid {
      position: absolute;
      inset: 0;
      pointer-events: none;
      background:
        linear-gradient(90deg, transparent 33%, rgba(255, 255, 255, 0.15) 33.2%, transparent 33.6%, transparent 66.4%, rgba(255, 255, 255, 0.15) 66.6%, transparent 67%),
        linear-gradient(0deg, transparent 33%, rgba(255, 255, 255, 0.15) 33.2%, transparent 33.6%, transparent 66.4%, rgba(255, 255, 255, 0.15) 66.6%, transparent 67%);
      box-shadow: inset 0 0 0 2px rgb(var(--gold-rgb) / 0.7);
    }
    .workspace {
      display: flex;
      flex-wrap: wrap;
      align-items: flex-start;
      gap: var(--space-4);
    }
    /* Zone ronde des avatars : carré du haut du portrait, décalé comme object-position 50 % 20 %. */
    .frame__avatar {
      position: absolute;
      left: 0;
      width: 240px;
      height: 240px;
      border-radius: 50%;
      border: 2px dashed rgb(var(--gold-rgb) / 0.9);
      box-shadow: 0 0 0 999px rgb(0 0 0 / 0.3);
      pointer-events: none;
    }
    .previews {
      display: flex;
      flex-direction: column;
      gap: var(--space-3);
    }
    .previews figure {
      display: flex;
      align-items: center;
      gap: var(--space-3);
      margin: 0;
    }
    .previews figcaption {
      font-size: var(--fs-xs);
      color: var(--text-muted);
    }
    .pv {
      position: relative;
      overflow: hidden;
      flex-shrink: 0;
      background: #000;
    }
    .pv img {
      position: absolute;
      left: 0;
      top: 0;
      max-width: none;
      transform-origin: 0 0;
    }
    .pv--sheet {
      width: 66px;
      height: 88px;
      border-radius: 6px;
      border: 1px solid var(--border-strong);
      box-sizing: content-box;
    }
    /* Reprend le médaillon de app-member-plaque */
    .pv--plaque {
      width: 72px;
      height: 72px;
      border-radius: 50%;
      border: 2px solid #d9a63a;
      box-sizing: content-box;
      box-shadow:
        0 0 0 2px #0b1230,
        0 4px 12px rgb(0 0 0 / 0.45);
    }
    /* Reprend l'épingle .map-pin de la carte */
    .pv--pin {
      width: 36px;
      height: 36px;
      margin: 4px 2px;
      border-radius: 50% 50% 50% 4px;
      transform: rotate(-45deg);
      border: 2px solid #fff;
      box-sizing: content-box;
      box-shadow: 0 0 12px rgb(var(--olive-rgb) / 0.9);
    }
    .pv-pin__inner {
      position: absolute;
      inset: 0;
      transform: rotate(45deg);
    }
    .hint {
      max-width: 420px;
      margin: 0 0 var(--space-3);
    }
    .controls {
      display: flex;
      align-items: center;
      gap: var(--space-2);
      width: 240px;
      margin-bottom: var(--space-3);
      color: var(--text-muted);
    }
    .controls input {
      flex: 1;
      accent-color: var(--olive);
    }
  `,
})
export class ImageCropperComponent {
  readonly cropped = output<Blob>();
  private readonly frameRef = viewChild<ElementRef<HTMLDivElement>>('frame');
  private readonly FW = 240;
  private readonly FH = 320;

  protected readonly image = signal<HTMLImageElement | null>(null);
  protected readonly error = signal<string | null>(null);
  protected readonly zoom = signal(1);
  protected readonly x = signal(0);
  protected readonly y = signal(0);
  protected dragging = false;
  private last = { x: 0, y: 0 };
  private baseScale = 1;

  /** Haut du carré visible dans les avatars ronds (object-position: 50% 20% dans components.css). */
  protected readonly avatarTop = AVATAR_Y * (this.FH - this.FW);

  protected dispW = () => (this.image()?.naturalWidth ?? 0) * this.baseScale * this.zoom();
  protected dispH = () => (this.image()?.naturalHeight ?? 0) * this.baseScale * this.zoom();

  /**
   * Style de l'image d'un aperçu de largeur `size` montrant la zone du cadre qui commence à `top`
   * (0 : portrait entier, avatarTop : carré des avatars ronds).
   */
  protected pv(size: number, top: number) {
    const k = size / this.FW;
    return {
      width: this.dispW() + 'px',
      height: this.dispH() + 'px',
      transform: `scale(${k}) translate(${this.x()}px, ${this.y() - top}px)`,
    };
  }

  onFile(e: Event) {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (file) this.load(file);
  }

  onDrop(e: DragEvent) {
    e.preventDefault();
    const file = e.dataTransfer?.files?.[0];
    if (file) this.load(file);
  }

  private load(file: File) {
    this.error.set(null);
    if (!TYPES.includes(file.type)) return this.error.set('Format non autorisé : JPG, PNG ou WebP uniquement.');
    if (file.size > MAX_BYTES) return this.error.set('Image trop lourde : 2 Mo maximum.');
    const img = new Image();
    img.onload = () => {
      // Échelle minimale pour que l'image couvre entièrement le cadre.
      this.baseScale = Math.max(this.FW / img.naturalWidth, this.FH / img.naturalHeight);
      this.zoom.set(1);
      this.image.set(img);
      this.x.set((this.FW - img.naturalWidth * this.baseScale) / 2);
      this.y.set((this.FH - img.naturalHeight * this.baseScale) / 2);
      setTimeout(() => this.frameRef()?.nativeElement.focus());
    };
    img.onerror = () => this.error.set('Image illisible.');
    img.src = URL.createObjectURL(file);
  }

  private clamp() {
    this.x.set(Math.min(0, Math.max(this.FW - this.dispW(), this.x())));
    this.y.set(Math.min(0, Math.max(this.FH - this.dispH(), this.y())));
  }

  setZoom(z: number) {
    // Zoom centré sur le milieu du cadre.
    const cx = this.FW / 2 - this.x();
    const cy = this.FH / 2 - this.y();
    const ratio = z / this.zoom();
    this.zoom.set(z);
    this.x.set(this.FW / 2 - cx * ratio);
    this.y.set(this.FH / 2 - cy * ratio);
    this.clamp();
  }

  onDown(e: PointerEvent) {
    this.dragging = true;
    this.last = { x: e.clientX, y: e.clientY };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }

  onMove(e: PointerEvent) {
    if (!this.dragging) return;
    this.x.update((v) => v + e.clientX - this.last.x);
    this.y.update((v) => v + e.clientY - this.last.y);
    this.last = { x: e.clientX, y: e.clientY };
    this.clamp();
  }

  onWheel(e: WheelEvent) {
    e.preventDefault();
    this.setZoom(Math.min(3, Math.max(1, this.zoom() - e.deltaY * 0.002)));
  }

  onKey(e: KeyboardEvent) {
    const step = 10;
    const moves: Record<string, [number, number]> = { ArrowLeft: [step, 0], ArrowRight: [-step, 0], ArrowUp: [0, step], ArrowDown: [0, -step] };
    if (e.key === '+' || e.key === '=') this.setZoom(Math.min(3, this.zoom() + 0.1));
    else if (e.key === '-') this.setZoom(Math.max(1, this.zoom() - 0.1));
    else if (moves[e.key]) {
      this.x.update((v) => v + moves[e.key]![0]);
      this.y.update((v) => v + moves[e.key]![1]);
      this.clamp();
    } else return;
    e.preventDefault();
  }

  reset() {
    this.image.set(null);
  }

  confirm() {
    const img = this.image();
    if (!img) return;
    const canvas = document.createElement('canvas');
    canvas.width = OUT_W;
    canvas.height = OUT_H;
    const ctx = canvas.getContext('2d')!;
    const scale = this.baseScale * this.zoom();
    const sx = -this.x() / scale;
    const sy = -this.y() / scale;
    ctx.drawImage(img, sx, sy, this.FW / scale, this.FH / scale, 0, 0, OUT_W, OUT_H);
    canvas.toBlob((blob) => blob && this.cropped.emit(blob), 'image/jpeg', 0.9);
  }
}
