import { randomUUID } from 'node:crypto';
import { beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '../src/db.js';
import { buildAnnouncementMessages, DISCORD_LIMITS } from '../src/lib/announcement.js';
import { createMedal, createUser, loginAs, mockDiscord, resetDb } from './helpers.js';

describe('Attribution de médailles et annonce Discord', () => {
  beforeEach(resetDb);

  async function setup() {
    const admin = await createUser('admin');
    const member = await createUser('member');
    const medal = await createMedal();
    const a = await loginAs(admin.discordId);
    return { admin, member, medal, a };
  }

  it('attribue une médaille, ajoute le rôle Discord et journalise', async () => {
    const { member, medal, a } = await setup();
    const res = await a.post('/api/admin/awards', {
      userId: member.id,
      medalId: medal.id,
      reason: 'Tenue du carrefour.',
      idempotencyKey: randomUUID(),
    });
    expect(res.status).toBe(201);
    expect(res.body.announcedAt).toBeNull();
    const user = await prisma.user.findUniqueOrThrow({ where: { id: member.id } });
    expect(user.discordRoleIds).toContain(medal.discordRoleId);
    expect(await prisma.auditLog.count({ where: { action: 'medal.awarded' } })).toBe(1);
  });

  it('un double-clic ne crée pas deux attributions (idempotence)', async () => {
    const { member, medal, a } = await setup();
    const body = { userId: member.id, medalId: medal.id, reason: 'Double clic', idempotencyKey: randomUUID() };
    const [r1, r2] = await Promise.all([a.post('/api/admin/awards', body), a.post('/api/admin/awards', body)]);
    expect([r1.status, r2.status].sort()).toEqual([200, 201]);
    expect(await prisma.medalAward.count()).toBe(1);
  });

  it('une nouvelle attribution de la même médaille exige une confirmation', async () => {
    const { member, medal, a } = await setup();
    const base = { userId: member.id, medalId: medal.id, reason: 'Première fois' };
    await a.post('/api/admin/awards', { ...base, idempotencyKey: randomUUID() });
    const again = await a.post('/api/admin/awards', { ...base, idempotencyKey: randomUUID() });
    expect(again.status).toBe(409);
    expect(again.body.error.code).toBe('CONFIRM_DUPLICATE');
    const confirmed = await a.post('/api/admin/awards', { ...base, idempotencyKey: randomUUID(), confirmDuplicate: true });
    expect(confirmed.status).toBe(201);
  });

  it('refuse une seconde attribution d’une médaille non cumulable', async () => {
    const { member, a } = await setup();
    const medal = await createMedal({ repeatable: false });
    const base = { userId: member.id, medalId: medal.id, reason: 'Unique' };
    await a.post('/api/admin/awards', { ...base, idempotencyKey: randomUUID() });
    const again = await a.post('/api/admin/awards', { ...base, idempotencyKey: randomUUID(), confirmDuplicate: true });
    expect(again.body.error.code).toBe('ALREADY_AWARDED');
  });

  it("si Discord échoue, rien n'est enregistré et une notification admin est créée", async () => {
    const { member, medal, a } = await setup();
    mockDiscord().failNext = 1;
    const res = await a.post('/api/admin/awards', {
      userId: member.id,
      medalId: medal.id,
      reason: 'Panne',
      idempotencyKey: randomUUID(),
    });
    expect(res.status).toBe(502);
    expect(res.body.error.code).toBe('DISCORD_ERROR');
    expect(await prisma.medalAward.count()).toBe(0);
    expect(await prisma.notification.count({ where: { type: 'discord_error' } })).toBe(1);
  });

  it('annonce toutes les attributions en attente puis les marque annoncées', async () => {
    const { member, medal, a, admin } = await setup();
    for (const reason of ['Motif A', 'Motif B']) {
      await a.post('/api/admin/awards', { userId: member.id, medalId: medal.id, reason, idempotencyKey: randomUUID(), confirmDuplicate: true });
    }
    // Une attribution retirée n'est pas annoncée.
    const revoked = await a.post('/api/admin/awards', { userId: admin.id, medalId: medal.id, reason: 'Retirée', idempotencyKey: randomUUID() });
    expect((await a.delete(`/api/admin/awards/${revoked.body.id}`)).status).toBe(204);

    const pending = await a.get('/api/admin/awards/pending');
    expect(pending.body).toHaveLength(2);

    const preview = await a.get('/api/admin/announcements/preview');
    expect(preview.body.awardsCount).toBe(2);
    expect(preview.body.messages[0].embeds[0].description).toContain('Motif A');

    const res = await a.post('/api/admin/announcements', {});
    expect(res.status).toBe(201);
    expect(res.body.awardsCount).toBe(2);
    expect(mockDiscord().sentMessages).toHaveLength(1);
    expect(mockDiscord().sentMessages[0]!.channelId).toBe('chan-annonces');
    expect(mockDiscord().sentMessages[0]!.payload.mentionUserIds).toEqual([member.discordId]);

    expect((await a.get('/api/admin/awards/pending')).body).toHaveLength(0);
    const again = await a.post('/api/admin/announcements', {});
    expect(again.body.error.code).toBe('NOTHING_TO_ANNOUNCE');
    expect(await prisma.auditLog.count({ where: { action: 'announcement.published' } })).toBe(1);
  });

  it('le retrait du dernier exemplaire retire aussi le rôle Discord', async () => {
    const { member, medal, a } = await setup();
    const r = await a.post('/api/admin/awards', { userId: member.id, medalId: medal.id, reason: 'X', idempotencyKey: randomUUID() });
    await a.delete(`/api/admin/awards/${r.body.id}`);
    const user = await prisma.user.findUniqueOrThrow({ where: { id: member.id } });
    expect(user.discordRoleIds).not.toContain(medal.discordRoleId);
  });

  it('enregistre le palier choisi et affiche le plus haut palier obtenu', async () => {
    const { member, a } = await setup();
    const medal = await createMedal({ tiered: true });
    const award = (tier: string | null, confirmDuplicate?: boolean) =>
      a.post('/api/admin/awards', { userId: member.id, medalId: medal.id, tier, reason: 'Assaut.', idempotencyKey: randomUUID(), confirmDuplicate });

    const first = await award('silver');
    expect(first.status).toBe(201);
    expect(first.body.tier).toBe('silver');
    expect(first.body.medal.imageUrl).toBe('/medailles/test-argent.png');
    expect((await award('bronze', true)).status).toBe(201);

    const card = await a.get(`/api/members/${member.id}`);
    expect(card.body.medals).toEqual([expect.objectContaining({ count: 2, medal: expect.objectContaining({ tier: 'silver', imageUrl: '/medailles/test-argent.png' }) })]);
    expect(card.body.awards.map((w: { medal: { tier: string } }) => w.medal.tier).sort()).toEqual(['bronze', 'silver']);
  });

  it('refuse un palier sur une médaille sans paliers', async () => {
    const { member, medal, a } = await setup();
    const res = await a.post('/api/admin/awards', { userId: member.id, medalId: medal.id, tier: 'gold', reason: 'X.', idempotencyKey: randomUUID() });
    expect(res.status).toBe(400);
    expect(await prisma.medalAward.count()).toBe(0);
  });

  it('mentionne le palier dans l’annonce Discord', () => {
    const [message] = buildAnnouncementMessages(
      [{ id: 'a1', reason: 'Assaut.', tier: 'gold', awardedAt: new Date(), user: { discordId: '1', displayName: 'Winters' }, medal: { id: 'm', name: 'Silver Star', order: 0 } }],
      { mentions: false },
    );
    expect(message!.embeds[0]!.description).toBe('• **Winters** (Or) — Assaut.');
  });

  it('découpe les annonces volumineuses selon les limites Discord', () => {
    const awards = Array.from({ length: 400 }, (_, i) => ({
      id: `a${i}`,
      reason: 'Motif suffisamment long pour remplir rapidement la description de l’embed Discord. '.repeat(2),
      awardedAt: new Date(),
      user: { discordId: `${100000 + i}`, displayName: `Membre ${i}` },
      medal: { id: `m${i % 12}`, name: `Médaille ${i % 12}`, order: i % 12 },
    }));
    const messages = buildAnnouncementMessages(awards, { mentions: true });
    expect(messages.length).toBeGreaterThan(1);
    for (const m of messages) {
      expect(m.embeds.length).toBeLessThanOrEqual(DISCORD_LIMITS.embedsPerMessage);
      const total = m.embeds.reduce((n, e) => n + (e.title?.length ?? 0) + (e.description?.length ?? 0) + (e.footer?.text.length ?? 0), 0);
      expect(total).toBeLessThanOrEqual(DISCORD_LIMITS.embedTotalChars);
      for (const e of m.embeds) expect(e.description!.length).toBeLessThanOrEqual(DISCORD_LIMITS.embedDescription);
      expect((m.content ?? '').length).toBeLessThanOrEqual(DISCORD_LIMITS.content);
    }
    expect(messages.flatMap((m) => m.awardIds)).toHaveLength(400);
  });
});
