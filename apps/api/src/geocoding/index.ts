import { config } from '../config.js';
import { DEMO_CITIES } from '../data/demo-cities.js';
import { HttpError } from '../lib/errors.js';
import { logger } from '../lib/logger.js';

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

const normalize = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();

function searchDemo(q: string, limit: number): CitySuggestion[] {
  const nq = normalize(q);
  return DEMO_CITIES.filter(([name]) => normalize(name).includes(nq))
    .sort(([a], [b]) => Number(!normalize(a).startsWith(nq)) - Number(!normalize(b).startsWith(nq)))
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

export async function searchCities(q: string, limit = 8): Promise<CitySuggestion[]> {
  if (q.trim().length < 2) return [];
  return config.GEOCODER === 'photon' ? searchPhoton(q, limit) : searchDemo(q, limit);
}
