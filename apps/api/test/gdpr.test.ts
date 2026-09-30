import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '../src/db.js';
import { app, createUser, loginAs, resetDb } from './helpers.js';

describe('Droits RGPD et bouton Rejoindre', () => {
  beforeEach(resetDb);

  it('exporte les données du membre en JSON', async () => {
    const member = await createUser('member');
    const m = await loginAs(member.discordId);
    const res = await m.get('/api/me/export');
    expect(res.status).toBe(200);
    expect(res.headers['content-disposition']).toContain('attachment');
    expect(res.body.identity.discordId).toBe(member.discordId);
  });

  it('supprime le compte et anonymise le journal', async () => {
    const member = await createUser('member');
    const m = await loginAs(member.discordId);
    expect((await m.delete('/api/me', { confirm: 'NON' })).status).toBe(400);
    expect((await m.delete('/api/me', { confirm: 'SUPPRIMER' })).status).toBe(204);
    expect(await prisma.user.findUnique({ where: { id: member.id } })).toBeNull();
    expect(await prisma.auditLog.count({ where: { actorId: member.id } })).toBe(0);
    expect(await prisma.auditLog.count({ where: { actorHash: { not: null } } })).toBeGreaterThan(0);
    expect((await m.get('/api/auth/me')).body.status).toBe('visitor');
  });

  it('le clic sur Rejoindre redirige vers l’invitation et notifie les admins, sans IP', async () => {
    const res = await request(app).get('/api/join');
    expect(res.status).toBe(302);
    expect(res.headers.location).toBe('https://discord.gg/test');
    await request(app).get('/api/join');
    const notifs = await prisma.notification.findMany({ where: { type: 'join_click' } });
    // Les clics rapprochés sont regroupés (anti-flood).
    expect(notifs).toHaveLength(1);
    expect((notifs[0]!.payload as { count: number }).count).toBe(2);
    expect(JSON.stringify(notifs[0]!.payload)).not.toMatch(/127\.0\.0\.1|::1|ffff/);
  });
});
