import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, resolve, sep } from 'node:path';
import sharp from 'sharp';
import { config } from '../config.js';
import { randomToken } from './crypto.js';
import { badRequest } from './errors.js';

const ROOT = resolve(config.STORAGE_DIR);

/** Résout une clé de stockage en chemin absolu, en refusant toute traversée de répertoire. */
function pathFor(key: string) {
  if (!/^[a-z]+\/[A-Za-z0-9_-]+\.(webp|png)$/.test(key)) throw badRequest('Clé de fichier invalide.');
  const p = resolve(ROOT, key);
  if (!p.startsWith(ROOT + sep)) throw badRequest('Clé de fichier invalide.');
  return p;
}

export async function putFile(key: string, data: Buffer) {
  const p = pathFor(key);
  await mkdir(dirname(p), { recursive: true });
  await writeFile(p, data);
}

export const readStoredFile = (key: string) => readFile(pathFor(key));

export async function deleteFile(key: string) {
  await rm(pathFor(key), { force: true });
}

const ALLOWED_PHOTO = new Set(['jpeg', 'png', 'webp']);

/**
 * Image personnalisée : vérification du type réel (et non de l'extension), réencodage en WebP,
 * suppression des métadonnées (EXIF, GPS…) et nom de fichier aléatoire.
 */
export async function storeProfileImage(input: Buffer): Promise<string> {
  let meta: sharp.Metadata;
  try {
    meta = await sharp(input, { failOn: 'error' }).metadata();
  } catch {
    throw badRequest('Fichier image illisible.');
  }
  if (!meta.format || !ALLOWED_PHOTO.has(meta.format)) {
    throw badRequest('Format non autorisé (JPG, PNG ou WebP uniquement).');
  }
  const out = await sharp(input, { failOn: 'error' })
    .rotate() // applique l'orientation EXIF avant de supprimer les métadonnées
    .resize(600, 800, { fit: 'cover', position: 'attention' })
    .webp({ quality: 85 })
    .toBuffer(); // sharp n'écrit aucune métadonnée par défaut
  const key = `avatars/${randomToken(18)}.webp`;
  await putFile(key, out);
  return key;
}

/** Image de médaille/ruban : PNG, WebP ou SVG, rastérisée en PNG (neutralise tout script SVG). */
export async function storeMedalImage(input: Buffer): Promise<string> {
  let meta: sharp.Metadata;
  try {
    meta = await sharp(input, { failOn: 'error' }).metadata();
  } catch {
    throw badRequest('Fichier image illisible.');
  }
  if (!meta.format || !['png', 'webp', 'svg'].includes(meta.format)) {
    throw badRequest('Format non autorisé (PNG, WebP ou SVG).');
  }
  const out = await sharp(input, { failOn: 'error', density: 300 })
    .resize(256, 256, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();
  const key = `medals/${randomToken(18)}.png`;
  await putFile(key, out);
  return key;
}

export const fileUrl = (key: string) => `/api/files/${key}`;
