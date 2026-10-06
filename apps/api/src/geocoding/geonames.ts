import { inflateRawSync } from 'node:zlib';
import type { Prisma } from '@prisma/client';
import { config } from '../config.js';
import { prisma } from '../db.js';
import { logger } from '../lib/logger.js';

/**
 * Import du référentiel de villes depuis GeoNames (données ouvertes, CC BY 4.0) :
 * - pays de GEOCODER_COUNTRIES en entier (tous les lieux habités, noms français, codes postaux) ;
 * - villes de plus de 15 000 habitants du reste du monde (GEOCODER_WORLD_CITIES).
 * Quelques dizaines de Mo téléchargés, traités en mémoire : rien n'est écrit sur le disque.
 */

const BASE_URL = 'https://download.geonames.org/export/dump';

/** Lieux habités écartés : quartiers (PPLX), lieux historiques, abandonnés, détruits. */
const EXCLUDED_CODES = new Set(['PPLX', 'PPLH', 'PPLQ', 'PPLW', 'PPLCH']);

/** Minuscules sans accents ni ponctuation : « Saint-Étienne » → « saint etienne ». */
export const normalizeName = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/œ/g, 'oe')
    .replace(/æ/g, 'ae')
    .replace(/ß/g, 'ss')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

async function download(path: string): Promise<Buffer> {
  const res = await fetch(`${BASE_URL}/${path}`, { signal: AbortSignal.timeout(180_000) });
  if (!res.ok) throw new Error(`GeoNames ${path} : HTTP ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

/** Extrait un fichier d'une archive zip (lecture du répertoire central, sans ZIP64). */
export function unzipEntry(zip: Buffer, name: string): Buffer {
  const eocd = zip.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  if (eocd < 0) throw new Error('Archive zip invalide');
  const count = zip.readUInt16LE(eocd + 10);
  let p = zip.readUInt32LE(eocd + 16);
  for (let i = 0; i < count; i++) {
    const method = zip.readUInt16LE(p + 10);
    const size = zip.readUInt32LE(p + 20);
    const nameLen = zip.readUInt16LE(p + 28);
    const local = zip.readUInt32LE(p + 42);
    if (zip.toString('utf8', p + 46, p + 46 + nameLen) === name) {
      const start = local + 30 + zip.readUInt16LE(local + 26) + zip.readUInt16LE(local + 28);
      const data = zip.subarray(start, start + size);
      return method === 8 ? inflateRawSync(data) : data;
    }
    p += 46 + nameLen + zip.readUInt16LE(p + 30) + zip.readUInt16LE(p + 32);
  }
  throw new Error(`${name} absent de l'archive`);
}

function* tsv(buf: Buffer): Generator<string[]> {
  for (const line of buf.toString('utf8').split('\n')) {
    if (line && !line.startsWith('#')) yield line.split('\t');
  }
}

interface Admin {
  name: string;
  id: number;
}

/** admin1CodesASCII.txt / admin2Codes.txt : « FR.28 » → Normandy. */
function parseAdmins(buf: Buffer): Map<string, Admin> {
  const map = new Map<string, Admin>();
  for (const [code = '', name = '', , id = ''] of tsv(buf)) map.set(code, { name, id: Number(id) });
  return map;
}

interface Place {
  id: number;
  name: string;
  /** Nom ASCII et noms alternatifs (toutes langues) : utilisés pour la recherche seulement. */
  names: string[];
  countryCode: string;
  admin1: string;
  admin2: string;
  lat: number;
  lng: number;
  population: number;
}

function parsePlaces(buf: Buffer, keep: (countryCode: string) => boolean): Place[] {
  const out: Place[] = [];
  // Colonnes : geonameid, name, asciiname, alternatenames, latitude, longitude, feature class,
  // feature code, country code, cc2, admin1 code, admin2 code, admin3, admin4, population…
  for (const [id = '', name = '', ascii = '', alt = '', lat = '', lng = '', fclass, fcode = '', cc = '', , a1, a2, , , pop] of tsv(buf)) {
    if (fclass !== 'P' || EXCLUDED_CODES.has(fcode) || !keep(cc)) continue;
    out.push({
      id: Number(id),
      name,
      names: [ascii, ...(alt ? alt.split(',') : [])],
      countryCode: cc,
      admin1: `${cc}.${a1}`,
      admin2: `${cc}.${a1}.${a2}`,
      lat: Number(lat),
      lng: Number(lng),
      population: Number(pop) || 0,
    });
  }
  return out;
}

interface Alternates {
  french: Map<number, string>;
  /** Noms français marqués historiques : retenus seulement s'ils ne diffèrent que par les accents. */
  frenchHistoric: Map<number, string>;
  postcodes: Map<number, string[]>;
}

const NO_ALTERNATES: Alternates = { french: new Map(), frenchHistoric: new Map(), postcodes: new Map() };

/**
 * alternatenames/XX.txt : nom français de chaque lieu (forme courte, puis préférée : « Genève »
 * plutôt que « Canton de Genève ») et codes postaux (hors CEDEX).
 */
function parseAlternates(buf: Buffer, ids: Set<number>): Alternates {
  const french = new Map<number, { name: string; score: number }>();
  const frenchHistoric = new Map<number, string>();
  const postcodes = new Map<number, string[]>();
  for (const [, gid, lang, name = '', preferred, short, colloquial, historic] of tsv(buf)) {
    const id = Number(gid);
    if (!name || !ids.has(id) || colloquial === '1') continue;
    if (lang === 'fr' && historic === '1') {
      frenchHistoric.set(id, name);
    } else if (lang === 'fr') {
      const score = (short === '1' ? 2 : 0) + (preferred === '1' ? 1 : 0);
      if (!french.has(id) || score > french.get(id)!.score) french.set(id, { name, score });
    } else if (lang === 'post' && historic !== '1' && !name.includes('CEDEX')) {
      postcodes.set(id, [...(postcodes.get(id) ?? []), name]);
    }
  }
  return { french: new Map([...french].map(([id, f]) => [id, f.name])), frenchHistoric, postcodes };
}

/** GeoNames garde « Québec » comme nom historique : accepté, mais pas « Orléansville » pour Chlef. */
function frenchName(alt: Alternates, id: number, name: string): string {
  const historic = alt.frenchHistoric.get(id);
  return alt.french.get(id) ?? (historic && normalizeName(historic) === normalizeName(name) ? historic : name);
}

/** « Région Provence-Alpes-Côte d'Azur » → « Provence-Alpes-Côte d'Azur », « Morges District » → « Morges ». */
const shortAdminName = (s: string) =>
  s
    .replace(/^(Région|Province|Canton|Département|District|Wilaya|Préfecture) (de la |de l['’]|du |des |de |d['’])?(?=\p{Lu})/u, '')
    .replace(/ District$/, '');

function toRow(
  place: Place,
  alt: Alternates,
  admin1: Map<string, Admin>,
  admin2: Map<string, Admin>,
): Prisma.CityCreateManyInput {
  const adminName = (a: Admin | undefined) => (a ? shortAdminName(frenchName(alt, a.id, a.name)) : null);
  const name = frenchName(alt, place.id, place.name);
  return {
    id: place.id,
    name,
    district: adminName(admin2.get(place.admin2)),
    region: adminName(admin1.get(place.admin1)),
    countryCode: place.countryCode,
    lat: place.lat,
    lng: place.lng,
    population: place.population,
    search: searchKey([name, place.name, ...place.names, ...(alt.postcodes.get(place.id) ?? [])]),
  };
}

/**
 * Colonne City.search : « ␣caen | caen | 14000 ». Le nom affiché vient en premier,
 * « LIKE ' caen%' » repère donc un début de nom affiché, « LIKE '% caen%' » un début de mot.
 */
export const searchKey = (names: string[]) => ` ${[...new Set(names.map(normalizeName).filter(Boolean))].join(' | ')}`;

/** Télécharge GeoNames et remplace tout le référentiel (transaction : la recherche reste servie). */
export async function importCities(): Promise<number> {
  const started = Date.now();
  const [admin1, admin2] = (
    await Promise.all([download('admin1CodesASCII.txt'), download('admin2Codes.txt')])
  ).map(parseAdmins) as [Map<string, Admin>, Map<string, Admin>];

  const rows: Prisma.CityCreateManyInput[] = [];
  for (const cc of config.GEOCODER_COUNTRIES) {
    const places = parsePlaces(unzipEntry(await download(`${cc}.zip`), `${cc}.txt`), () => true);
    const ids = new Set(places.map((p) => p.id));
    for (const admins of [admin1, admin2]) {
      for (const [code, a] of admins) if (code.startsWith(`${cc}.`)) ids.add(a.id);
    }
    const alt = parseAlternates(unzipEntry(await download(`alternatenames/${cc}.zip`), `${cc}.txt`), ids);
    for (const p of places) rows.push(toRow(p, alt, admin1, admin2));
    logger.info({ country: cc, places: places.length }, 'Villes GeoNames lues');
  }
  if (config.GEOCODER_WORLD_CITIES) {
    const listed = new Set(config.GEOCODER_COUNTRIES);
    const places = parsePlaces(unzipEntry(await download('cities15000.zip'), 'cities15000.txt'), (cc) => !listed.has(cc));
    for (const p of places) rows.push(toRow(p, NO_ALTERNATES, admin1, admin2));
    logger.info({ places: places.length }, 'Grandes villes du reste du monde lues');
  }

  await prisma.$transaction(
    async (tx) => {
      await tx.city.deleteMany();
      for (let i = 0; i < rows.length; i += 5000) await tx.city.createMany({ data: rows.slice(i, i + 5000) });
    },
    { timeout: 15 * 60_000 },
  );
  logger.info({ cities: rows.length, seconds: Math.round((Date.now() - started) / 1000) }, 'Référentiel de villes importé');
  return rows.length;
}
