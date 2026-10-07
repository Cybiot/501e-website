import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { applyMemberInfo } from '../src/auth/sync.js';
import { prisma } from '../src/db.js';
import { app, createUser, resetDb } from './helpers.js';

describe('Vétérans (anciens membres)', () => {
  beforeEach(resetDb);

  async function setup() {
    const [vet, pvt, pfc] = await Promise.all(
      [
        ['Vétéran', 'Vet.', 0, 'role-veteran', 'veteran'],
        ['Private', 'Pvt.', 10, 'role-pvt', 'toccoa'],
        ['Private First Class', 'Pfc.', 20, 'role-pfc', 'enlisted'],
      ].map(([name, abbreviation, order, discordRoleId, branch]) =>
        prisma.rank.create({
          data: { name: name as string, abbreviation: abbreviation as string, order: order as number, discordRoleId: discordRoleId as string, branch: branch as 'veteran' },
        }),
      ),
    );
    const created = await createUser('none');
    /** Simule un événement Discord : l'utilisateur a désormais ces rôles. */
    const sync = (...roles: string[]) =>
      applyMemberInfo(created.discordId, { discordId: created.discordId, displayName: created.displayName, avatarUrl: null, roles, joinedAt: null });
    return { vet: vet!, pvt: pvt!, pfc: pfc!, user: created, sync };
  }

  it('le rôle Vétéran donne le statut membre et le grade « Vet. », sans le rôle 501e', async () => {
    const { vet, sync } = await setup();
    const u = await sync('role-veteran');
    expect(u!.status).toBe('member');
    expect(u!.rankId).toBe(vet.id);
    expect(u!.leftAt).toBeNull();
  });

  it('un vétéran ayant gardé un ancien rôle de grade reste « Vet. »', async () => {
    const { vet, sync } = await setup();
    const u = await sync('role-veteran', 'role-pfc');
    expect(u!.rankId).toBe(vet.id);
  });

  it("le passage en vétéran puis le retour au 501e ne sont pas des promotions", async () => {
    const { sync } = await setup();
    await sync('role-member', 'role-pfc');
    await sync('role-veteran');
    await sync('role-member', 'role-pvt');
    expect(await prisma.rankPromotion.count()).toBe(0);
  });

  it('les vétérans sont listés tout en bas, sous les Pvt et les membres sans grade', async () => {
    const { vet, pvt, pfc, sync } = await setup();
    await sync('role-veteran');
    const make = async (rankId: string | null) => {
      const u = await createUser('member');
      return prisma.user.update({ where: { id: u.id }, data: { rankId } });
    };
    const withPvt = await make(pvt.id);
    const withPfc = await make(pfc.id);
    const noRank = await make(null);
    const res = await request(app).get('/api/members');
    const ids = res.body.items.map((m: { id: string }) => m.id);
    const veteran = await prisma.user.findFirstOrThrow({ where: { rankId: vet.id } });
    expect(ids).toEqual([withPfc.id, withPvt.id, noRank.id, veteran.id]);
  });
});
