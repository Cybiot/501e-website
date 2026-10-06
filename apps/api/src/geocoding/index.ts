import type { City } from '@prisma/client';
import { config } from '../config.js';
import { DEMO_CITIES } from '../data/demo-cities.js';
import { prisma } from '../db.js';
import { HttpError } from '../lib/errors.js';
import { logger } from '../lib/logger.js';
import { importCities, normalizeName } from './geonames.js';

export interface CitySuggestion {
  /** Libellé affiché : « Caen, Normandie » */
  label: string;
  city: string;
  region: string | null;
  country: string;
  countryCode: string;
  lat: number;
  lng: number;
}

function searchDemo(q: string, limit: number): CitySuggestion[] {
  const nq = normalizeName(q);
  return DEMO_CITIES.filter(([name]) => normalizeName(name).includes(nq))
    .sort(([a], [b]) => Number(!normalizeName(a).startsWith(nq)) - Number(!normalizeName(b).startsWith(nq)))
    .slice(0, limit)
    .map(([city, region, country, countryCode, lat, lng]) => ({
      label: `${city}, ${region}`,
      city,
      region,
      country,
      countryCode,
      lat,
      lng,
    }));
}

interface PhotonFeature {
  geometry: { coordinates: [number, number] };
  properties: {
    name?: string;
    state?: string;
    country?: string;
    countrycode?: string;
    osm_value?: string;
  };
}

/**
 * Photon auto-hébergé : la requête part du serveur, jamais du navigateur
 * (aucune donnée personnelle transmise à un tiers). Filtré sur les lieux habités.
 */
async function searchPhoton(q: string, limit: number): Promise<CitySuggestion[]> {
  const params = new URLSearchParams({ q, limit: String(limit * 2), lang: 'fr' });
  for (const tag of ['place:city', 'place:town', 'place:village', 'place:municipality']) {
    params.append('osm_tag', tag);
  }
  let res: Response;
  try {
    res = await fetch(`${config.PHOTON_URL.replace(/\/$/, '')}/api?${params}`, {
      signal: AbortSignal.timeout(5000),
    });
  } catch (err) {
    logger.error({ err: (err as Error).message }, 'Photon injoignable');
    throw new HttpError(503, 'GEOCODER_UNAVAILABLE', 'Le service de recherche de villes est indisponible.');
  }
  if (!res.ok) throw new HttpError(503, 'GEOCODER_UNAVAILABLE', 'Le service de recherche de villes est indisponible.');
  const data = (await res.json()) as { features?: PhotonFeature[] };
  const seen = new Set<string>();
  const out: CitySuggestion[] = [];
  for (const f of data.features ?? []) {
    const p = f.properties;
    if (!p.name || !p.country) continue;
    const label = p.state ? `${p.name}, ${p.state}` : p.name;
    const key = `${label}|${p.country}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({
      label,
      city: p.name,
      region: p.state ?? null,
      country: p.country,
      countryCode: (p.countrycode ?? '').toUpperCase(),
      lat: f.geometry.coordinates[1],
      lng: f.geometry.coordinates[0],
    });
    if (out.length >= limit) break;
  }
  return out;
}

const countryNames = new Intl.DisplayNames(['fr'], { type: 'region' });
let importing: Promise<unknown> | null = null;

/**
 * Référentiel GeoNames dans la base (voir geonames.ts) : recherche par début de mot sur le nom
 * affiché, les noms alternatifs et les codes postaux. Ordre : début du nom affiché, puis mot du
 * nom affiché, puis nom alternatif ; à égalité, les plus peuplés, avec un bonus pour le nom exact
 * (un village « Saint-Martin » passe devant Saint-Martin-de-Crau, pas un hameau « Aix » devant
 * Aix-en-Provence) et pour les pays de GEOCODER_COUNTRIES (Brest en Bretagne avant la Biélorussie).
 */
async function searchDb(q: string, limit: number): Promise<CitySuggestion[]> {
  const nq = normalizeName(q);
  if (nq.length < 2) return [];
  const rows = await prisma.$queryRaw<City[]>`
    SELECT * FROM "City" WHERE "search" LIKE ${`% ${nq}%`}
    ORDER BY
      "search" LIKE ${` ${nq}%`} DESC,
      split_part("search", ' | ', 1) LIKE ${`% ${nq}%`} DESC,
      log("population" + 1)
        + CASE WHEN split_part("search", ' | ', 1) = ${` ${nq}`} THEN 2.5 ELSE 0 END
        + CASE WHEN "countryCode"::text = ANY(${config.GEOCODER_COUNTRIES}::text[]) THEN 1 ELSE 0 END DESC,
      "name"
    LIMIT ${limit * 3}`;
  if (!rows.length && importing) {
    throw new HttpError(503, 'GEOCODER_UNAVAILABLE', 'La liste des villes est en préparation, réessaie dans quelques minutes.');
  }
  const seen = new Set<string>();
  const out: CitySuggestion[] = [];
  for (const c of rows) {
    // « Saint-Martin (Gers), Occitanie » : le département distingue les homonymes d'une région.
    const district = c.district && c.district !== c.name ? ` (${c.district})` : '';
    const region = c.region && c.region !== c.name ? `, ${c.region}` : '';
    const label = `${c.name}${district}${region}`;
    if (seen.has(`${label}|${c.countryCode}`)) continue;
    seen.add(`${label}|${c.countryCode}`);
    out.push({
      label,
      city: c.name,
      region: c.region,
      country: countryNames.of(c.countryCode) ?? c.countryCode,
      countryCode: c.countryCode,
      lat: c.lat,
      lng: c.lng,
    });
    if (out.length >= limit) break;
  }
  return out;
}

/** GEOCODER=db : importe le référentiel au premier démarrage (table vide), en arrière-plan. */
export async function ensureCities() {
  if (config.GEOCODER !== 'db' || importing) return;
  try {
    if (await prisma.city.findFirst({ select: { id: true } })) return;
    logger.info('Référentiel de villes vide : import GeoNames en cours (quelques minutes)');
    importing = importCities();
    await importing;
  } catch (err) {
    logger.error({ err: (err as Error).message }, 'Import du référentiel de villes impossible (npm run cities:import)');
  } finally {
    importing = null;
  }
}

export async function searchCities(q: string, limit = 8): Promise<CitySuggestion[]> {
  if (q.trim().length < 2) return [];
  if (config.GEOCODER === 'db') return searchDb(q, limit);
  return config.GEOCODER === 'photon' ? searchPhoton(q, limit) : searchDemo(q, limit);
}
