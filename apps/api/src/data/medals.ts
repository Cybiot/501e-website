/**
 * Catalogue officiel des médailles de la communauté (images dans apps/web/public/medailles,
 * originaux dans assets/medailles). Repris par la migration « medal_tiers » pour la production
 * et par le seed pour les données de démo.
 */
export const MEDAL_CATEGORIES = ['Faits d’armes individuels', 'Collectives', 'Infanterie', 'Administration'] as const;

export interface MedalDefinition {
  /** Nom du fichier image (sans extension) ; les paliers ajoutent -bronze, -argent ou -or. */
  slug: string;
  name: string;
  category: (typeof MEDAL_CATEGORIES)[number];
  description: string;
  tiered: boolean;
  repeatable: boolean;
}

export const MEDAL_CATALOG: MedalDefinition[] = [
  // --- Faits d'armes individuels ---
  {
    slug: 'medal-of-honor',
    name: 'Medal of Honor',
    category: 'Faits d’armes individuels',
    description: 'Héroïsme extraordinaire ayant changé le cours de la bataille. Historiquement : décernée pour « courage et intrépidité au péril de sa vie et au-delà du devoir ».',
    tiered: false,
    repeatable: true,
  },
  {
    slug: 'distinguished-service-cross',
    name: 'Distinguished Service Cross',
    category: 'Faits d’armes individuels',
    description: 'Héroïsme exceptionnel avec un impact tactique majeur. Historiquement : décernée pour « héroïsme extraordinaire », une action héroïque qui ne peut justifier une Medal of Honor.',
    tiered: true,
    repeatable: true,
  },
  {
    slug: 'silver-star',
    name: 'Silver Star',
    category: 'Faits d’armes individuels',
    description: 'Bravoure remarquable, grande efficacité face à l’ennemi et initiative tactique importante. Historiquement : décernée pour courage « en opération », action honorable moins importante que pour la DSC.',
    tiered: true,
    repeatable: true,
  },
  {
    slug: 'distinguished-service-medal',
    name: 'Distinguished Service Medal',
    category: 'Faits d’armes individuels',
    description: 'Acte de combat majeur. Historiquement : décernée pour héroïsme exceptionnel.',
    tiered: true,
    repeatable: true,
  },
  {
    slug: 'bronze-star',
    name: 'Bronze Star',
    category: 'Faits d’armes individuels',
    description: 'Acte de combat supérieur. Historiquement : décernée pour des actions de bravoure, d’héroïsme et de mérite moins importantes que pour la Silver Star.',
    tiered: true,
    repeatable: true,
  },
  {
    slug: 'commendation-medal',
    name: 'Commendation Medal',
    category: 'Faits d’armes individuels',
    description: 'Acte de combat mineur. Historiquement : décernée pour des actions valeureuses, d’une importance moindre que celles justifiant la Bronze Star.',
    tiered: true,
    repeatable: true,
  },
  // --- Collectives ---
  {
    slug: 'presidential-unit-citation',
    name: 'Army & Air Force Presidential Unit Citation',
    category: 'Collectives',
    description: 'Décernée à une unité pour un exploit extraordinaire changeant le cours ou l’issue de la bataille. Doit être approuvée par un chef de bataillon ou du régiment avant la remise aux récipiendaires. Historiquement : décernée par le président à une compagnie pour « héroïsme extraordinaire ».',
    tiered: false,
    repeatable: true,
  },
  {
    slug: 'meritorious-unit-commendation',
    name: 'Meritorious Unit Commendation',
    category: 'Collectives',
    description: 'Décernée à une unité pour un acte de combat majeur. Doit être demandée ou co-demandée par un SL, le XO, le CO ou un membre de l’EM. Historiquement : récompense une unité pour des actes, au combat ou hors combat, exceptionnellement méritoires.',
    tiered: true,
    repeatable: true,
  },
  {
    slug: 'op44-campaign-medal',
    name: 'OP44 Campaign Medal',
    category: 'Collectives',
    description: 'Décernée à tout soldat ayant participé à 4 events OP44, à la fin de la campagne. Inspirée de la European-African-Middle Eastern Campaign Medal, qui récompensait les militaires ayant participé aux opérations des théâtres d’Europe, d’Afrique ou du Moyen-Orient.',
    tiered: false,
    repeatable: false,
  },
  {
    slug: 'case-blue-campaign-medal',
    name: 'Case Blue Campaign Medal',
    category: 'Collectives',
    description: 'Décernée à tout soldat ayant participé à 4 events Case Blue, à la fin de la campagne. Inspirée de la médaille soviétique pour la défense du Caucase, distribuée à ceux qui y ont participé entre 1942 et 1944.',
    tiered: false,
    repeatable: false,
  },
  {
    slug: 'battle-of-crete-medal',
    name: 'Commemorative Medal for the Battle of Crete',
    category: 'Collectives',
    description: 'Décernée à tout soldat ayant participé à l’event de 8 h du 20/08/23. Inspirée de la médaille grecque décernée à ceux qui ont participé aux combats de 1940-1941 en Albanie, en Crète, en Macédoine et en Thrace.',
    tiered: false,
    repeatable: false,
  },
  // --- Infanterie ---
  {
    slug: 'purple-heart',
    name: 'Purple Heart',
    category: 'Infanterie',
    description: 'Avoir été mis hors de combat par l’ennemi pendant l’accomplissement d’une mission importante et/ou continuer à servir efficacement après avoir été réanimé ou redéployé. Historiquement : blessure subie au combat du fait de l’ennemi.',
    tiered: false,
    repeatable: true,
  },
  {
    slug: 'combat-medical-badge',
    name: 'Combat Medical Badge',
    category: 'Infanterie',
    description: 'Être assigné en tant que médic, avec plusieurs réanimations et une participation active aux combats en première ligne. Historiquement : acte de soin sous le feu de l’ennemi.',
    tiered: true,
    repeatable: true,
  },
  {
    slug: 'distinguished-marksman-badge',
    name: 'Distinguished Marksman Badge',
    category: 'Infanterie',
    description: 'Précision exceptionnelle, impact direct sur les objectifs et engagement de cibles importantes. Historiquement : obtenu pour un certain score en compétition au fusil.',
    tiered: true,
    repeatable: true,
  },
  {
    slug: 'army-achievement-medal',
    name: 'Army Achievement Medal',
    category: 'Infanterie',
    description: 'Décernée au top 3 des soldats les plus actifs du mois en partie VANILLA. Historiquement : récompense les membres de l’armée pour leur conduite exemplaire.',
    tiered: false,
    repeatable: true,
  },
  // --- Administration ---
  {
    slug: 'legion-of-merit',
    name: 'Legion of Merit',
    category: 'Administration',
    description: 'Bonne conduite pendant 6 mois sans averto ni dossier, sous validation de l’EM. Peut être retirée par la PM ou l’EM après un averto ou un dossier. Historiquement : conduite exemplaire exceptionnelle en période de guerre.',
    tiered: false,
    repeatable: false,
  },
  {
    slug: 'good-conduct-medal',
    name: 'Good Conduct Medal',
    category: 'Administration',
    description: 'Bonne conduite pendant 3 mois sans averto ni dossier, sous validation de la PM. Peut être retirée par la PM ou l’EM après un averto ou un dossier. Historiquement : conduite exemplaire.',
    tiered: false,
    repeatable: false,
  },
  {
    slug: 'demobilisation-patch',
    name: 'Demobilisation Patch',
    category: 'Administration',
    description: 'Passage en civil ou vétéran. Historiquement : cousu sur l’uniforme à la démobilisation du soldat.',
    tiered: false,
    repeatable: false,
  },
  {
    slug: 'parachutist-badge',
    name: 'Parachutist Badge',
    category: 'Administration',
    description: 'Décerné à la réussite de la Bleusaille. Historiquement : remis à la fin de la formation parachutiste.',
    tiered: false,
    repeatable: false,
  },
  {
    slug: 'community-investment-medal',
    name: 'Community Investment Medal',
    category: 'Administration',
    description: 'Récompense l’implication dans la communauté.',
    tiered: false,
    repeatable: true,
  },
];

/** Suffixe des fichiers image de chaque palier. */
export const TIER_FILE_SUFFIX = { bronze: 'bronze', silver: 'argent', gold: 'or' } as const;

export const medalImages = (m: Pick<MedalDefinition, 'slug' | 'tiered'>) => ({
  imageUrl: `/medailles/${m.slug}.png`,
  imageBronzeUrl: m.tiered ? `/medailles/${m.slug}-${TIER_FILE_SUFFIX.bronze}.png` : null,
  imageSilverUrl: m.tiered ? `/medailles/${m.slug}-${TIER_FILE_SUFFIX.silver}.png` : null,
  imageGoldUrl: m.tiered ? `/medailles/${m.slug}-${TIER_FILE_SUFFIX.gold}.png` : null,
});
