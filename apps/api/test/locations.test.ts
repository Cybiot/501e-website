import { beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '../src/db.js';
import { createUser, loginAs, resetDb } from './helpers.js';

const city = (label: string) => ({ cityLabel: label, country: 'France', lat: 49.182863, lng: -0.370679 });

describe('Carte : quota de 2 villes et précision « ville »', () => {
  beforeEach(resetDb);

  it('refuse une 3ᵉ ville avec un message clair', async () => {
    const member = await createUser('member');
    const m = await loginAs(member.discordId);
    expect((await m.post('/api/me/locations', city('Caen'))).status).toBe(201);
    expect((await m.post('/api/me/locations', city('Bayeux'))).status).toBe(201);
    const third = await m.post('/api/me/locations', city('Carentan'));
    expect(third.status).toBe(409);
    expect(third.body.error.code).toBe('LOCATION_LIMIT');
    expect(third.body.error.message).toMatch(/2 villes/);
    expect(await prisma.memberLocation.count({ where: { userId: member.id } })).toBe(2);
  });

  it('résiste à des ajouts simultanés', async () => {
    const member = await createUser('member');
    const m = await loginAs(member.discordId);
    const results = await Promise.all(['A', 'B', 'C', 'D'].map((l) => m.post('/api/me/locations', city(l))));
    expect(results.filter((r) => r.status === 201)).toHaveLength(2);
    expect(await prisma.memberLocation.count({ where: { userId: member.id } })).toBe(2);
  });

  it('le trigger en base bloque aussi une 3ᵉ ville', async () => {
    const member = await createUser('member');
    const data = { userId: member.id, country: 'France', lat: 1, lng: 1 };
    await prisma.memberLocation.create({ data: { ...data, cityLabel: 'A' } });
    await prisma.memberLocation.create({ data: { ...data, cityLabel: 'B' } });
    await expect(prisma.memberLocation.create({ data: { ...data, cityLabel: 'C' } })).rejects.toThrow();
  });

  it('ne stocke jamais de coordonnées précises', async () => {
    const member = await createUser('member');
    const m = await loginAs(member.discordId);
    const res = await m.post('/api/me/locations', city('Caen'));
    const decimals = (n: number) => (String(n).split('.')[1] ?? '').length;
    expect(decimals(res.body.lat)).toBeLessThanOrEqual(3);
    expect(Math.abs(res.body.lat - 49.182863)).toBeLessThan(0.03);
    expect(res.body.lat).not.toBe(49.182863);
  });

  it('exige un consentement explicite (opt-in)', async () => {
    const member = await createUser('member');
    await prisma.user.update({ where: { id: member.id }, data: { consentLocation: false } });
    const m = await loginAs(member.discordId);
    const refused = await m.post('/api/me/locations', city('Caen'));
    expect(refused.body.error.code).toBe('CONSENT_LOCATION_REQUIRED');
    expect((await m.post('/api/me/locations', { ...city('Caen'), consent: true })).status).toBe(201);
  });

  it('le retrait du consentement supprime immédiatement les villes', async () => {
    const member = await createUser('member');
    const m = await loginAs(member.discordId);
    await m.post('/api/me/locations', city('Caen'));
    await m.patch('/api/me/profile', { consentLocation: false });
    expect(await prisma.memberLocation.count({ where: { userId: member.id } })).toBe(0);
  });

  it('un membre ne peut supprimer que ses propres villes', async () => {
    const a = await createUser('member');
    const b = await createUser('member');
    const loc = await prisma.memberLocation.create({
      data: { userId: a.id, cityLabel: 'Caen', country: 'France', lat: 1, lng: 1 },
    });
    const mb = await loginAs(b.discordId);
    expect((await mb.delete(`/api/me/locations/${loc.id}`)).status).toBe(404);
    const ma = await loginAs(a.discordId);
    expect((await ma.delete(`/api/me/locations/${loc.id}`)).status).toBe(204);
  });
});
