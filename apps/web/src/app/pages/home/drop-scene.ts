import { afterNextRender, Directive, ElementRef, inject, input } from '@angular/core';

/**
 * Scène de largage du hero : trois C-47 et leurs sticks de parachutistes.
 * Coordonnées dans un repère de 860 × 640 unités (voir `.drop` dans home.page.css) :
 * x = centre horizontal du parachutiste (bord gauche pour un avion), y = bord haut, w = largeur.
 * Chaque parachutiste part de la porte de son avion (`door`) et rejoint sa position finale.
 */

export const SCENE_W = 860;
export const SCENE_H = 640;

type Pose = 'exit' | 'streamer' | 'open';

interface Jumper {
  pose: Pose;
  x: number;
  y: number;
  w: number;
}

interface Flight {
  depth: 'far' | 'mid' | 'near';
  plane: { x: number; y: number; w: number };
  /** Retard d'entrée de l'avion (s). */
  delay: number;
  /** Retard du premier saut (s), puis un saut toutes les `JUMP_INTERVAL` secondes. */
  jumpAt: number;
  /** Du premier sauté (le plus loin, le plus bas) au dernier (encore près de la porte). */
  stick: Jumper[];
}

/**
 * Rythme du largage (s) : entrée d'un avion, écart entre deux sauts, descente d'un parachutiste.
 * Les premiers sauts (`jumpAt`) suivent de près l'arrivée des avions pour éviter un temps mort.
 */
const PLANE_DURATION = 3.2;
const JUMP_INTERVAL = 0.6;
const JUMP_DURATION = 3.2;

/** Porte cargo du C-47 sur la photo (côté gauche, derrière l'aile), en fraction de l'image. */
const DOOR = { x: 0.36, y: 0.69 };
/** Rapport hauteur / largeur de /visuels/c47.png. */
const PLANE_RATIO = 353 / 707;

const FLIGHTS: Flight[] = [
  {
    depth: 'far',
    plane: { x: 290, y: 0, w: 130 },
    delay: 0.8,
    jumpAt: 3.6,
    stick: [
      { pose: 'open', x: 312, y: 92, w: 16 },
      { pose: 'streamer', x: 327, y: 62, w: 8 },
    ],
  },
  {
    depth: 'mid',
    plane: { x: 40, y: 20, w: 200 },
    delay: 0.4,
    jumpAt: 3.2,
    stick: [
      { pose: 'open', x: 75, y: 170, w: 24 },
      { pose: 'open', x: 95, y: 122, w: 20 },
      { pose: 'exit', x: 104, y: 89, w: 16 },
    ],
  },
  {
    depth: 'near',
    plane: { x: 400, y: 60, w: 440 },
    delay: 0,
    jumpAt: 2.8,
    stick: [
      { pose: 'open', x: 326, y: 522, w: 56 },
      { pose: 'open', x: 404, y: 432, w: 54 },
      { pose: 'open', x: 418, y: 352, w: 50 },
      { pose: 'open', x: 478, y: 290, w: 40 },
      { pose: 'streamer', x: 505, y: 248, w: 18 },
      { pose: 'exit', x: 538, y: 212, w: 40 },
    ],
  },
];

const pctX = (v: number) => (v / SCENE_W) * 100;
const pctY = (v: number) => (v / SCENE_H) * 100;

/** Données prêtes pour le gabarit : positions en %, décalages de départ en cqw (largeur de la scène), retards en s. */
export const DROP_SCENE = FLIGHTS.map((f) => {
  const doorX = f.plane.x + DOOR.x * f.plane.w;
  const doorY = f.plane.y + DOOR.y * f.plane.w * PLANE_RATIO;
  return {
    depth: f.depth,
    plane: { left: pctX(f.plane.x), top: pctY(f.plane.y), width: pctX(f.plane.w), delay: f.delay },
    stick: f.stick.map((j, i) => ({
      src: `/visuels/para-${j.pose}.svg`,
      left: pctX(j.x - j.w / 2),
      top: pctY(j.y),
      width: pctX(j.w),
      dx: `${pctX(doorX - j.x)}cqw`,
      dy: `${pctX(doorY - j.y)}cqw`,
      delay: f.jumpAt + i * JUMP_INTERVAL,
    })),
  };
});

/**
 * Joue le largage : les avions entrent par la gauche, puis les parachutistes quittent la porte un à un.
 * Web Animations plutôt que @keyframes : à l'hydratation, Angular remplace la feuille de style rendue
 * par le serveur, ce qui relancerait une animation CSS déjà démarrée.
 * Toutes les animations partent de `start` (temps de document.timeline, en ms) : des éléments recréés
 * en cours de route reprennent le largage là où il en était au lieu de sauter à la scène finale.
 */
export function playDrop(root: HTMLElement, start: number): void {
  const animate = (
    el: Element | null,
    keyframes: Keyframe[],
    options: KeyframeAnimationOptions,
  ) => {
    const animation = el?.animate(keyframes, options);
    if (animation) animation.startTime = start;
  };
  root.querySelectorAll<HTMLElement>('.drop__flight').forEach((flight, i) => {
    const f = DROP_SCENE[i];
    const plane = flight.querySelector('.drop__plane');
    animate(plane, [{ offset: 0, transform: 'translateX(-55vw)', opacity: 0 }], {
      duration: PLANE_DURATION * 1000,
      delay: f.plane.delay * 1000,
      easing: 'cubic-bezier(0.2, 0.6, 0.3, 1)',
      fill: 'backwards',
    });
    // Puis l'avion continue de dériver doucement : la scène ne se fige pas une fois le largage fini.
    animate(
      plane,
      [{ transform: 'translate(0, 0)' }, { transform: 'translate(0.8cqw, -0.4cqw)' }],
      {
        duration: 5000 + i * 900,
        delay: (f.plane.delay + PLANE_DURATION) * 1000,
        iterations: Infinity,
        direction: 'alternate',
        easing: 'ease-in-out',
        composite: 'add',
      },
    );
    flight.querySelectorAll('.drop__jumper').forEach((jumper, k) => {
      const j = f.stick[k];
      animate(
        jumper,
        [{ offset: 0, transform: `translate(${j.dx}, ${j.dy}) scale(0.25)`, opacity: 0 }],
        {
          duration: JUMP_DURATION * 1000,
          delay: j.delay * 1000,
          // Décélération progressive (sans départ en trombe) jusqu'à la position finale.
          easing: 'ease-out',
          fill: 'backwards',
        },
      );
      // Balancement léger sous la voile, pendant et après la descente.
      animate(jumper, [{ transform: 'rotate(-2.5deg)' }, { transform: 'rotate(2.5deg)' }], {
        duration: 2400 + ((i * 3 + k) % 5) * 300,
        delay: j.delay * 1000,
        iterations: Infinity,
        direction: 'alternate',
        easing: 'ease-in-out',
        composite: 'add',
      });
    });
  });
}

/** Origine commune du largage, gardée par la page : elle survit à une recréation de la vue. */
export interface DropClock {
  start: number | null;
}

/**
 * Lance le largage sur la scène qui la porte, une fois rendue côté navigateur (scène finale directe si
 * les animations sont réduites). Portée par l'élément plutôt que par la page : si Angular recrée la vue
 * (rechargement à chaud en développement), la directive est recréée avec elle et réanime les nouveaux
 * éléments à partir de la même origine.
 */
@Directive({ selector: '[appDropScene]' })
export class DropSceneDirective {
  readonly clock = input.required<DropClock>({ alias: 'appDropScene' });

  constructor() {
    const el = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
    afterNextRender(() => {
      if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
      const clock = this.clock();
      clock.start ??= document.timeline.currentTime as number;
      playDrop(el, clock.start);
    });
  }
}
