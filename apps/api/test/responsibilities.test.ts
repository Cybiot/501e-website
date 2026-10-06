import { beforeEach, describe, expect, it } from 'vitest';
import { applyMemberInfo } from '../src/auth/sync.js';
import { prisma } from '../src/db.js';
import { createUser, resetDb } from './helpers.js';

describe('Responsabilités attribuées par la branche du grade', () => {
  beforeEach(resetDb);

  async function setup() {
    const [pfc, sgt, ssgt] = await Promise.all([
      prisma.rank.create({ data: { name: 'Private First Class', abbreviation: 'Pfc.', branch: 'enlisted', order: 20, discordRoleId: 'role-pfc' } }),
      prisma.rank.create({ data: { name: 'Sergeant', abbreviation: 'Sgt.', branch: 'platoon_leader', order: 70, discordRoleId: 'role-sgt' } }),
      prisma.rank.create({ data: { name: 'Staff Sergeant', abbreviation: 'S/Sgt.', branch: 'platoon_leader', order: 80, discordRoleId: 'role-ssgt' } }),
    ]);
    const [pl, recruteur] = await Promise.all([
      // Pas de rôle Discord « Platoon Leader » : uniquement par la branche.
      prisma.responsibility.create({ data: { name: 'PL - Platoon Leader', description: '', kind: 'hierarchy', rankBranch: 'platoon_leader' } }),
      prisma.responsibility.create({ data: { name: 'Recruteur', description: '', kind: 'pole', discordRoleId: 'role-recruteur' } }),
    ]);
    const member = await createUser('member');
    const sync = (roles: string[]) =>
      applyMemberInfo(member.discordId, { discordId: member.discordId, displayName: member.displayName, avatarUrl: null, roles: ['role-member', ...roles], joinedAt: null });
    const responsibilities = async () =>
      (await prisma.userResponsibility.findMany({ where: { userId: member.id }, include: { responsibility: true } }))
        .map((r) => r.responsibility.name)
        .sort();
    return { pfc, sgt, ssgt, pl, recruteur, sync, responsibilities };
  }

  it('un Sgt ou un S/Sgt est Platoon Leader sans rôle Discord dédié', async () => {
    const { sync, responsibilities } = await setup();
    await sync(['role-sgt']);
    expect(await responsibilities()).toEqual(['PL - Platoon Leader']);
    await sync(['role-ssgt', 'role-recruteur']);
    expect(await responsibilities()).toEqual(['PL - Platoon Leader', 'Recruteur']);
  });

  it('perd la responsabilité en changeant de branche, ou sans grade', async () => {
    const { sync, responsibilities } = await setup();
    await sync(['role-sgt']);
    await sync(['role-pfc', 'role-recruteur']);
    expect(await responsibilities()).toEqual(['Recruteur']);
    await sync(['role-sgt']);
    await sync([]);
    expect(await responsibilities()).toEqual([]);
  });
});
