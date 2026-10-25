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

  const png = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
    'base64',
  );
  const postMedal = (a: Awaited<ReturnType<typeof loginAs>>, name: string) =>
    a.agent
      .post('/api/admin/medals')
      .set('X-XSRF-TOKEN', a.xsrf)
      .field({ name, description: 'Pour bravoure.', category: 'Bravoure' })
      .attach('image', png, 'medaille.png');

  it('crée un rôle Discord sans permission au nom de la nouvelle médaille', async () => {
    const { a } = await setup();
    const res = await postMedal(a, 'Étoile de bronze');
    expect(res.status).toBe(201);
    expect(mockDiscord().createdRoles).toEqual([{ id: expect.any(String), name: 'Étoile de bronze' }]);
    const medal = await prisma.medal.findUniqueOrThrow({ where: { name: 'Étoile de bronze' } });
    expect(medal.discordRoleId).toBe(mockDiscord().createdRoles[0]!.id);
  });

  it('associe un rôle Discord existant (ou aucun) sans en créer, un rôle par médaille', async () => {
    const { a } = await setup();
    const withRole = await postMedal(a, 'Étoile de bronze').field({ discordRoleId: 'role-existant' });
    expect(withRole.status).toBe(201);
    const without = await postMedal(a, 'Purple Heart').field({ discordRoleId: '' });
    expect(without.status).toBe(201);
    expect(mockDiscord().createdRoles).toEqual([]);
    const medal = await prisma.medal.findUniqueOrThrow({ where: { name: 'Étoile de bronze' } });
    expect(medal.discordRoleId).toBe('role-existant');
    expect((await prisma.medal.findUniqueOrThrow({ where: { name: 'Purple Heart' } })).discordRoleId).toBeNull();

    // Le même rôle ne peut pas désigner deux médailles.
    expect((await postMedal(a, 'Silver Star').field({ discordRoleId: 'role-existant' })).status).toBe(409);
    const patch = (body: Record<string, string>) =>
      a.agent.patch(`/api/admin/medals/${medal.id}`).set('X-XSRF-TOKEN', a.xsrf).field(body);
    expect((await patch({ discordRoleId: 'role-autre' })).status).toBe(200);
    expect((await patch({ name: 'Étoile de bronze' })).status).toBe(200);
    expect((await prisma.medal.findUniqueOrThrow({ where: { id: medal.id } })).discordRoleId).toBe('role-autre');
    expect((await patch({ discordRoleId: '' })).status).toBe(200);
    expect((await prisma.medal.findUniqueOrThrow({ where: { id: medal.id } })).discordRoleId).toBeNull();
  });

  it("règle l'échelle de l'image sans toucher aux champs absents d'une modification", async () => {
    const { a, member } = await setup();
    expect((await postMedal(a, 'Grande étoile').field({ imageScale: '400' })).status).toBe(400);
    const created = await postMedal(a, 'Grande étoile').field({ order: '7', imageScale: '180', repeatable: 'false' });
    expect(created.status).toBe(201);
    expect(created.body.imageScale).toBe(180);

    // (Dés)activer n'envoie que isActive : ordre, échelle et cumul sont conservés.
    const patch = (body: Record<string, string>) =>
      a.agent.patch(`/api/admin/medals/${created.body.id}`).set('X-XSRF-TOKEN', a.xsrf).field(body);
    expect((await patch({ isActive: 'false' })).status).toBe(200);
    expect(await prisma.medal.findUniqueOrThrow({ where: { id: created.body.id } })).toMatchObject({
      isActive: false,
      order: 7,
      imageScale: 180,
      repeatable: false,
    });
    expect((await patch({ isActive: 'true', imageScale: '75' })).status).toBe(200);

    // L'échelle accompagne la médaille sur la fiche du membre.
    await a.post('/api/admin/awards', { userId: member.id, medalId: created.body.id, reason: 'Assaut.', idempotencyKey: randomUUID() });
    await a.post('/api/admin/announcements', {});
    const card = await a.get(`/api/members/${member.id}`);
    expect(card.body.medals).toEqual([expect.objectContaining({ medal: expect.objectContaining({ imageScale: 75 }) })]);
  });

  it("modifie le motif d'une attribution, même annoncée, et journalise l'ancien motif", async () => {
    const { member, medal, a } = await setup();
    const award = await a.post('/api/admin/awards', { userId: member.id, medalId: medal.id, reason: 'Motif initial', idempotencyKey: randomUUID() });
    expect((await a.post('/api/admin/announcements', {})).status).toBe(201);

    expect((await a.patch(`/api/admin/awards/${award.body.id}`, { reason: 'x' })).status).toBe(400);
    const res = await a.patch(`/api/admin/awards/${award.body.id}`, { reason: '  Motif corrigé  ' });
    expect(res.status).toBe(200);
    expect(res.body.reason).toBe('Motif corrigé');
    const log = await prisma.auditLog.findFirstOrThrow({ where: { action: 'medal.award_updated' } });
    expect(log.metadata).toMatchObject({ awardId: award.body.id, before: 'Motif initial', after: 'Motif corrigé' });

    // Une attribution désattribuée ne se modifie plus ; un membre ne peut rien modifier.
    expect((await a.delete(`/api/admin/awards/${award.body.id}`)).status).toBe(204);
    expect((await a.patch(`/api/admin/awards/${award.body.id}`, { reason: 'Autre motif' })).status).toBe(404);
    const m = await loginAs(member.discordId);
    expect((await m.patch(`/api/admin/awards/${award.body.id}`, { reason: 'Autre motif' })).status).toBe(403);
  });

  it('associe un rôle Discord à chaque palier, retiré avec les paliers', async () => {
    const { a } = await setup();
    const res = await postMedal(a, 'Distinguished Service Cross')
      .field({
        discordRoleId: 'role-dsc',
        discordRoleBronzeId: 'role-dsc-bronze',
        discordRoleSilverId: 'role-dsc-silver',
        discordRoleGoldId: 'role-dsc-gold',
      })
      .attach('imageBronze', png, 'b.png')
      .attach('imageSilver', png, 's.png')
      .attach('imageGold', png, 'g.png');
    expect(res.status).toBe(201);
    const list = await a.get('/api/admin/medals');
    const dsc = list.body.items.find((m: { name: string }) => m.name === 'Distinguished Service Cross');
    expect(dsc.tierRoles).toEqual({ bronze: 'role-dsc-bronze', silver: 'role-dsc-silver', gold: 'role-dsc-gold' });

    // Un rôle de palier ne peut pas servir à une autre médaille.
    expect((await postMedal(a, 'Silver Star').field({ discordRoleId: 'role-dsc-gold' })).status).toBe(409);
    const patch = (body: Record<string, string>) =>
      a.agent.patch(`/api/admin/medals/${dsc.id}`).set('X-XSRF-TOKEN', a.xsrf).field(body);
    // Ni deux fois dans la même médaille.
    expect((await patch({ discordRoleSilverId: 'role-dsc-bronze' })).status).toBe(409);

    expect((await patch({ removeTiers: 'true' })).status).toBe(200);
    const after = await prisma.medal.findUniqueOrThrow({ where: { id: dsc.id } });
    expect([after.discordRoleId, after.discordRoleBronzeId, after.discordRoleSilverId, after.discordRoleGoldId]).toEqual([
      'role-dsc',
      null,
      null,
      null,
    ]);
  });

  it('importe les médailles portées en rôle Discord, au plus haut palier, sans doublon', async () => {
    const { a, member } = await setup();
    const dsc = await prisma.medal.create({
      data: {
        name: 'Distinguished Service Cross',
        description: 'Bravoure.',
        category: 'Bravoure',
        imageUrl: '/m.png',
        imageBronzeUrl: '/b.png',
        imageSilverUrl: '/s.png',
        imageGoldUrl: '/g.png',
        discordRoleId: 'role-dsc',
        discordRoleBronzeId: 'role-dsc-bronze',
        discordRoleSilverId: 'role-dsc-silver',
        discordRoleGoldId: 'role-dsc-gold',
      },
    });
    const [base, revoked] = await Promise.all([createUser('member'), createUser('member')]);
    const give = (id: string, roles: string[]) => prisma.user.update({ where: { id }, data: { discordRoleIds: { push: roles } } });
    await give(member.id, ['role-dsc', 'role-dsc-bronze', 'role-dsc-silver']);
    await give(base.id, ['role-dsc']);
    await give(revoked.id, ['role-dsc-gold']);
    // Médaille retirée sur le site : le rôle resté sur Discord ne la fait pas revenir.
    await prisma.medalAward.create({ data: { userId: revoked.id, medalId: dsc.id, reason: 'x', revokedAt: new Date() } });

    const res = await a.post('/api/admin/medals/import-roles');
    expect(res.status).toBe(200);
    const awards = await prisma.medalAward.findMany({ where: { medalId: dsc.id, revokedAt: null } });
    expect(awards.map((w) => [w.userId, w.tier, !!w.announcedAt]).sort()).toEqual(
      [
        [member.id, 'silver', true],
        [base.id, null, true],
      ].sort(),
    );
    expect(mockDiscord().sentMessages).toHaveLength(0);

    // Deuxième import : rien de nouveau.
    expect((await a.post('/api/admin/medals/import-roles')).body.awards).toBe(0);
  });

  it("n'enregistre pas la médaille si Discord ne peut pas créer le rôle", async () => {
    const { a } = await setup();
    mockDiscord().failNext = 1;
    const res = await postMedal(a, 'Étoile d’argent');
    expect(res.status).toBe(502);
    expect(await prisma.medal.count({ where: { name: 'Étoile d’argent' } })).toBe(0);
  });

  it('attribue une médaille sans toucher aux rôles Discord et journalise', async () => {
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
    expect(user.discordRoleIds).toEqual(member.discordRoleIds);
    expect(mockDiscord().sentMessages).toHaveLength(0);
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

  it("si Discord échoue pendant l'annonce, rien n'est marqué annoncé et une notification admin est créée", async () => {
    const { member, medal, a } = await setup();
    await a.post('/api/admin/awards', { userId: member.id, medalId: medal.id, reason: 'Panne', idempotencyKey: randomUUID() });
    mockDiscord().failNext = 1;
    const res = await a.post('/api/admin/announcements', {});
    expect(res.status).toBe(502);
    expect(res.body.error.code).toBe('DISCORD_ERROR');
    expect((await a.get('/api/admin/awards/pending')).body).toHaveLength(1);
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
    // Un message par attribution, @here seulement sur le premier.
    const sent = mockDiscord().sentMessages;
    expect(sent).toHaveLength(2);
    expect(sent[0]!.channelId).toBe('chan-annonces');
    expect(sent.map((m) => m.payload.content)).toEqual(['@here\n★★★ MEDAILLE ★★★', '★★★ MEDAILLE ★★★']);
    expect(sent.map((m) => !!m.payload.mentionHere)).toEqual([true, false]);

    expect((await a.get('/api/admin/awards/pending')).body).toHaveLength(0);
    const again = await a.post('/api/admin/announcements', {});
    expect(again.body.error.code).toBe('NOTHING_TO_ANNOUNCE');
    expect(await prisma.auditLog.count({ where: { action: 'announcement.published' } })).toBe(1);
  });

  it("publie dans le salon d'annonce choisi par l'admin", async () => {
    const { member, medal, a } = await setup();
    const channels = await a.get('/api/admin/discord/channels');
    expect(channels.status).toBe(200);
    expect(channels.body).toContainEqual({ id: 'mock-channel-medailles', name: 'médailles', category: '501e' });

    expect((await a.put('/api/admin/settings', { announceChannelId: 'mock-channel-medailles' })).status).toBe(200);
    await a.post('/api/admin/awards', { userId: member.id, medalId: medal.id, reason: 'Assaut.', idempotencyKey: randomUUID() });

    const preview = await a.get('/api/admin/announcements/preview');
    expect(preview.body).toMatchObject({ channelId: 'mock-channel-medailles', channelName: 'médailles' });
    expect((await a.post('/api/admin/announcements', {})).status).toBe(201);
    expect(mockDiscord().sentMessages[0]!.channelId).toBe('mock-channel-medailles');
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
    expect((await a.post('/api/admin/announcements', {})).status).toBe(201);

    const card = await a.get(`/api/members/${member.id}`);
    expect(card.body.medals).toEqual([expect.objectContaining({ count: 2, medal: expect.objectContaining({ tier: 'silver', imageUrl: '/medailles/test-argent.png' }) })]);
    expect(card.body.awards.map((w: { medal: { tier: string } }) => w.medal.tier).sort()).toEqual(['bronze', 'silver']);
  });

  it("une médaille n'est visible sur le site qu'après son annonce Discord", async () => {
    const { member, medal, a } = await setup();
    await a.post('/api/admin/awards', { userId: member.id, medalId: medal.id, reason: 'Officielle à l’annonce.', idempotencyKey: randomUUID() });
    expect((await a.get(`/api/members/${member.id}`)).body.medalsTotal).toBe(0);
    expect((await a.get('/api/admin/medals')).body.items.find((m: { id: string }) => m.id === medal.id).awardsCount).toBe(0);

    await a.post('/api/admin/announcements', {});
    expect((await a.get(`/api/members/${member.id}`)).body.medalsTotal).toBe(1);
    const recipients = await a.get(`/api/admin/medals/${medal.id}/awards`);
    expect(recipients.body.map((r: { member: { id: string } }) => r.member.id)).toEqual([member.id]);
  });

  it('retirer une attribution pas encore annoncée la supprime', async () => {
    const { member, medal, a } = await setup();
    const r = await a.post('/api/admin/awards', { userId: member.id, medalId: medal.id, reason: 'Erreur de saisie.', idempotencyKey: randomUUID() });
    expect((await a.delete(`/api/admin/awards/${r.body.id}`)).status).toBe(204);
    expect(await prisma.medalAward.count()).toBe(0);
    // Plus aucune attribution : la médaille redevient supprimable.
    expect((await a.get('/api/admin/medals')).body.items.find((m: { id: string }) => m.id === medal.id).deletable).toBe(true);
  });

  it('désattribuer une médaille annoncée la retire du site, sans annonce Discord', async () => {
    const { member, medal, a } = await setup();
    const r = await a.post('/api/admin/awards', { userId: member.id, medalId: medal.id, reason: 'Assaut.', idempotencyKey: randomUUID() });
    await a.post('/api/admin/announcements', {});
    const sent = mockDiscord().sentMessages.length;

    expect((await a.delete(`/api/admin/awards/${r.body.id}`)).status).toBe(204);
    expect((await prisma.medalAward.findUniqueOrThrow({ where: { id: r.body.id } })).revokedAt).not.toBeNull();
    expect((await a.get(`/api/members/${member.id}`)).body.medalsTotal).toBe(0);
    expect((await a.get(`/api/admin/medals/${medal.id}/awards`)).body).toHaveLength(0);
    expect((await a.get('/api/admin/awards/pending')).body).toHaveLength(0);
    expect(mockDiscord().sentMessages).toHaveLength(sent);
  });

  it('refuse un palier sur une médaille sans paliers', async () => {
    const { member, medal, a } = await setup();
    const res = await a.post('/api/admin/awards', { userId: member.id, medalId: medal.id, tier: 'gold', reason: 'X.', idempotencyKey: randomUUID() });
    expect(res.status).toBe(400);
    expect(await prisma.medalAward.count()).toBe(0);
  });

  it('annonce une médaille avec son palier, son motif et son image', () => {
    const [message] = buildAnnouncementMessages(
      {
        awards: [
          {
            id: 'a1',
            reason: 'Assaut.',
            tier: 'gold',
            awardedAt: new Date(),
            user: { discordId: '1', displayName: 'Winters' },
            medal: { id: 'm', name: 'Silver Star', order: 0, imageUrl: '/medailles/ss.png', imageBronzeUrl: '/b.png', imageSilverUrl: '/s.png', imageGoldUrl: '/medailles/ss-or.png' },
          },
        ],
      },
      { mentions: true, publicUrl: 'https://501e.example/' },
    );
    expect(message!.content).toBe('★★★ MEDAILLE ★★★');
    expect(message!.embeds[0]).toEqual({
      title: 'Garde à vous !',
      description: [
        'Félicitations au <@1> pour avoir été décoré de : **Silver Star** (Or)',
        '',
        '**Motif :** Assaut.',
        '',
        '⚠️ Voici le logo que vous pouvez mettre sur votre image de profil Discord.',
      ].join('\n'),
      color: expect.any(Number),
      thumbnail: { url: 'https://501e.example/medailles/ss-or.png' },
    });
  });

  it('publie les promotions avant les médailles, un message par élément', () => {
    const user = { discordId: '1', displayName: 'Clark' };
    const messages = buildAnnouncementMessages(
      {
        awards: [{ id: 'a1', reason: 'X.', awardedAt: new Date(), user, medal: { id: 'm', name: 'Parachutist Badge', order: 0, imageUrl: '/medailles/p.png' } }],
        promotions: [
          { id: 'p1', promotedAt: new Date(), user, toRank: { name: 'Private First Class', order: 20, iconUrl: '/insignes/pfc.svg' } },
          { id: 'p2', promotedAt: new Date(), user, toRank: { name: 'Sergeant', order: 50, iconUrl: null } },
        ],
      },
      { mentions: false, here: true, publicUrl: 'https://501e.example' },
    );
    expect(messages.map((m) => [m.content, m.promotionIds, m.awardIds])).toEqual([
      ['@here\n★★★ PROMOTION ★★★', ['p2'], []],
      ['★★★ PROMOTION ★★★', ['p1'], []],
      ['★★★ MEDAILLE ★★★', [], ['a1']],
    ]);
    // Sans image : ni vignette ni ligne sur le logo. Insigne SVG : sa copie PNG (Discord n'affiche pas le SVG).
    expect(messages[0]!.embeds[0]!.thumbnail).toBeUndefined();
    expect(messages[0]!.embeds[0]!.description).toBe('Félicitations au **Clark** pour sa promotion au grade de **Sergeant**.');
    expect(messages[1]!.embeds[0]!.thumbnail).toEqual({ url: 'https://501e.example/insignes/pfc.png' });
    expect(messages[1]!.embeds[0]!.description).toContain('⚠️ Voici le logo que vous pouvez mettre en image de profil Discord.');
  });

  it('respecte les limites Discord même avec un motif très long', () => {
    const [m] = buildAnnouncementMessages(
      { awards: [{ id: 'a', reason: 'x'.repeat(5000), awardedAt: new Date(), user: { discordId: '1', displayName: 'A' }, medal: { id: 'm', name: 'M', order: 0, imageUrl: '/m.png' } }] },
      { mentions: true, here: true },
    );
    expect(m!.embeds[0]!.description!.length).toBeLessThanOrEqual(DISCORD_LIMITS.embedDescription);
    // Sans URL publique, l'image relative ne peut pas être envoyée à Discord.
    expect(m!.embeds[0]!.thumbnail).toBeUndefined();
  });
});
