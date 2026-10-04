/**
 * Génère les visuels du site : placeholders originaux libres de droits (insignes des 17 grades,
 * fonds du hero), médailles officielles (assets/medailles) redimensionnées pour le web et
 * déclinaisons du logo officiel (assets/logo/501e.png) : tailles web, favicons, icônes du
 * manifeste et image Open Graph.
 * Usage : node apps/web/scripts/generate-assets.mjs
 */
import { mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const out = join(dirname(fileURLToPath(import.meta.url)), '..', 'public');
const write = (path, content) => {
  mkdirSync(dirname(join(out, path)), { recursive: true });
  writeFileSync(join(out, path), content);
};

// --- Médailles : images officielles (assets/medailles), redimensionnées pour le web --------------
// Rubans et insignes gardent leurs proportions ; seules les images trop grandes sont réduites.
const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const medalSrc = join(root, 'assets', 'medailles');
for (const file of readdirSync(medalSrc).filter((f) => f.endsWith('.png'))) {
  write(
    `medailles/${file}`,
    await sharp(join(medalSrc, file))
      .resize(512, 256, { fit: 'inside', withoutEnlargement: true })
      .png({ compressionLevel: 9 })
      .toBuffer(),
  );
}

// --- Logos des compagnies : images officielles (assets/compagnies), déclinées en webp ------------
const companySrc = join(root, 'assets', 'compagnies');
for (const file of readdirSync(companySrc).filter((f) => f.endsWith('.png'))) {
  const slug = file.replace(/\.png$/, '');
  const trimmed = await sharp(join(companySrc, file)).trim().toBuffer();
  for (const size of [160, 320]) {
    write(
      `logo/compagnies/${slug}-${size}.webp`,
      await sharp(trimmed)
        .resize(size, size, { fit: 'contain', background: '#00000000', withoutEnlargement: true })
        .webp({ quality: 88 })
        .toBuffer(),
    );
  }
}

// --- Insignes de grade (un fichier par grade, nommé par son slug) -----------------------------
const GOLD = 'fill="#c9a24b" stroke="#12150f" stroke-width="1.2"';
const chev = (y) => `<path d="M8 ${y + 9} L32 ${y} L56 ${y + 9} L56 ${y + 14} L32 ${y + 5} L8 ${y + 14}Z" ${GOLD}/>`;
const rock = (y) => `<path d="M8 ${y} Q32 ${y + 10} 56 ${y} L56 ${y + 5} Q32 ${y + 15} 8 ${y + 5}Z" ${GOLD}/>`;
const tech = (y) => `<path d="M24 ${y} h16 v4 h-6 v10 h-4 v-10 h-6z" ${GOLD}/>`; // « T » des techniciens
const lozenge = (y) => `<path d="M32 ${y} l5 6 l-5 6 l-5 -6z" ${GOLD}/>`;
const bar = (x, color) => `<rect x="${x}" y="14" width="10" height="36" rx="2" fill="${color}" stroke="#12150f" stroke-width="1.5"/>`;
const leaf = (color, vein) =>
  `<path d="M32 8 C44 16 48 28 44 40 C41 48 36 52 32 58 C28 52 23 48 20 40 C16 28 20 16 32 8Z" fill="${color}" stroke="#12150f" stroke-width="1.5"/><path d="M32 12 V56 M32 24 L40 20 M32 32 L42 28 M32 40 L40 38 M32 24 L24 20 M32 32 L22 28 M32 40 L24 38" stroke="${vein}" stroke-width="1.4" fill="none"/>`;
const eagle = `<path d="M6 24 C14 16 24 18 29 25 L32 20 L35 25 C40 18 50 16 58 24 C52 30 45 33 38 33 L36 44 L41 54 L32 49 L23 54 L28 44 L26 33 C19 33 12 30 6 24Z" fill="#d7dbe0" stroke="#12150f" stroke-width="1.5"/><circle cx="32" cy="16" r="4.5" fill="#d7dbe0" stroke="#12150f" stroke-width="1.5"/><path d="M28 36 h8 M28 40 h8" stroke="#12150f" stroke-width="1.2"/>`;
const insignia = {
  pvt: `<path d="M8 33 L32 24 L56 33 L56 38 L32 29 L8 38Z" fill="none" stroke="#c9a24b" stroke-width="1.5" stroke-dasharray="3 2"/>`,
  pfc: chev(24),
  cpl: chev(19) + chev(27),
  t5: chev(12) + chev(20) + tech(40),
  t4: chev(8) + chev(16) + chev(24) + tech(44),
  t3: chev(2) + chev(10) + chev(18) + tech(35) + rock(51),
  sgt: chev(15) + chev(23) + chev(31),
  ssgt: chev(8) + chev(16) + chev(24) + rock(44),
  sfc: chev(4) + chev(12) + chev(20) + rock(38) + rock(46),
  '1sgt': chev(0) + chev(8) + chev(16) + lozenge(22) + rock(35) + rock(43) + rock(51),
  msgt: chev(0) + chev(8) + chev(16) + rock(35) + rock(43) + rock(51),
  '2lt': bar(27, '#d4a93c'),
  '1lt': bar(27, '#d7dbe0'),
  cpt: bar(19, '#d7dbe0') + bar(35, '#d7dbe0'),
  mjr: leaf('#d4a93c', '#8a6a1c'),
  ltcol: leaf('#d7dbe0', '#8a8f96'),
  col: eagle,
};
for (const [slug, shape] of Object.entries(insignia)) {
  write(`insignes/${slug}.svg`, `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="64" height="64">${shape}</svg>`);
}

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
const topo = (bg) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1920 1080" preserveAspectRatio="xMidYMid slice"><rect width="1920" height="1080" fill="${bg}"/><g fill="none" stroke="#6b7f3a" stroke-opacity=".13" stroke-width="1.2">${rings}</g><g stroke="#c9a24b" stroke-opacity=".08">${Array.from({ length: 13 }, (_, i) => `<line x1="${i * 160}" y1="0" x2="${i * 160}" y2="1080"/>`).join('')}${Array.from({ length: 8 }, (_, i) => `<line x1="0" y1="${i * 160}" x2="1920" y2="${i * 160}"/>`).join('')}</g></svg>`;
write('visuels/hero-topo.svg', topo('#11140f'));
// Thème « jour » : même dessin sur le fond brun-kaki moyen.
write('visuels/hero-topo-jour.svg', topo('#201c15'));

// --- Silhouettes de parachutes -----------------------------------------------------------------
const chute = (x, y, s) => `<g transform="translate(${x} ${y}) scale(${s})" fill="#ecefe6">
<path d="M-60 0 C-60 -40 60 -40 60 0 C45 -8 30 -8 20 0 C10 -8 -10 -8 -20 0 C-30 -8 -45 -8 -60 0Z"/>
<path d="M-58 2 L-4 92 M58 2 L4 92 M-20 2 L-2 92 M20 2 L2 92" stroke="#ecefe6" stroke-width="1.4" fill="none"/>
<path d="M-6 92 h12 v8 l6 22 h-6 l-6 -16 l-6 16 h-6 l6 -22z"/></g>`;
write(
  'visuels/hero-parachutes.svg',
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 700 620">${chute(420, 90, 1.25)}${chute(200, 230, 0.8)}${chute(560, 330, 0.6)}${chute(90, 470, 0.45)}${chute(330, 520, 0.35)}<g fill="#ecefe6" opacity=".7"><path d="M40 60 l90 -8 l10 -10 l6 10 l40 -2 l-40 6 l-4 8 l-10 -6 l-92 10z"/></g></svg>`,
);

// --- Logo officiel : variantes, favicons et image Open Graph ------------------------------------
// Source : assets/logo/501e.png (fond noir). Le fond est détouré par remplissage depuis les bords,
// puis les pixels de contour sont « démélangés » du noir pour garder un anticrénelage propre.
const logoSrc = join(root, 'assets', 'logo', '501e.png');
const { data: px, info } = await sharp(logoSrc).removeAlpha().raw().toBuffer({ resolveWithObject: true });
const { width: W, height: H } = info;
const lum = (i) => Math.max(px[i * 3], px[i * 3 + 1], px[i * 3 + 2]);
const bg = new Uint8Array(W * H);
const stack = [];
for (let x = 0; x < W; x++) stack.push(x, (H - 1) * W + x);
for (let y = 0; y < H; y++) stack.push(y * W, y * W + W - 1);
while (stack.length) {
  const i = stack.pop();
  if (bg[i] || lum(i) >= 48) continue;
  bg[i] = 1;
  const x = i % W;
  if (x > 0) stack.push(i - 1);
  if (x < W - 1) stack.push(i + 1);
  if (i >= W) stack.push(i - W);
  if (i < W * (H - 1)) stack.push(i + W);
}
const near = (i, r, test) => {
  const x0 = i % W, y0 = (i / W) | 0;
  for (let y = Math.max(0, y0 - r); y <= Math.min(H - 1, y0 + r); y++)
    for (let x = Math.max(0, x0 - r); x <= Math.min(W - 1, x0 + r); x++) if (test(y * W + x)) return true;
  return false;
};
const edge = new Uint8Array(W * H);
for (let i = 0; i < W * H; i++) if (!bg[i] && near(i, 2, (j) => bg[j])) edge[i] = 1;
const rgba = Buffer.alloc(W * H * 4);
for (let i = 0; i < W * H; i++) {
  if (bg[i]) continue;
  let a = 1;
  if (edge[i]) {
    let ref = 0;
    near(i, 3, (j) => {
      if (!bg[j] && !edge[j]) ref = Math.max(ref, lum(j));
      return false;
    });
    if (ref) a = Math.min(1, lum(i) / ref);
  }
  for (let c = 0; c < 3; c++) rgba[i * 4 + c] = Math.min(255, Math.round(px[i * 3 + c] / (a || 1)));
  rgba[i * 4 + 3] = Math.round(a * 255);
}
const logo = await sharp(rgba, { raw: { width: W, height: H, channels: 4 } }).trim().png().toBuffer();
const logoAt = (w) => sharp(logo).resize({ width: w });

write('logo/501e.png', await sharp(logo).png({ compressionLevel: 9, palette: true }).toBuffer());
for (const w of [128, 256, 512]) write(`logo/501e-${w}.webp`, await logoAt(w).webp({ quality: 90 }).toBuffer());

// Icône carrée : logo centré, sur fond transparent ou uni (Apple ignore la transparence).
const square = (size, pad, background = '#00000000') =>
  sharp(logo)
    .resize(size - 2 * pad, size - 2 * pad, { fit: 'contain', background: '#00000000' })
    .extend({ top: pad, bottom: pad, left: pad, right: pad, background })
    .flatten(background === '#00000000' ? false : { background })
    .png({ compressionLevel: 9, palette: true })
    .toBuffer();
write('apple-touch-icon.png', await square(180, 14, '#070b1a'));
write('icon-192.png', await square(192, 0));
write('icon-512.png', await square(512, 0));

// favicon.ico multi-tailles (entrées PNG, format accepté par tous les navigateurs actuels).
const icoSizes = [16, 32, 48];
const pngs = await Promise.all(icoSizes.map((s) => square(s, 0)));
const header = Buffer.alloc(6 + 16 * pngs.length);
header.writeUInt16LE(1, 2);
header.writeUInt16LE(pngs.length, 4);
let offset = header.length;
pngs.forEach((png, k) => {
  const e = 6 + 16 * k;
  header[e] = icoSizes[k];
  header[e + 1] = icoSizes[k];
  header.writeUInt16LE(1, e + 4);
  header.writeUInt16LE(32, e + 6);
  header.writeUInt32LE(png.length, e + 8);
  header.writeUInt32LE(offset, e + 12);
  offset += png.length;
});
write('favicon.ico', Buffer.concat([header, ...pngs]));

write(
  'site.webmanifest',
  JSON.stringify(
    {
      name: '501e - FR Roleplay Community',
      short_name: '501e',
      icons: [
        { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
        { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
      ],
      theme_color: '#070b1a',
      background_color: '#070b1a',
      display: 'browser',
    },
    null,
    2,
  ) + '\n',
);

const og = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
<rect width="1200" height="630" fill="#0e100d"/>
<radialGradient id="r" cx=".8" cy=".1" r=".9"><stop offset="0" stop-color="#c9a24b" stop-opacity=".25"/><stop offset="1" stop-color="#0e100d" stop-opacity="0"/></radialGradient>
<rect width="1200" height="630" fill="url(#r)"/>
<g fill="none" stroke="#6b7f3a" stroke-opacity=".18">${rings.replaceAll('<path', '<path transform="scale(.62)"')}</g>
<text x="420" y="270" font-family="Arial Narrow, Arial, sans-serif" font-size="78" font-weight="700" fill="#ecefe6" letter-spacing="2">501E</text>
<text x="422" y="330" font-family="Arial, sans-serif" font-size="30" fill="#a3aa96">Parachute Infantry Regiment · 101st Airborne</text>
<text x="422" y="410" font-family="Courier New, monospace" font-size="24" fill="#c9a24b" letter-spacing="4">COMMUNAUTÉ RP · SQUAD 44</text>
</svg>`;
const ogLogo = await sharp(logo).resize({ height: 380 }).toBuffer();
const ogLogoMeta = await sharp(ogLogo).metadata();
write(
  'og-image.png',
  await sharp(Buffer.from(og))
    .composite([{ input: ogLogo, left: Math.round(215 - ogLogoMeta.width / 2), top: 125 }])
    .png()
    .toBuffer(),
);

console.log('Visuels générés dans', out);
