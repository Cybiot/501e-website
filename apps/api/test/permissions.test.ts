import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '../src/db.js';
import { app, createUser, loginAs, resetDb } from './helpers.js';

describe('Authentification et permissions', () => {
  beforeEach(resetDb);

  it('un visiteur est identifié comme tel', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.body).toEqual({ user: null, status: 'visitor' });
  });

  it('refuse les requêtes mutantes sans jeton CSRF', async () => {
    const res = await request(app).post('/api/auth/logout');
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('CSRF');
  });

  it('carte des membres : 401 pour un visiteur, 403 pour un connecté non-membre, 200 pour un membre', async () => {
    expect((await request(app).get('/api/map/members')).status).toBe(401);

    const outsider = await createUser('none');
    const o = await loginAs(outsider.discordId);
    const r1 = await o.get('/api/map/members');
    expect(r1.status).toBe(403);
    expect(r1.body.error.code).toBe('NOT_A_MEMBER');

    const member = await createUser('member');
    const m = await loginAs(member.discordId);
    expect((await m.get('/api/map/members')).status).toBe(200);
  });

  it('un connecté non-membre est traité exactement comme un visiteur', async () => {
    const hidden = await createUser('member', { publicProfile: false });
    const outsider = await createUser('none');
    const o = await loginAs(outsider.discordId);
    expect((await o.get(`/api/members/${hidden.id}`)).status).toBe(404);
    expect((await o.get('/api/me/profile')).status).toBe(403);
    expect((await o.get('/api/admin/dashboard')).status).toBe(403);
  });

  it("l'administration est réservée aux admins", async () => {
    const member = await createUser('member');
    const admin = await createUser('admin');
    expect((await request(app).get('/api/admin/dashboard')).status).toBe(401);
    expect((await (await loginAs(member.discordId)).get('/api/admin/dashboard')).status).toBe(403);
    expect((await (await loginAs(admin.discordId)).get('/api/admin/dashboard')).status).toBe(200);
  });

  it('un membre sans consentement RGPD doit le donner avant d’accéder à son espace', async () => {
    const member = await createUser('member', { consent: false });
    const m = await loginAs(member.discordId);
    const me = await m.get('/api/auth/me');
    expect(me.body.consentRequired).toBe(true);
    expect((await m.get('/api/me/profile')).body.error.code).toBe('CONSENT_REQUIRED');
    const c = await m.post('/api/me/consent', { publicProfile: true, customImage: false, location: false });
    expect(c.status).toBe(204);
    expect((await m.get('/api/me/profile')).status).toBe(200);
    expect(await prisma.consentRecord.count({ where: { userId: member.id } })).toBe(1);
  });

  it('la perte du rôle membre révoque l’accès dès la requête suivante', async () => {
    const member = await createUser('member');
    const m = await loginAs(member.discordId);
    expect((await m.get('/api/map/members')).status).toBe(200);

    // Le bot relaie la perte de rôle.
    const relay = await request(app)
      .post('/internal/discord/member')
      .set('Authorization', 'Bearer test-internal-token-0123456789abcdef')
      .send({ discordId: member.discordId, member: { displayName: 'X', avatarUrl: null, roles: [], joinedAt: null } });
    expect(relay.body.status).toBe('none');

    expect((await m.get('/api/map/members')).status).toBe(403);
    // Profil masqué immédiatement du public.
    expect((await request(app).get(`/api/members/${member.id}`)).status).toBe(404);
  });

  it('les routes internes exigent le jeton partagé', async () => {
    const res = await request(app).post('/internal/discord/member').send({ discordId: 'x', member: null });
    expect(res.status).toBe(401);
  });

  it('un profil masqué est invisible du public mais visible des membres', async () => {
    const hidden = await createUser('member', { publicProfile: false });
    await createUser('member');
    const list = await request(app).get('/api/members');
    expect(list.body.items.map((i: { id: string }) => i.id)).not.toContain(hidden.id);
    expect((await request(app).get(`/api/members/${hidden.id}`)).status).toBe(404);

    const viewer = await createUser('member');
    const v = await loginAs(viewer.discordId);
    expect((await v.get(`/api/members/${hidden.id}`)).status).toBe(200);
  });

  it("aucune donnée privée (villes, rôles Discord) n'apparaît dans la fiche publique", async () => {
    const member = await createUser('member');
    await prisma.memberLocation.create({
      data: { userId: member.id, cityLabel: 'Caen', country: 'France', lat: 49.18, lng: -0.37 },
    });
    const res = await request(app).get(`/api/members/${member.id}`);
    const body = JSON.stringify(res.body);
    expect(body).not.toContain('Caen');
    expect(body).not.toContain('role-member');
    expect(body).not.toContain(member.discordId);
  });
});
