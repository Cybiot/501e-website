import sharp from 'sharp';
import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '../src/db.js';
import { app, createUser, loginAs, resetDb } from './helpers.js';

/** Petite image JPEG avec des métadonnées EXIF, pour vérifier leur suppression. */
const jpeg = () =>
  sharp({ create: { width: 300, height: 400, channels: 3, background: '#6b7f3a' } })
    .jpeg()
    .withExif({ IFD0: { Copyright: 'secret-exif' } })
    .toBuffer();

describe('Workflow de modération des images personnalisées', () => {
  beforeEach(resetDb);

  it('envoi → en attente → approbation → affichage public', async () => {
    const member = await createUser('member');
    const admin = await createUser('admin');
    const m = await loginAs(member.discordId);

    const up = await m.agent.post('/api/me/image').set('X-XSRF-TOKEN', m.xsrf).attach('image', await jpeg(), 'photo.jpg');
    expect(up.status).toBe(201);
    expect(up.body.status).toBe('pending');
    expect(await prisma.notification.count({ where: { type: 'image_submitted' } })).toBe(1);

    // L'image en attente n'est pas visible du public ni sur la fiche.
    expect((await request(app).get(up.body.url)).status).toBe(404);
    expect((await request(app).get(`/api/members/${member.id}`)).body.avatarUrl).toBeNull();
    // …mais le membre la voit, sans métadonnées EXIF.
    const own = await m.get(up.body.url);
    expect(own.status).toBe(200);
    const meta = await sharp(own.body as Buffer).metadata();
    expect(meta.format).toBe('webp');
    expect(meta.exif).toBeUndefined();

    const a = await loginAs(admin.discordId);
    const queue = await a.get('/api/admin/moderation');
    expect(queue.body.items).toHaveLength(1);
    expect((await a.post(`/api/admin/moderation/${up.body.id}/approve`)).status).toBe(204);

    const pub = await request(app).get(`/api/members/${member.id}`);
    expect(pub.body.avatarUrl).toBe(up.body.url);
    expect((await request(app).get(up.body.url)).status).toBe(200);
    expect(await prisma.auditLog.count({ where: { action: 'image.approved' } })).toBe(1);

    // La notification indique désormais l'issue de la modération.
    const notif = await prisma.notification.findFirstOrThrow({ where: { type: 'image_submitted' } });
    expect(notif.payload).toMatchObject({ moderation: { status: 'approved', by: admin.displayName } });
  });

  it('rejet avec motif obligatoire, visible par le membre, image précédente conservée', async () => {
    const member = await createUser('member');
    const admin = await createUser('admin');
    const m = await loginAs(member.discordId);
    const a = await loginAs(admin.discordId);

    const first = await m.agent.post('/api/me/image').set('X-XSRF-TOKEN', m.xsrf).attach('image', await jpeg(), 'a.jpg');
    await a.post(`/api/admin/moderation/${first.body.id}/approve`);
    const second = await m.agent.post('/api/me/image').set('X-XSRF-TOKEN', m.xsrf).attach('image', await jpeg(), 'b.jpg');

    expect((await a.post(`/api/admin/moderation/${second.body.id}/reject`, {})).status).toBe(400);
    expect((await a.post(`/api/admin/moderation/${second.body.id}/reject`, { reason: 'Image hors thème' })).status).toBe(204);

    const profile = await m.get('/api/me/profile');
    expect(profile.body.image.rejected.reason).toBe('Image hors thème');
    expect(profile.body.image.approvedUrl).toBe(first.body.url);
    expect(profile.body.image.pending).toBeNull();
  });

  it('refuse un fichier qui n’est pas une image', async () => {
    const member = await createUser('member');
    const m = await loginAs(member.discordId);
    const res = await m.agent
      .post('/api/me/image')
      .set('X-XSRF-TOKEN', m.xsrf)
      .attach('image', Buffer.from('<script>alert(1)</script>'), 'x.jpg');
    expect(res.status).toBe(400);
  });

  it('seuls les admins modèrent', async () => {
    const member = await createUser('member');
    const m = await loginAs(member.discordId);
    expect((await m.get('/api/admin/moderation')).status).toBe(403);
  });
});

describe('Workflow de modération des phrases personnalisées', () => {
  beforeEach(resetDb);

  it('proposition → en attente (non publique) → approbation → affichage public', async () => {
    const member = await createUser('member');
    const admin = await createUser('admin');
    const m = await loginAs(member.discordId);
    const a = await loginAs(admin.discordId);

    const res = await m.patch('/api/me/profile', { tagline: 'Currahee !' });
    expect(res.status).toBe(200);
    expect(res.body.taglinePending).toBe(true);
    expect(await prisma.notification.count({ where: { type: 'tagline_submitted' } })).toBe(1);

    expect((await request(app).get(`/api/members/${member.id}`)).body.tagline).toBeNull();
    const own = await m.get('/api/me/profile');
    expect(own.body.tagline).toBeNull();
    expect(own.body.taglineModeration.pending.text).toBe('Currahee !');

    const queue = await a.get('/api/admin/moderation/taglines');
    expect(queue.body.items).toHaveLength(1);
    expect(queue.body.items[0].text).toBe('Currahee !');

    // Texte différent de celui en attente : refus (le membre l'a modifié entre-temps).
    expect((await a.post(`/api/admin/moderation/taglines/${member.id}/approve`, { text: 'Autre' })).status).toBe(409);
    expect((await a.post(`/api/admin/moderation/taglines/${member.id}/approve`, { text: 'Currahee !' })).status).toBe(204);

    expect((await request(app).get(`/api/members/${member.id}`)).body.tagline).toBe('Currahee !');
    expect((await a.get('/api/admin/moderation/taglines')).body.items).toHaveLength(0);
    expect(await prisma.auditLog.count({ where: { action: 'tagline.approved' } })).toBe(1);
  });

  it('rejet avec motif : la phrase validée reste affichée et le membre voit le motif', async () => {
    const member = await createUser('member');
    const admin = await createUser('admin');
    const m = await loginAs(member.discordId);
    const a = await loginAs(admin.discordId);

    await m.patch('/api/me/profile', { tagline: 'Première' });
    await a.post(`/api/admin/moderation/taglines/${member.id}/approve`, { text: 'Première' });
    await m.patch('/api/me/profile', { tagline: 'Seconde' });

    expect((await a.post(`/api/admin/moderation/taglines/${member.id}/reject`, { text: 'Seconde' })).status).toBe(400);
    const rej = await a.post(`/api/admin/moderation/taglines/${member.id}/reject`, { text: 'Seconde', reason: 'Hors thème' });
    expect(rej.status).toBe(204);

    const own = await m.get('/api/me/profile');
    expect(own.body.tagline).toBe('Première');
    expect(own.body.taglineModeration.pending).toBeNull();
    expect(own.body.taglineModeration.rejected.reason).toBe('Hors thème');
    const notifs = await prisma.notification.findMany({ where: { type: 'tagline_submitted' }, orderBy: { createdAt: 'asc' } });
    expect(notifs.map((n) => (n.payload as { moderation: { status: string } }).moderation.status)).toEqual(['approved', 'rejected']);
    expect(notifs[1]!.payload).toMatchObject({ moderation: { reason: 'Hors thème', by: admin.displayName } });
    expect((await request(app).get(`/api/members/${member.id}`)).body.tagline).toBe('Première');
  });

  it('effacer sa phrase est immédiat et annule la proposition en cours', async () => {
    const member = await createUser('member');
    const admin = await createUser('admin');
    const m = await loginAs(member.discordId);
    const a = await loginAs(admin.discordId);

    await m.patch('/api/me/profile', { tagline: 'Validée' });
    await a.post(`/api/admin/moderation/taglines/${member.id}/approve`, { text: 'Validée' });
    await m.patch('/api/me/profile', { tagline: 'En attente' });

    const res = await m.patch('/api/me/profile', { tagline: null });
    expect(res.body.taglinePending).toBe(false);
    const own = await m.get('/api/me/profile');
    expect(own.body.tagline).toBeNull();
    expect(own.body.taglineModeration.pending).toBeNull();
    expect((await a.post(`/api/admin/moderation/taglines/${member.id}/approve`, { text: 'En attente' })).status).toBe(409);
    const withdrawn = await prisma.notification.findFirstOrThrow({ where: { type: 'tagline_submitted', payload: { path: ['text'], equals: 'En attente' } } });
    expect(withdrawn.payload).toMatchObject({ moderation: { status: 'withdrawn' } });
  });

  it('seuls les admins modèrent les phrases', async () => {
    const member = await createUser('member');
    const m = await loginAs(member.discordId);
    expect((await m.get('/api/admin/moderation/taglines')).status).toBe(403);
    expect((await m.post(`/api/admin/moderation/taglines/${member.id}/approve`, { text: 'x' })).status).toBe(403);
  });
});
