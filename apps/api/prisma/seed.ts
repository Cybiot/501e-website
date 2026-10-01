/**
 * Données de démonstration (entièrement fictives).
 * Comptes de connexion démo : demo-admin (Admin), demo-membre (Membre, consentement à donner),
 * demo-visiteur (connecté sans rôle membre → traité comme un visiteur).
 */
import { PrismaClient, type MedalTier } from '@prisma/client';
import { MEDAL_CATALOG, medalImages } from '../src/data/medals.js';
import {
  MOCK_MEDAL_ROLE_PREFIX,
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
  ['EM - État-major', 'Direction de la communauté : décisions, organisation générale et arbitrages.', 'hierarchy'],
  ['CO - Commanding Officer', 'Commande le régiment et fixe les orientations en opération.', 'hierarchy'],
  ['XO - Executive Officer', 'Seconde le CO et le remplace en son absence.', 'hierarchy'],
  ['PL - Platoon Leader', 'Commande un peloton lors des opérations.', 'hierarchy'],
  ['Staff Toccoa', 'Encadre la formation des recrues au camp Toccoa.', 'pole'],
  ['Recruteur', 'Accueille les candidats, mène les entretiens et les accompagne jusqu’à la formation initiale.', 'pole'],
  ['Organisateur Event', 'Prépare et anime les événements et opérations spéciales.', 'pole'],
  ['Komité des médailles', 'Étudie les propositions de décorations et prépare les attributions.', 'pole'],
  ['Police militaire', 'Veille au respect du règlement sur le Discord et en jeu.', 'pole'],
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
  const resps = await Promise.all(
    RESPONSIBILITIES.map(([name, description, kind], i) =>
      prisma.responsibility.create({ data: { name, description, kind, order: i, discordRoleId: MOCK_RESPONSIBILITY_ROLES[i]!.id } }),
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
          discordRoleId: `${MOCK_MEDAL_ROLE_PREFIX}${m.slug}`,
        },
      }),
    ),
  );

  type SeedUser = { discordId: string; name: string; rank: number; admin?: boolean; resp?: number[]; consent?: boolean; member?: boolean; hidden?: boolean };
  const users: SeedUser[] = [
    { discordId: 'demo-admin', name: 'Cpt. Winters (démo admin)', rank: 13, admin: true, resp: [0, 1] },
    { discordId: 'demo-membre', name: 'Pvt. Blithe (démo membre)', rank: 0, consent: false },
    { discordId: 'demo-visiteur', name: 'Curieux (démo non-membre)', rank: -1, member: false },
  ];
  for (let i = 0; i < 20; i++) {
    const rank = Math.floor(rand() * rand() * RANKS.length);
    users.push({
      discordId: `demo-${String(i + 1).padStart(3, '0')}`,
      // Comme sur Discord, le pseudo commence par l'abréviation du grade.
      name: `${RANKS[rank]![2]} ${FIRST[i]} « ${LAST[i]} »`,
      rank,
      admin: i === 0,
      // EM, CO et XO ne sont pas tirés au hasard : les autres membres reçoivent un PL ou un pôle.
      resp: rand() < 0.35 ? [3 + Math.floor(rand() * (resps.length - 3))] : [],
      hidden: i === 7 || i === 15,
    });
  }

  let created = 0;
  for (const [idx, u] of users.entries()) {
    const isMember = u.member !== false;
    const roles = isMember
      ? [
          MOCK_ROLES.member.id,
          ...(u.admin ? [MOCK_ROLES.admin.id] : []),
          ...(u.rank >= 0 ? [MOCK_RANK_ROLES[u.rank]!.id] : []),
          ...(u.resp ?? []).map((r) => MOCK_RESPONSIBILITY_ROLES[r]!.id),
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
        rankId: isMember && u.rank >= 0 ? ranks[u.rank]!.id : null,
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

  await prisma.notification.create({ data: { type: 'join_click', payload: { count: 3, discordIds: [] } } });
  await prisma.auditLog.create({ data: { action: 'settings.updated', metadata: { seed: true } } });

  console.log(`Seed terminé : ${created} utilisateurs, ${medals.length} médailles, ${ranks.length} grades.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
