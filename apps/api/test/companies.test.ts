import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '../src/db.js';
import { app, createUser, loginAs, resetDb } from './helpers.js';

/** Compagnie avec deux platoons ; chaque entité a son rôle Discord. */
async function createCompany() {
  return prisma.company.create({
    data: {
      slug: 'steel-hawk',
      name: 'Steel Hawk',
      discordRoleId: 'role-sh',
      platoons: {
        create: [
          { name: 'Soutien', order: 20, discordRoleId: 'role-sh-soutien' },
          { name: 'Assaut', order: 10, discordRoleId: 'role-sh-assaut' },
        ],
      },
    },
  });
}

async function giveRoles(
  userId: string,
  roles: string[],
  opts: { rankOrder?: number; responsibility?: string } = {},
) {
  const r = opts.rankOrder
    ? await prisma.rank.create({
        data: {
          name: `Grade ${opts.rankOrder}`,
          abbreviation: `G${opts.rankOrder}`,
          order: opts.rankOrder,
        },
      })
    : null;
  const resp = opts.responsibility
    ? await prisma.responsibility.upsert({
        where: { name: opts.responsibility },
        update: {},
        create: { name: opts.responsibility, description: '', kind: 'hierarchy' },
      })
    : null;
  await prisma.user.update({
    where: { id: userId },
    data: {
      discordRoleIds: { push: roles },
      rankId: r?.id ?? null,
      ...(resp ? { responsibilities: { create: { responsibilityId: resp.id } } } : {}),
    },
  });
}

describe('Compagnies', () => {
  beforeEach(resetDb);

  it('affiche la compagnie (et le platoon) de chaque membre dans la liste et sur la fiche', async () => {
    await createCompany();
    const [inPlatoon, inCompany, none] = await Promise.all(Array.from({ length: 3 }, () => createUser('member')));
    await giveRoles(inPlatoon!.id, ['role-sh-assaut']);
    await giveRoles(inCompany!.id, ['role-sh']);

    const list = await request(app).get('/api/members');
    const companyOf = (id: string) => list.body.items.find((m: { id: string }) => m.id === id).company;
    expect(companyOf(inPlatoon!.id)).toEqual({ slug: 'steel-hawk', name: 'Steel Hawk', platoon: 'Assaut' });
    expect(companyOf(inCompany!.id)).toEqual({ slug: 'steel-hawk', name: 'Steel Hawk', platoon: null });
    expect(companyOf(none!.id)).toBeNull();

    const detail = await request(app).get(`/api/members/${inPlatoon!.id}`);
    expect(detail.body.company).toEqual({ slug: 'steel-hawk', name: 'Steel Hawk', platoon: 'Assaut' });
  });

  it('groupe les membres : CO/XO, platoons (PL en tête), puis hors platoon', async () => {
    await createCompany();
    const [co, xo, private1, pl, soutien, loose, outsider] = await Promise.all(
      Array.from({ length: 7 }, () => createUser('member')),
    );
    // Le CO reste au commandement même s'il a aussi un rôle de platoon.
    await giveRoles(co!.id, ['role-sh', 'role-sh-assaut'], {
      responsibility: 'CO - Commanding Officer',
    });
    await giveRoles(xo!.id, ['role-sh'], { responsibility: 'XO - Executive Officer' });
    await giveRoles(private1!.id, ['role-sh-assaut'], { rankOrder: 20 });
    // Le PL passe en tête de son platoon, même avec un grade inférieur.
    await giveRoles(pl!.id, ['role-sh-assaut'], {
      rankOrder: 10,
      responsibility: 'PL - Platoon Leader',
    });
    await giveRoles(soutien!.id, ['role-sh', 'role-sh-soutien']);
    await giveRoles(loose!.id, ['role-sh']);

    const res = await request(app).get('/api/companies/steel-hawk');
    expect(res.status).toBe(200);
    expect(res.body.memberCount).toBe(6);
    type Group = { name: string; members: { id: string; command: string | null }[] };
    expect(res.body.groups.map((g: Group) => g.name)).toEqual([
      'Commandement',
      'Assaut',
      'Soutien',
      'Hors platoon',
    ]);
    const members = res.body.groups.flatMap((g: Group) => g.members);
    expect(members.map((m: Group['members'][number]) => [m.id, m.command])).toEqual([
      [co!.id, 'co'],
      [xo!.id, 'xo'],
      [pl!.id, 'pl'],
      [private1!.id, null],
      [soutien!.id, null],
      [loose!.id, null],
    ]);
    expect(members.map((m: { id: string }) => m.id)).not.toContain(outsider!.id);
  });

  it('camp Toccoa : CO/XO avec les instructeurs, membres sans platoon avec les recrues', async () => {
    await prisma.company.create({
      data: {
        slug: 'camp-toccoa',
        name: 'Camp Toccoa',
        discordRoleId: 'role-toccoa',
        platoons: {
          create: [
            { name: 'Instructeurs', order: 10, discordRoleId: 'role-staff-toccoa' },
            { name: 'Recrues', order: 20, discordRoleId: 'role-recrues' },
          ],
        },
      },
    });
    const [co, xo, instructor, recruit, loose] = await Promise.all(Array.from({ length: 5 }, () => createUser('member')));
    await giveRoles(co!.id, ['role-toccoa'], { responsibility: 'CO - Commanding Officer' });
    await giveRoles(xo!.id, ['role-toccoa'], { responsibility: 'XO - Executive Officer' });
    await giveRoles(instructor!.id, ['role-staff-toccoa']);
    await giveRoles(recruit!.id, ['role-toccoa', 'role-recrues']);
    await giveRoles(loose!.id, ['role-toccoa']);

    const res = await request(app).get('/api/companies/camp-toccoa');
    type Group = { name: string; members: { id: string }[] };
    expect(res.body.groups.map((g: Group) => [g.name, g.members.map((m) => m.id)])).toEqual([
      ['Instructeurs', [co!.id, xo!.id, instructor!.id]],
      ['Recrues', expect.arrayContaining([recruit!.id, loose!.id])],
    ]);
  });

  it('rôle de platoon partagé entre compagnies : le platoon se déduit du rôle de la compagnie', async () => {
    await prisma.company.create({
      data: {
        slug: 'blood-wall',
        name: 'Blood Wall',
        order: 10,
        discordRoleId: 'role-bw',
        platoons: { create: [{ name: '1st Platoon', discordRoleId: 'role-1st' }] },
      },
    });
    await prisma.company.create({
      data: {
        slug: 'steel-hawk',
        name: 'Steel Hawk',
        order: 20,
        discordRoleId: 'role-sh',
        platoons: { create: [{ name: '1st Platoon', discordRoleId: 'role-1st' }] },
      },
    });
    const [bw, sh, platoonOnly] = await Promise.all(Array.from({ length: 3 }, () => createUser('member')));
    await giveRoles(bw!.id, ['role-bw', 'role-1st']);
    await giveRoles(sh!.id, ['role-sh', 'role-1st']);
    // Sans rôle de compagnie, « 1st Platoon » ne désigne aucune compagnie.
    await giveRoles(platoonOnly!.id, ['role-1st']);

    const list = await request(app).get('/api/members');
    const companyOf = (id: string) => list.body.items.find((m: { id: string }) => m.id === id).company;
    expect(companyOf(bw!.id)).toEqual({ slug: 'blood-wall', name: 'Blood Wall', platoon: '1st Platoon' });
    expect(companyOf(sh!.id)).toEqual({ slug: 'steel-hawk', name: 'Steel Hawk', platoon: '1st Platoon' });
    expect(companyOf(platoonOnly!.id)).toBeNull();

    const page = await request(app).get('/api/companies/steel-hawk');
    type Group = { name: string; members: { id: string }[] };
    expect(page.body.groups.map((g: Group) => [g.name, g.members.map((m) => m.id)])).toEqual([
      ['1st Platoon', [sh!.id]],
    ]);
  });

  it('respecte les profils masqués pour les visiteurs', async () => {
    await createCompany();
    const hidden = await createUser('member', { publicProfile: false });
    await giveRoles(hidden.id, ['role-sh']);

    expect((await request(app).get('/api/companies/steel-hawk')).body.memberCount).toBe(0);
    const member = await createUser('member');
    const m = await loginAs(member.discordId);
    expect((await m.get('/api/companies/steel-hawk')).body.memberCount).toBe(1);
  });

  it("état-major : Lt.Col/Col d'office et chefs de pôle, affiché seulement sans autre compagnie", async () => {
    await createCompany();
    await prisma.company.create({ data: { slug: 'etat-major', name: 'État-major', order: 0, headquarters: true, discordRoleId: 'role-em' } });
    const colonelRank = await prisma.rank.create({ data: { name: 'Colonel', abbreviation: 'Col.', order: 170, branch: 'staff' } });
    const [colonel, chief, chiefOnly, other] = await Promise.all(Array.from({ length: 4 }, () => createUser('member')));
    await prisma.user.update({ where: { id: colonel!.id }, data: { rankId: colonelRank.id } });
    await giveRoles(chief!.id, ['role-em', 'role-sh-assaut']);
    await giveRoles(chiefOnly!.id, ['role-em']);
    await giveRoles(other!.id, ['role-sh']);

    const list = await request(app).get('/api/members');
    const companyOf = (id: string) => list.body.items.find((m: { id: string }) => m.id === id).company?.slug ?? null;
    expect(companyOf(colonel!.id)).toBe('etat-major');
    expect(companyOf(chief!.id)).toBe('steel-hawk');
    expect(companyOf(chiefOnly!.id)).toBe('etat-major');
    expect(companyOf(other!.id)).toBe('steel-hawk');

    const hq = await request(app).get('/api/companies/etat-major');
    expect(hq.body.groups.map((g: { name: string; members: { id: string }[] }) => [g.name, g.members.map((m) => m.id).sort()])).toEqual([
      ['Commandement', [colonel!.id]],
      ['Chefs de pôle', [chief!.id, chiefOnly!.id].sort()],
    ]);
  });

  it('404 pour une compagnie inconnue', async () => {
    expect((await request(app).get('/api/companies/inconnue')).status).toBe(404);
  });

  it("l'admin associe les rôles et gère les platoons", async () => {
    const company = await prisma.company.create({
      data: { slug: 'blood-wall', name: 'Blood Wall' },
    });
    const admin = await createUser('admin');
    const a = await loginAs(admin.discordId);

    expect(
      (await a.patch(`/api/admin/companies/${company.id}`, { discordRoleId: 'role-bw' })).status,
    ).toBe(200);
    const created = await a.post(`/api/admin/companies/${company.id}/platoons`, {
      name: '1st Platoon',
      order: 10,
      discordRoleId: 'role-bw-1',
    });
    expect(created.status).toBe(201);
    expect(
      (
        await a.post(`/api/admin/companies/${company.id}/platoons`, {
          name: '1st Platoon',
          order: 20,
        })
      ).status,
    ).toBe(409);
    expect(
      (await a.patch(`/api/admin/platoons/${created.body.id}`, { name: '1er Platoon' })).status,
    ).toBe(200);

    const settings = await a.get('/api/admin/settings');
    expect(settings.body.companies[0]).toMatchObject({
      discordRoleId: 'role-bw',
      platoons: [{ name: '1er Platoon', discordRoleId: 'role-bw-1' }],
    });

    expect((await a.delete(`/api/admin/platoons/${created.body.id}`)).status).toBe(204);
    expect(await prisma.platoon.count()).toBe(0);
  });
});
