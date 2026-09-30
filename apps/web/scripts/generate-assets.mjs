/**
 * Génère les visuels placeholder du site (créations originales, libres de droits) :
 * rubans de médailles, insignes de grades, fonds du hero, favicon et image Open Graph.
 * Usage : node apps/web/scripts/generate-assets.mjs
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const out = join(dirname(fileURLToPath(import.meta.url)), '..', 'public');
const write = (path, content) => {
  mkdirSync(dirname(join(out, path)), { recursive: true });
  writeFileSync(join(out, path), content);
};

// --- Médailles : ruban rayé + pendentif -----------------------------------------------------
const medals = {
  honneur: { stripes: ['#3b6bb5', '#f3f3f3', '#3b6bb5'], metal: '#d9b45a', shape: 'star' },
  'etoile-argent': { stripes: ['#2f4f8f', '#f3f3f3', '#c0392b', '#f3f3f3', '#2f4f8f'], metal: '#cfd4d8', shape: 'star' },
  'etoile-bronze': { stripes: ['#b22234', '#1d3f7a', '#b22234'], metal: '#b07a3c', shape: 'star' },
  'coeur-violet': { stripes: ['#f3f3f3', '#5b2a86', '#5b2a86', '#5b2a86', '#f3f3f3'], metal: '#7b3fb0', shape: 'heart' },
  'bonne-conduite': { stripes: ['#a3212c', '#f3f3f3', '#a3212c'], metal: '#b88a3e', shape: 'disc' },
  instructeur: { stripes: ['#556b2f', '#d9b45a', '#556b2f'], metal: '#9aa86b', shape: 'disc' },
  normandie: { stripes: ['#1e5a3c', '#c8a45a', '#7a2020', '#c8a45a', '#1e5a3c'], metal: '#c8a45a', shape: 'cross' },
  veteran: { stripes: ['#6b7f3a', '#3a4a1f', '#6b7f3a'], metal: '#c9a24b', shape: 'disc' },
};

const pendant = (shape, metal) => {
  const stroke = 'stroke="#1a1a1a" stroke-width="1.2"';
  switch (shape) {
    case 'star':
      return `<polygon points="32,30 36.7,42.5 50,43 39.5,51 43.3,63.5 32,56 20.7,63.5 24.5,51 14,43 27.3,42.5" fill="${metal}" ${stroke}/>`;
    case 'heart':
      return `<path d="M32 62 C14 50 16 36 25 36 C29 36 31 39 32 41 C33 39 35 36 39 36 C48 36 50 50 32 62Z" fill="${metal}" ${stroke}/><circle cx="32" cy="46" r="4" fill="#e9d9a0"/>`;
    case 'cross':
      return `<path d="M28 32h8v10h10v8H36v12h-8V50H18v-8h10z" fill="${metal}" ${stroke}/>`;
    default:
      return `<circle cx="32" cy="47" r="14" fill="${metal}" ${stroke}/><circle cx="32" cy="47" r="9" fill="none" stroke="#1a1a1a" stroke-opacity=".4"/>`;
  }
};

for (const [slug, m] of Object.entries(medals)) {
  const w = 40 / m.stripes.length;
  const stripes = m.stripes.map((c, i) => `<rect x="${12 + i * w}" y="4" width="${w + 0.2}" height="24" fill="${c}"/>`).join('');
  write(
    `medailles/${slug}.svg`,
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 68" width="64" height="68">
<defs><linearGradient id="g" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".25"/><stop offset="1" stop-color="#000" stop-opacity=".25"/></linearGradient></defs>
<path d="M12 4h40v24l-20 6-20-6z" fill="#222"/>${stripes}<path d="M12 4h40v24l-20 6-20-6z" fill="url(#g)"/>
<path d="M12 28l20 6 20-6" fill="none" stroke="#000" stroke-opacity=".35"/>
${pendant(m.shape, m.metal)}</svg>`,
  );
}

// --- Insignes de grade --------------------------------------------------------------------------
const chevron = (y) => `<path d="M8 ${y + 10} L32 ${y} L56 ${y + 10} L56 ${y + 16} L32 ${y + 6} L8 ${y + 16}Z" fill="#c9a24b" stroke="#12150f" stroke-width="1.5"/>`;
const rocker = (y) => `<path d="M8 ${y} Q32 ${y + 12} 56 ${y} L56 ${y + 6} Q32 ${y + 18} 8 ${y + 6}Z" fill="#c9a24b" stroke="#12150f" stroke-width="1.5"/>`;
const bar = (x, color) => `<rect x="${x}" y="14" width="10" height="36" rx="2" fill="${color}" stroke="#12150f" stroke-width="1.5"/>`;
const ranks = [
  chevron(22),
  chevron(16) + rocker(38),
  chevron(14) + chevron(30),
  chevron(8) + chevron(22) + chevron(36),
  chevron(4) + chevron(16) + chevron(28) + rocker(44),
  bar(27, '#d4a93c'),
  bar(27, '#d7dbe0'),
  bar(19, '#d7dbe0') + bar(35, '#d7dbe0'),
  `<path d="M32 8 C44 16 48 28 44 40 C41 48 36 52 32 58 C28 52 23 48 20 40 C16 28 20 16 32 8Z" fill="#d4a93c" stroke="#12150f" stroke-width="1.5"/><path d="M32 12 V56 M32 24 L40 20 M32 32 L42 28 M32 40 L40 38 M32 24 L24 20 M32 32 L22 28 M32 40 L24 38" stroke="#8a6a1c" stroke-width="1.4" fill="none"/>`,
];
ranks.forEach((shape, i) => write(`insignes/grade-${i + 1}.svg`, `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="64" height="64">${shape}</svg>`));

// --- Fond topographique du hero ----------------------------------------------------------------
let rings = '';
const centers = [
  [260, 220],
  [980, 520],
  [620, 820],
  [1500, 260],
];
for (const [cx, cy] of centers) {
  for (let r = 40; r < 520; r += 34) {
    const wob = (k) => (Math.sin(r * 0.05 + k + cx) * r * 0.12).toFixed(1);
    rings += `<path d="M${cx - r} ${cy} C${cx - r} ${cy - r * 0.8 + +wob(1)} ${cx + r * 0.7} ${cy - r + +wob(2)} ${cx + r} ${cy + +wob(3)} C${cx + r} ${cy + r * 0.9} ${cx - r * 0.6} ${cy + r + +wob(4)} ${cx - r} ${cy}Z"/>`;
  }
}
write(
  'visuels/hero-topo.svg',
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1920 1080" preserveAspectRatio="xMidYMid slice"><rect width="1920" height="1080" fill="#11140f"/><g fill="none" stroke="#6b7f3a" stroke-opacity=".13" stroke-width="1.2">${rings}</g><g stroke="#c9a24b" stroke-opacity=".08">${Array.from({ length: 13 }, (_, i) => `<line x1="${i * 160}" y1="0" x2="${i * 160}" y2="1080"/>`).join('')}${Array.from({ length: 8 }, (_, i) => `<line x1="0" y1="${i * 160}" x2="1920" y2="${i * 160}"/>`).join('')}</g></svg>`,
);

// --- Silhouettes de parachutes -----------------------------------------------------------------
const chute = (x, y, s) => `<g transform="translate(${x} ${y}) scale(${s})" fill="#ecefe6">
<path d="M-60 0 C-60 -40 60 -40 60 0 C45 -8 30 -8 20 0 C10 -8 -10 -8 -20 0 C-30 -8 -45 -8 -60 0Z"/>
<path d="M-58 2 L-4 92 M58 2 L4 92 M-20 2 L-2 92 M20 2 L2 92" stroke="#ecefe6" stroke-width="1.4" fill="none"/>
<path d="M-6 92 h12 v8 l6 22 h-6 l-6 -16 l-6 16 h-6 l6 -22z"/></g>`;
write(
  'visuels/hero-parachutes.svg',
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 700 620">${chute(420, 90, 1.25)}${chute(200, 230, 0.8)}${chute(560, 330, 0.6)}${chute(90, 470, 0.45)}${chute(330, 520, 0.35)}<g fill="#ecefe6" opacity=".7"><path d="M40 60 l90 -8 l10 -10 l6 10 l40 -2 l-40 6 l-4 8 l-10 -6 l-92 10z"/></g></svg>`,
);

// --- Favicon et image Open Graph ---------------------------------------------------------------
const shield = `<path d="M50 3 94 14v38c0 30-20 50-44 60C26 102 6 82 6 52V14Z" fill="#12150f" stroke="#c9a24b" stroke-width="5"/>
<path d="M50 30c-6 0-10 4-11 9l-9-4 4 8-9 1 9 6-4 6 10-2c2 5 6 8 10 9 4-1 8-4 10-9l10 2-4-6 9-6-9-1 4-8-9 4c-1-5-5-9-11-9Z" fill="#ecefe6"/>
<text x="50" y="92" text-anchor="middle" font-family="Arial Narrow, Arial, sans-serif" font-size="17" font-weight="700" fill="#c9a24b">501</text>`;
const favicon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 115">${shield}</svg>`;
write('favicon.svg', favicon);
writeFileSync(join(out, 'favicon.png'), await sharp(Buffer.from(favicon)).resize(64, 64, { fit: 'contain', background: '#00000000' }).png().toBuffer());
writeFileSync(join(out, 'apple-touch-icon.png'), await sharp(Buffer.from(favicon)).resize(180, 180, { fit: 'contain', background: '#0e100d' }).png().toBuffer());

const og = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
<rect width="1200" height="630" fill="#0e100d"/>
<radialGradient id="r" cx=".8" cy=".1" r=".9"><stop offset="0" stop-color="#c9a24b" stop-opacity=".25"/><stop offset="1" stop-color="#0e100d" stop-opacity="0"/></radialGradient>
<rect width="1200" height="630" fill="url(#r)"/>
<g fill="none" stroke="#6b7f3a" stroke-opacity=".18">${rings.replaceAll('<path', '<path transform="scale(.62)"')}</g>
<g transform="translate(90 150) scale(2.6)">${shield}</g>
<text x="400" y="270" font-family="Arial Narrow, Arial, sans-serif" font-size="78" font-weight="700" fill="#ecefe6" letter-spacing="2">501ST PIR</text>
<text x="402" y="330" font-family="Arial, sans-serif" font-size="30" fill="#a3aa96">Parachute Infantry Regiment · 101st Airborne</text>
<text x="402" y="410" font-family="Courier New, monospace" font-size="24" fill="#c9a24b" letter-spacing="4">COMMUNAUTÉ RP · SQUAD 44</text>
</svg>`;
writeFileSync(join(out, 'og-image.png'), await sharp(Buffer.from(og)).png().toBuffer());

console.log('Visuels générés dans', out);
