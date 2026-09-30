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
