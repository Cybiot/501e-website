import { deflateRawSync } from 'node:zlib';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { config } from '../src/config.js';
import { prisma } from '../src/db.js';
import { normalizeName, searchKey, unzipEntry } from '../src/geocoding/geonames.js';
import { searchCities } from '../src/geocoding/index.js';
import { resetDb } from './helpers.js';

/** Archive zip minimale (une entrée compressée), comme celles de GeoNames. */
function zip(name: string, content: string): Buffer {
  const data = deflateRawSync(Buffer.from(content));
  const fileName = Buffer.from(name);
  const local = Buffer.alloc(30);
  local.writeUInt32LE(0x04034b50, 0);
  local.writeUInt16LE(8, 8);
  local.writeUInt32LE(data.length, 18);
  local.writeUInt16LE(fileName.length, 26);
  const central = Buffer.alloc(46);
  central.writeUInt32LE(0x02014b50, 0);
  central.writeUInt16LE(8, 10);
  central.writeUInt32LE(data.length, 20);
  central.writeUInt16LE(fileName.length, 28);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(1, 10);
  end.writeUInt32LE(30 + fileName.length + data.length, 16);
  return Buffer.concat([local, fileName, data, central, fileName, end]);
}

describe('Référentiel GeoNames', () => {
  it('normalise accents, ligatures et ponctuation', () => {
    expect(normalizeName("Saint-Étienne-d'Œuf")).toBe('saint etienne d oeuf');
  });

  it('lit une entrée de zip', () => {
    expect(unzipEntry(zip('FR.txt', 'Caen\tNormandie'), 'FR.txt').toString()).toBe('Caen\tNormandie');
    expect(() => unzipEntry(zip('FR.txt', ''), 'BE.txt')).toThrow();
  });
});

describe('Recherche de villes en base (GEOCODER=db)', () => {
  const city = (id: number, name: string, extra: { names?: string[]; district?: string; region?: string; countryCode?: string; population?: number } = {}) => ({
    id,
    name,
    district: extra.district ?? null,
    region: extra.region ?? null,
    countryCode: extra.countryCode ?? 'FR',
    lat: 48.123456,
    lng: -1.654321,
    population: extra.population ?? 0,
    search: searchKey([name, ...(extra.names ?? [])]),
  });

  beforeAll(() => {
    config.GEOCODER = 'db';
  });
  afterAll(() => {
    config.GEOCODER = 'demo';
  });
  beforeEach(async () => {
    await resetDb();
    await prisma.city.createMany({
      data: [
        city(1, 'Aix-en-Provence', { district: 'Bouches-du-Rhône', region: "Provence-Alpes-Côte d'Azur", population: 143000 }),
        city(2, 'Aix', { district: 'Corrèze', region: 'Nouvelle-Aquitaine', population: 300 }),
        city(3, 'Brest', { countryCode: 'BY', population: 300000 }),
        city(4, 'Brest', { district: 'Finistère', region: 'Bretagne', population: 140000 }),
        city(5, 'Anvers', { names: ['Antwerpen'], district: 'Anvers', region: 'Flandre', countryCode: 'BE', population: 500000 }),
        city(6, 'Caen', { names: ['14000'], district: 'Calvados', region: 'Normandie', population: 110000 }),
        city(7, 'Saint-Malo', { district: 'Ille-et-Vilaine', region: 'Bretagne', population: 46000 }),
      ],
    });
  });

  it('classe par début de nom puis population, sans écraser une grande ville par un hameau homonyme', async () => {
    expect((await searchCities('aix')).map((c) => c.label)).toEqual([
      "Aix-en-Provence (Bouches-du-Rhône), Provence-Alpes-Côte d'Azur",
      'Aix (Corrèze), Nouvelle-Aquitaine',
    ]);
  });

  it('favorise les pays francophones configurés', async () => {
    expect((await searchCities('brest')).map((c) => c.countryCode)).toEqual(['FR', 'BY']);
  });

  it('trouve par nom alternatif, code postal ou début de mot, sans accents', async () => {
    expect((await searchCities('antwerp'))[0]).toMatchObject({ label: 'Anvers, Flandre', country: 'Belgique' });
    expect((await searchCities('14000'))[0]?.city).toBe('Caen');
    expect((await searchCities('malo'))[0]?.city).toBe('Saint-Malo');
    expect(await searchCities('xyz')).toEqual([]);
  });
});
