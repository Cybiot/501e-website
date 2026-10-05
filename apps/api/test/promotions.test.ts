import { beforeEach, describe, expect, it } from 'vitest';
import { applyMemberInfo } from '../src/auth/sync.js';
import { prisma } from '../src/db.js';
import { createUser, loginAs, mockDiscord, resetDb } from './helpers.js';

describe('Promotions détectées par la synchronisation et annoncées', () => {
  beforeEach(resetDb);

  async function setup() {
    const [pvt, pfc, cpl] = await Promise.all(
      [
        ['Private', 'Pvt.', 10, 'role-pvt'],
        ['Private First Class', 'Pfc.', 20, 'role-pfc'],
        ['Corporal', 'Cpl.', 30, 'role-cpl'],
      ].map(([name, abbreviation, order, discordRoleId]) =>
        prisma.rank.create({ data: { name: name as string, abbreviation: abbreviation as string, order: order as number, discordRoleId: discordRoleId as string } }),
      ),
    );
    const created = await createUser('member');
    const member = await prisma.user.update({
      where: { id: created.id },
      data: { rankId: pvt!.id, lastKnownRankId: pvt!.id, discordRoleIds: ['role-member', 'role-pvt'] },
    });
    /** Simule un événement Discord : le membre a désormais ces rôles. */
    const sync = (...roles: string[]) =>
      applyMemberInfo(member.discordId, { discordId: member.discordId, displayName: member.displayName, avatarUrl: null, roles, joinedAt: null });
    const pending = () => prisma.rankPromotion.findMany({ where: { announcedAt: null }, include: { fromRank: true, toRank: true } });
    return { pvt: pvt!, pfc: pfc!, cpl: cpl!, member, sync, pending };
  }

  it('une montée en grade crée une promotion à annoncer', async () => {
    const { sync, pending } = await setup();
    await sync('role-member', 'role-pfc');
    const [p, ...rest] = await pending();
    expect(rest).toHaveLength(0);
    expect(p!.fromRank?.name).toBe('Private');
    expect(p!.toRank.name).toBe('Private First Class');
  });

  it("détecte la promotion quand l'ancien rôle est retiré avant l'ajout du nouveau", async () => {
    const { sync, pending } = await setup();
    await sync('role-member');
    expect(await pending()).toHaveLength(0);
    await sync('role-member', 'role-pfc');
    expect((await pending()).map((p) => [p.fromRank?.name, p.toRank.name])).toEqual([['Private', 'Private First Class']]);
  });

  it('deux montées avant l’annonce donnent une seule promotion depuis le grade de départ', async () => {
    const { sync, pending } = await setup();
    await sync('role-member', 'role-pfc');
    await sync('role-member', 'role-cpl');
    expect((await pending()).map((p) => [p.fromRank?.name, p.toRank.name])).toEqual([['Private', 'Corporal']]);
  });

  it('un retour au grade précédent (erreur corrigée) annule la promotion', async () => {
    const { sync, pending } = await setup();
    await sync('role-member', 'role-pfc');
    await sync('role-member', 'role-pvt');
    expect(await pending()).toHaveLength(0);
  });

  it("le premier grade connu d'un membre n'est pas une promotion", async () => {
    const { member, sync, pending } = await setup();
    await prisma.user.update({ where: { id: member.id }, data: { rankId: null, lastKnownRankId: null } });
    await sync('role-member', 'role-pfc');
    expect(await pending()).toHaveLength(0);
  });

  it("annonce les promotions dans le salon d'annonce, puis les marque annoncées", async () => {
    const { sync } = await setup();
    const admin = await createUser('admin');
    const a = await loginAs(admin.discordId);
    await sync('role-member', 'role-pfc');

    const list = await a.get('/api/admin/promotions/pending');
    expect(list.body).toHaveLength(1);
    const preview = await a.get('/api/admin/announcements/preview');
    expect(preview.body.promotionsCount).toBe(1);

    const res = await a.post('/api/admin/announcements', {});
    expect(res.status).toBe(201);
    expect(res.body.promotionsCount).toBe(1);
    const [sent] = mockDiscord().sentMessages;
    expect(sent!.channelId).toBe('chan-annonces');
    expect(sent!.payload.embeds[0]!.title).toBe('⬆️ Promotions');
    expect(sent!.payload.embeds[0]!.description).toContain('Private → **Private First Class**');

    expect((await a.get('/api/admin/promotions/pending')).body).toHaveLength(0);
    expect((await a.get('/api/admin/announcements')).body[0].promotions).toEqual([
      expect.objectContaining({ from: 'Private', to: 'Private First Class' }),
    ]);
  });

  it('« Ne pas annoncer » retire la promotion de la file sans rien poster', async () => {
    const { sync } = await setup();
    const admin = await createUser('admin');
    const a = await loginAs(admin.discordId);
    await sync('role-member', 'role-pfc');
    const [p] = (await a.get('/api/admin/promotions/pending')).body;
    expect((await a.delete(`/api/admin/promotions/${p.id}`)).status).toBe(204);
    expect((await a.get('/api/admin/promotions/pending')).body).toHaveLength(0);
    expect((await a.post('/api/admin/announcements', {})).body.error.code).toBe('NOTHING_TO_ANNOUNCE');
    expect(mockDiscord().sentMessages).toHaveLength(0);
  });

  it('un membre parti avant l’annonce n’est pas annoncé', async () => {
    const { sync } = await setup();
    const admin = await createUser('admin');
    const a = await loginAs(admin.discordId);
    await sync('role-member', 'role-pfc');
    await sync();
    expect((await a.get('/api/admin/promotions/pending')).body).toHaveLength(0);
  });
});

describe('Promotion et rétrogradation depuis l’admin', () => {
  beforeEach(resetDb);

  async function setup() {
    const ranks = await Promise.all(
      [
        ['Private First Class', 'Pfc.', 20, 'role-pfc'],
        ['Sergeant', 'Sgt.', 40, 'role-sgt'],
        ['Lieutenant Colonel', 'Lt.Col.', 90, 'role-ltcol'],
        ['Captain', 'Cpt.', 80, null],
      ].map(([name, abbreviation, order, discordRoleId]) =>
        prisma.rank.create({ data: { name: name as string, abbreviation: abbreviation as string, order: order as number, discordRoleId: discordRoleId as string | null } }),
      ),
    );
    const [pfc, sgt, ltcol, cpt] = ranks as [typeof ranks[0], typeof ranks[0], typeof ranks[0], typeof ranks[0]];
    const created = await createUser('member');
    const member = await prisma.user.update({
      where: { id: created.id },
      data: { rankId: pfc.id, lastKnownRankId: pfc.id, discordRoleIds: ['role-member', 'role-pfc', 'role-autre'] },
    });
    const admin = await createUser('admin');
    const a = await loginAs(admin.discordId);
    const pending = () => prisma.rankPromotion.findMany({ where: { announcedAt: null }, include: { fromRank: true, toRank: true } });
    return { pfc, sgt, ltcol, cpt, member, a, pending };
  }

  it('liste les grades attribuables (associés à un rôle Discord), du plus haut au plus bas', async () => {
    const { a } = await setup();
    const res = await a.get('/api/admin/ranks');
    expect(res.body.map((r: { name: string }) => r.name)).toEqual(['Lieutenant Colonel', 'Sergeant', 'Private First Class']);
  });

  it('une promotion peut sauter des grades (Pfc → Sgt) et rejoint la liste « À annoncer »', async () => {
    const { a, member, sgt, pending } = await setup();
    const res = await a.post(`/api/admin/members/${member.id}/rank`, { rankId: sgt.id });
    expect(res.status).toBe(200);
    expect(res.body.direction).toBe('promotion');
    const after = await prisma.user.findUniqueOrThrow({ where: { id: member.id } });
    expect(after.rankId).toBe(sgt.id);
    // Seul le rôle de grade change : les autres rôles sont conservés.
    expect(after.discordRoleIds.sort()).toEqual(['role-autre', 'role-member', 'role-sgt']);
    expect((await pending()).map((p) => [p.fromRank?.name, p.toRank.name])).toEqual([['Private First Class', 'Sergeant']]);
    const log = await prisma.auditLog.findFirst({ where: { action: 'user.promoted' } });
    expect(log?.targetId).toBe(member.id);
  });

  it('une rétrogradation (Lt.Col → Sgt) change le grade sans être annoncée', async () => {
    const { a, member, sgt, ltcol, pending } = await setup();
    await prisma.user.update({
      where: { id: member.id },
      data: { rankId: ltcol.id, lastKnownRankId: ltcol.id, discordRoleIds: ['role-member', 'role-ltcol'] },
    });
    const res = await a.post(`/api/admin/members/${member.id}/rank`, { rankId: sgt.id });
    expect(res.body.direction).toBe('demotion');
    const after = await prisma.user.findUniqueOrThrow({ where: { id: member.id } });
    expect(after.rankId).toBe(sgt.id);
    expect(after.discordRoleIds.sort()).toEqual(['role-member', 'role-sgt']);
    expect(await pending()).toHaveLength(0);
    expect(await prisma.auditLog.count({ where: { action: 'user.demoted' } })).toBe(1);
  });

  it('refuse le grade actuel et un grade sans rôle Discord', async () => {
    const { a, member, pfc, cpt } = await setup();
    expect((await a.post(`/api/admin/members/${member.id}/rank`, { rankId: pfc.id })).body.error.code).toBe('SAME_RANK');
    expect((await a.post(`/api/admin/members/${member.id}/rank`, { rankId: cpt.id })).body.error.code).toBe('RANK_WITHOUT_ROLE');
  });

  it('en cas de panne Discord, rien ne change et l’erreur est signalée', async () => {
    const { a, member, pfc, sgt } = await setup();
    mockDiscord().failNext = 1;
    const res = await a.post(`/api/admin/members/${member.id}/rank`, { rankId: sgt.id });
    expect(res.status).toBe(502);
    expect((await prisma.user.findUniqueOrThrow({ where: { id: member.id } })).rankId).toBe(pfc.id);
  });

  it('réservé aux admins', async () => {
    const { member, sgt } = await setup();
    const m = await loginAs(member.discordId);
    expect((await m.post(`/api/admin/members/${member.id}/rank`, { rankId: sgt.id })).status).toBe(403);
  });
});
