import { beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '../src/db.js';
import { refreshRankPrefixes, stripRankPrefix } from '../src/lib/rank-prefix.js';
import { app, createUser, resetDb } from './helpers.js';
import request from 'supertest';

const RANKS: [string, string, number][] = [
  ['Private', 'Pvt.', 10],
  ['Technician Fifth Grade', 'T/5.', 40],
  ['Sergeant First Class', 'Sfc.', 90],
  ['1st Sergeant', '1/Sgt.', 100],
  ['Colonel', 'Col.', 170],
  ['Lieutenant Colonel', 'Lt.Col.', 160],
];

describe('Préfixe de grade dans le pseudo Discord', () => {
  beforeEach(async () => {
    await resetDb();
    await prisma.rank.createMany({ data: RANKS.map(([name, abbreviation, order]) => ({ name, abbreviation, order })) });
    await refreshRankPrefixes();
  });

  it.each([
    ['Sfc. Walter Kloux', 'Walter Kloux'],
    ['SFC Walter Kloux', 'Walter Kloux'],
    ['T/5. Toye', 'Toye'],
    ['1/Sgt. Lipton', 'Lipton'],
    ['Lt.Col. Strayer', 'Strayer'],
    ['Col. Sink', 'Sink'],
  ])('retire le grade de « %s »', (name, expected) => {
    expect(stripRankPrefix(name)).toBe(expected);
  });

  it.each([
    ['Colin Dupont'], // « Col » sans séparateur : ce n'est pas un grade
    ['Pvt.'], // pseudo réduit au grade : on le garde tel quel
    ['Walter Sfc. Kloux'],
  ])('laisse « %s » intact', (name) => {
    expect(stripRankPrefix(name)).toBe(name);
  });

  it('affiche le nom sans grade dans la liste publique, la base garde le pseudo complet', async () => {
    const user = await createUser('member');
    await prisma.user.update({ where: { id: user.id }, data: { displayName: 'Sfc. Walter Kloux' } });
    const res = await request(app).get('/api/members');
    expect(res.status).toBe(200);
    expect(res.body.items.map((m: { displayName: string }) => m.displayName)).toContain('Walter Kloux');
    const stored = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(stored.displayName).toBe('Sfc. Walter Kloux');
  });
});
