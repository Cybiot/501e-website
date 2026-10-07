/**
 * Données de démonstration (entièrement fictives).
 * Comptes de connexion démo : demo-admin (Admin), demo-membre (Membre, consentement à donner),
 * demo-visiteur (connecté sans rôle membre → traité comme un visiteur), demo-veteran (Vétéran : accès membre).
 */
import { PrismaClient, type MedalTier } from '@prisma/client';
import { MEDAL_CATALOG, medalImages } from '../src/data/medals.js';
import {
  MOCK_COMPANY_ROLES,
  MOCK_PLATOON_ROLES,
  MOCK_RANK_ROLES,
  MOCK_RESPONSIBILITY_ROLES,
  MOCK_ROLES,
} from '../src/discord/mock-data.js';

const prisma = new PrismaClient();
const CONSENT_VERSION = '2026-09-v1';

/** Du plus bas au plus haut : [slug de l’insigne, nom, abréviation, branche]. */
const RANKS = [
  ['pvt', 'Private', 'Pvt.', 'toccoa'],
  ['pfc', 'Private First Class', 'Pfc.', 'enlisted'],
  ['cpl', 'Corporal', 'Cpl.', 'enlisted'],
  ['t5', 'Technician Fifth Grade', 'T/5.', 'enlisted'],
  ['t4', 'Technician Fourth Grade', 'T/4.', 'enlisted'],
  ['t3', 'Technician Third Grade', 'T/3.', 'enlisted'],
  ['sgt', 'Sergeant', 'Sgt.', 'platoon_leader'],
  ['ssgt', 'Staff Sergeant', 'S/Sgt.', 'platoon_leader'],
  ['sfc', 'Sergeant First Class', 'Sfc.', 'platoon_leader'],
  ['1sgt', '1st Sergeant', '1/Sgt.', 'xo'],
  ['msgt', 'Master Sergeant', 'M/Sgt.', 'xo'],
  ['2lt', '2nd Lieutenant', '2Lt.', 'xo'],
  ['1lt', '1st Lieutenant', '1Lt.', 'co'],
  ['cpt', 'Captain', 'Cpt.', 'co'],
  ['mjr', 'Major', 'Mjr.', 'co'],
  ['ltcol', 'Lieutenant Colonel', 'Lt.Col.', 'staff'],
  ['col', 'Colonel', 'Col.', 'staff'],
] as const;

const RESPONSIBILITIES = [
  ['em', 'EM - État-major', 'Direction de la communauté : décisions, organisation générale et arbitrages.', 'hierarchy'],
  ['co', 'CO - Commanding Officer', 'Commande le régiment et fixe les orientations en opération.', 'hierarchy'],
  ['xo', 'XO - Executive Officer', 'Seconde le CO et le remplace en son absence.', 'hierarchy'],
  ['pl', 'PL - Platoon Leader', 'Commande un peloton lors des opérations.', 'hierarchy'],
  ['toccoa', 'Staff Toccoa', 'Encadre la formation des recrues au camp Toccoa.', 'pole'],
  ['recr', 'Recruteur', 'Accueille les candidats, mène les entretiens et les accompagne jusqu’à la formation initiale.', 'pole'],
  ['event', 'Organisateur Event', 'Prépare et anime les événements et opérations spéciales.', 'pole'],
  ['medailles', 'Komité des médailles', 'Étudie les propositions de décorations et prépare les attributions.', 'pole'],
  ['mp', 'Police militaire', 'Veille au respect du règlement sur le Discord et en jeu.', 'pole'],
] as const;

/** Palier tiré au hasard pour les médailles à paliers (null : image de base). */
const TIERS: (MedalTier | null)[] = [null, 'bronze', 'silver', 'gold'];

const FIRST = ['Julien', 'Maxime', 'Lucas', 'Thomas', 'Hugo', 'Antoine', 'Nicolas', 'Alexandre', 'Mathieu', 'Kevin', 'Romain', 'Clément', 'Louis', 'Arthur', 'Baptiste', 'Quentin', 'Samuel', 'Florian', 'Adrien', 'Victor'];
const LAST = ['Martin', 'Bernard', 'Dubois', 'Laurent', 'Moreau', 'Lefèvre', 'Garnier', 'Rousseau', 'Faure', 'Mercier', 'Blanc', 'Guérin', 'Boyer', 'Chevalier', 'Perrin', 'Morin', 'Roux', 'Fournier', 'Girard', 'Lambert'];

const CITIES: [string, string, number, number][] = [
  ['Caen, Normandie', 'France', 49.18, -0.37],
  ['Paris, Île-de-France', 'France', 48.86, 2.35],
  ['Lyon, Auvergne-Rhône-Alpes', 'France', 45.76, 4.84],
  ['Lille, Hauts-de-France', 'France', 50.63, 3.06],
  ['Bordeaux, Nouvelle-Aquitaine', 'France', 44.84, -0.58],
  ['Toulouse, Occitanie', 'France', 43.6, 1.44],
  ['Rennes, Bretagne', 'France', 48.12, -1.68],
  ['Strasbourg, Grand Est', 'France', 48.57, 7.75],
  ['Marseille, Provence-Alpes-Côte d’Azur', 'France', 43.3, 5.37],
  ['Nantes, Pays de la Loire', 'France', 47.22, -1.55],
  ['Bruxelles, Bruxelles-Capitale', 'Belgique', 50.85, 4.35],
  ['Liège, Wallonie', 'Belgique', 50.63, 5.58],
  ['Genève, Genève', 'Suisse', 46.2, 6.14],
  ['Lausanne, Vaud', 'Suisse', 46.52, 6.63],
  ['Montréal, Québec', 'Canada', 45.5, -73.57],
  ['Québec, Québec', 'Canada', 46.81, -71.21],
  ['Luxembourg, Luxembourg', 'Luxembourg', 49.61, 6.13],
  ['Grenoble, Auvergne-Rhône-Alpes', 'France', 45.19, 5.72],
];

const NICKNAMES = ['Actif', 'Tank', 'Doc', 'Radio', 'Bulldog', 'Ghost', 'Brindille', 'Tonnerre', 'Moustache', 'Kiwi', 'Rocky', 'Biscuit', 'Fennec', 'Loup', 'Sparrow', 'Gamelle'];

const TAGLINES = [
  'Currahee ! On monte, on tient, on ne recule pas.',
  'Toujours le premier dans la haie, le dernier à la radio.',
  'Un bon para est un para qui a vérifié son parachute deux fois.',
  'Ici pour la camaraderie, resté pour les soirées opé.',
  'Le calme avant le saut.',
  'Pas de héros, juste une escouade.',
  'La radio grésille, mais le moral tient.',
  null,
  'Sergent un jour, sergent toujours.',
  'Carte, boussole, café.',
];

const REASONS = [
  'A tenu le carrefour seul pendant dix minutes sous le feu ennemi.',
  'Excellente coordination radio lors de l’opération du samedi.',
  'Évacuation de trois blessés sous le feu.',
  'Présence exemplaire et fair-play tout au long de la saison.',
  'Prise de la batterie d’artillerie en flanquant par le bocage.',
  'A formé la nouvelle promotion de recrues.',
  'Participation à toutes les sessions de la campagne.',
];

/** Générateur pseudo-aléatoire déterministe (le seed produit toujours les mêmes données). */
let s = 501;
const rand = () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646;
const pick = <T>(arr: readonly T[]) => arr[Math.floor(rand() * arr.length)]!;

async function main() {
  console.log('Seed : nettoyage…');
  await prisma.$transaction([
    prisma.medalAward.deleteMany(),
    prisma.rankPromotion.deleteMany(),
    prisma.announcement.deleteMany(),
    prisma.memberLocation.deleteMany(),
    prisma.consentRecord.deleteMany(),
    prisma.userResponsibility.deleteMany(),
    prisma.profile.deleteMany(),
    prisma.customImage.deleteMany(),
    prisma.session.deleteMany(),
    prisma.notification.deleteMany(),
    prisma.auditLog.deleteMany(),
    prisma.user.deleteMany(),
    prisma.medal.deleteMany(),
    prisma.rank.deleteMany(),
    prisma.responsibility.deleteMany(),
    prisma.setting.deleteMany(),
  ]);

  const ranks = await Promise.all(
    RANKS.map(([slug, name, abbreviation, branch], i) =>
      prisma.rank.create({
        data: { name, abbreviation, branch, order: (i + 1) * 10, discordRoleId: MOCK_RANK_ROLES[i]!.id, iconUrl: `/insignes/${slug}.svg` },
      }),
    ),
  );
  // Anciens membres, sous le Private ; leur rôle « Vétéran » remplace le rôle « 501e ».
  const veteranRank = await prisma.rank.create({
    data: { name: 'Vétéran', abbreviation: 'Vet.', branch: 'veteran', order: 0, discordRoleId: MOCK_ROLES.veteran.id },
  });
  const resps = await Promise.all(
    RESPONSIBILITIES.map(([key, name, description, kind], i) =>
      prisma.responsibility.create({
        data: {
          name,
          description,
          kind,
          order: i,
          discordRoleId: MOCK_RESPONSIBILITY_ROLES.find((r) => r.key === key)?.id ?? null,
          // Pas de rôle Discord « Platoon Leader » : donné d'office aux Sgt, S/Sgt et Sfc.
          rankBranch: key === 'pl' ? 'platoon_leader' : null,
        },
      }),
    ),
  );
  const medals = await Promise.all(
    MEDAL_CATALOG.map((m, i) =>
      prisma.medal.create({
        data: {
          name: m.name,
          category: m.category,
          description: m.description,
          repeatable: m.repeatable,
          order: (i + 1) * 10,
          ...medalImages(m),
        },
      }),
    ),
  );

  // Compagnies (créées par la migration) : rôles fictifs et platoons de démo.
  // Les instructeurs du camp Toccoa sont reconnus par le rôle « Staff Toccoa ».
  const staffToccoa = MOCK_RESPONSIBILITY_ROLES.find((r) => r.key === 'toccoa')!.id;
  const platoonRoles = [...MOCK_PLATOON_ROLES, { slug: 'camp-toccoa', platoon: 'Instructeurs', id: staffToccoa }];
  await prisma.platoon.updateMany({ data: { discordRoleId: null } });
  for (const c of MOCK_COMPANY_ROLES) {
    await prisma.company.update({ where: { slug: c.slug }, data: { discordRoleId: c.id } });
  }
  // État-major : les chefs de pôle portent le rôle « EM - État-major » (Lt.Col et Col y sont d'office).
  await prisma.company.update({
    where: { slug: 'etat-major' },
    data: { discordRoleId: MOCK_RESPONSIBILITY_ROLES.find((r) => r.key === 'em')!.id },
  });
  for (const [i, p] of platoonRoles.entries()) {
    const company = await prisma.company.findUniqueOrThrow({ where: { slug: p.slug } });
    await prisma.platoon.upsert({
      where: { companyId_name: { companyId: company.id, name: p.platoon } },
      update: { discordRoleId: p.id },
      create: { companyId: company.id, name: p.platoon, order: (i + 1) * 10, discordRoleId: p.id },
    });
  }

  type SeedUser = {
    discordId: string;
    name: string;
    rank: number;
    admin?: boolean;
    resp?: number[];
    roles?: string[];
    consent?: boolean;
    member?: boolean;
    veteran?: boolean;
    hidden?: boolean;
  };
  const users: SeedUser[] = [
    { discordId: 'demo-admin', name: 'Cpt. Winters (démo admin)', rank: 13, admin: true, resp: [0] },
    { discordId: 'demo-membre', name: 'Pvt. Blithe (démo membre)', rank: 0, consent: false },
    { discordId: 'demo-visiteur', name: 'Curieux (démo non-membre)', rank: -1, member: false },
    { discordId: 'demo-veteran', name: 'Vet. Nixon (démo vétéran)', rank: -1, veteran: true },
  ];
  const RESP = Object.fromEntries(RESPONSIBILITIES.map(([key], i) => [key, i])) as Record<
    (typeof RESPONSIBILITIES)[number][0],
    number
  >;
  const POLES = [RESP.recr, RESP.event, RESP.medailles, RESP.mp];
  const companyRole = (slug: string) => MOCK_COMPANY_ROLES.find((c) => c.slug === slug)!.id;
  let n = 0;
  const addUser = (rank: number, extra: Omit<SeedUser, 'discordId' | 'name' | 'rank'> = {}) => {
    // Paires prénom/nom toutes différentes (20 × 20 combinaisons).
    const first = FIRST[n % FIRST.length]!;
    const last = LAST[(n * 3 + Math.floor(n / FIRST.length)) % LAST.length]!;
    // Initiale d'un deuxième prénom et surnom : facultatifs, comme sur Discord.
    const middle = rand() < 0.3 ? ` ${'ABCDEFGHJLMPRT'[Math.floor(rand() * 14)]}.` : '';
    const nickname = rand() < 0.5 ? ` "${pick(NICKNAMES)}"` : '';
    n++;
    users.push({
      discordId: `demo-${String(n).padStart(3, '0')}`,
      // Format Discord : « Grade Prénom(s) Nom "Surnom" », ex. « T/4. Walter J. Cabezas "Actif" ».
      name: `${extra.veteran ? veteranRank.abbreviation : RANKS[rank]![2]} ${first}${middle} ${last}${nickname}`,
      rank,
      ...extra,
    });
  };
  const randomRank = (min: number, max: number) => min + Math.floor(rand() * (max - min + 1));
  const randomPole = () => (rand() < 0.2 ? [POLES[Math.floor(rand() * POLES.length)]!] : []);

  // État-major, hors compagnie.
  addUser(16, { resp: [RESP.em], admin: true });
  addUser(15, { resp: [RESP.em] });

  // Chaque compagnie : 1 CO, 1 XO, puis 2 platoons de 1 PL + 5 membres.
  for (const c of MOCK_COMPANY_ROLES.filter((c) => c.slug !== 'camp-toccoa')) {
    addUser(13, { resp: [RESP.co], roles: [companyRole(c.slug)] });
    addUser(11, { resp: [RESP.xo], roles: [companyRole(c.slug)] });
    for (const p of MOCK_PLATOON_ROLES.filter((p) => p.slug === c.slug)) {
      const roles = [companyRole(c.slug), p.id];
      addUser(randomRank(6, 8), { resp: [RESP.pl], roles });
      for (let i = 0; i < 5; i++) {
        // Le premier membre de chaque platoon est aussi instructeur au camp Toccoa.
        addUser(randomRank(1, 5), { resp: i === 0 ? [RESP.toccoa] : randomPole(), roles });
      }
    }
  }

  // Camp Toccoa : recrues (les instructeurs y apparaissent via le rôle Staff Toccoa).
  const recruits = MOCK_PLATOON_ROLES.find((p) => p.slug === 'camp-toccoa')!.id;
  users[1]!.roles = [companyRole('camp-toccoa'), recruits];
  for (let i = 0; i < 6; i++) {
    addUser(0, { roles: [companyRole('camp-toccoa'), recruits], hidden: i === 2 || i === 5 });
  }

  // Vétérans : anciens membres, sans rôle « 501e » ni grade actif.
  for (let i = 0; i < 3; i++) addUser(-1, { veteran: true });

  let created = 0;
  for (const [idx, u] of users.entries()) {
    const isMember = u.member !== false;
    const rankId = u.veteran ? veteranRank.id : u.rank >= 0 ? ranks[u.rank]!.id : null;
    const roles = isMember
      ? [
          u.veteran ? MOCK_ROLES.veteran.id : MOCK_ROLES.member.id,
          ...(u.admin ? [MOCK_ROLES.admin.id] : []),
          ...(u.rank >= 0 ? [MOCK_RANK_ROLES[u.rank]!.id] : []),
          ...(u.resp ?? []).flatMap((r) => MOCK_RESPONSIBILITY_ROLES.find((m) => m.key === RESPONSIBILITIES[r]![0])?.id ?? []),
          ...(u.roles ?? []),
        ]
      : [];
    const joinedAt = new Date(Date.now() - Math.floor(30 + rand() * 900) * 24 * 3600 * 1000);
    const consent = isMember && u.consent !== false;
    const user = await prisma.user.create({
      data: {
        discordId: u.discordId,
        displayName: u.name,
        discordAvatarUrl: null,
        status: !isMember ? 'none' : u.admin ? 'admin' : 'member',
        discordRoleIds: roles,
        rankId: isMember ? rankId : null,
        lastKnownRankId: isMember ? rankId : null,
        joinedAt: isMember ? joinedAt : null,
        rolesSyncedAt: new Date(),
        publicProfileEnabled: !u.hidden,
        consentAcceptedAt: consent ? joinedAt : null,
        consentVersion: consent ? CONSENT_VERSION : null,
        consentLocation: consent,
        consentCustomImage: consent,
        responsibilities: { create: (u.resp ?? []).map((r) => ({ responsibilityId: resps[r]!.id })) },
        profile: isMember ? { create: { tagline: pick(TAGLINES) } } : undefined,
      },
    });
    if (consent) {
      await prisma.consentRecord.create({
        data: { userId: user.id, version: CONSENT_VERSION, publicProfile: !u.hidden, customImage: true, location: true, createdAt: joinedAt },
      });
      const nCities = idx % 5 === 0 ? 2 : 1;
      for (let c = 0; c < nCities; c++) {
        const [cityLabel, country, lat, lng] = CITIES[(idx * 3 + c * 7) % CITIES.length]!;
        await prisma.memberLocation.create({
          data: { userId: user.id, cityLabel, country, lat: +(lat + (rand() - 0.5) * 0.04).toFixed(3), lng: +(lng + (rand() - 0.5) * 0.04).toFixed(3) },
        });
      }
    }
    if (isMember) {
      const nAwards = Math.floor(rand() * 4) + (u.rank >= 8 ? 1 : 0);
      const given = new Set<number>();
      for (let a = 0; a < nAwards; a++) {
        const m = Math.floor(rand() * medals.length);
        if (given.has(m) && !medals[m]!.repeatable) continue;
        given.add(m);
        await prisma.medalAward.create({
          data: {
            userId: user.id,
            medalId: medals[m]!.id,
            reason: pick(REASONS),
            tier: medals[m]!.imageBronzeUrl ? pick(TIERS) : null,
            awardedAt: new Date(joinedAt.getTime() + rand() * (Date.now() - joinedAt.getTime())),
            announcedAt: new Date(),
          },
        });
      }
    }
    created++;
  }

  // Deux attributions récentes non annoncées, pour tester l'annonce Discord.
  const admin = await prisma.user.findUniqueOrThrow({ where: { discordId: 'demo-admin' } });
  const recipients = await prisma.user.findMany({ where: { discordId: { in: ['demo-002', 'demo-005'] } } });
  for (const r of recipients) {
    await prisma.medalAward.create({
      data: { userId: r.id, medalId: medals[2]!.id, tier: 'bronze', reason: 'Assaut réussi sur la ferme fortifiée lors de la dernière opération.', awardedById: admin.id },
    });
  }

  // Deux promotions détectées sur Discord et pas encore annoncées (grade précédent → grade actuel).
  const promoted = await prisma.user.findMany({
    where: { discordId: { in: ['demo-003', 'demo-007'] }, rank: { isNot: null } },
    include: { rank: true },
  });
  for (const u of promoted) {
    const previous = ranks.filter((r) => r.order < u.rank!.order).at(-1);
    if (previous) await prisma.rankPromotion.create({ data: { userId: u.id, fromRankId: previous.id, toRankId: u.rank!.id } });
  }

  await prisma.notification.create({ data: { type: 'join_click', payload: { count: 3, discordIds: [] } } });
  await prisma.auditLog.create({ data: { action: 'settings.updated', metadata: { seed: true } } });

  console.log(`Seed terminé : ${created} utilisateurs, ${medals.length} médailles, ${ranks.length + 1} grades.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
