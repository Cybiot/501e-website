/**
 * Rôles Discord fictifs utilisés en mode démo (DISCORD_MODE=mock) et par le seed.
 * En mode live, ces identifiants ne sont jamais utilisés : tout vient du .env et de l'admin.
 */
export const MOCK_ROLES = {
  member: { id: 'mock-role-membre', name: '501e', color: 0x6b7f3a },
  admin: { id: 'mock-role-etat-major', name: 'État-major', color: 0xc9a24b },
  recruit: { id: 'mock-role-recrue', name: 'Recrue', color: 0x8a8f80 },
} as const;

export const MOCK_RANK_ROLES = [
  { key: 'pvt', id: 'mock-rank-pvt', name: 'Private' },
  { key: 'pfc', id: 'mock-rank-pfc', name: 'Private First Class' },
  { key: 'cpl', id: 'mock-rank-cpl', name: 'Corporal' },
  { key: 't5', id: 'mock-rank-t5', name: 'Technician Fifth Grade' },
  { key: 't4', id: 'mock-rank-t4', name: 'Technician Fourth Grade' },
  { key: 't3', id: 'mock-rank-t3', name: 'Technician Third Grade' },
  { key: 'sgt', id: 'mock-rank-sgt', name: 'Sergeant' },
  { key: 'ssgt', id: 'mock-rank-ssgt', name: 'Staff Sergeant' },
  { key: 'sfc', id: 'mock-rank-sfc', name: 'Sergeant First Class' },
  { key: '1sgt', id: 'mock-rank-1sgt', name: '1st Sergeant' },
  { key: 'msgt', id: 'mock-rank-msgt', name: 'Master Sergeant' },
  { key: '2lt', id: 'mock-rank-2lt', name: '2nd Lieutenant' },
  { key: '1lt', id: 'mock-rank-1lt', name: '1st Lieutenant' },
  { key: 'cpt', id: 'mock-rank-cpt', name: 'Captain' },
  { key: 'mjr', id: 'mock-rank-mjr', name: 'Major' },
  { key: 'ltcol', id: 'mock-rank-ltcol', name: 'Lieutenant Colonel' },
  { key: 'col', id: 'mock-rank-col', name: 'Colonel' },
] as const;

export const MOCK_RESPONSIBILITY_ROLES = [
  { key: 'em', id: 'mock-resp-em', name: 'EM - État-major' },
  { key: 'co', id: 'mock-resp-co', name: 'CO - Commanding Officer' },
  { key: 'xo', id: 'mock-resp-xo', name: 'XO - Executive Officer' },
  { key: 'pl', id: 'mock-resp-pl', name: 'PL - Platoon Leader' },
  { key: 'toccoa', id: 'mock-resp-toccoa', name: 'Staff Toccoa' },
  { key: 'recr', id: 'mock-resp-recruteur', name: 'Recruteur' },
  { key: 'event', id: 'mock-resp-event', name: 'Organisateur Event' },
  { key: 'medailles', id: 'mock-resp-komite-medailles', name: 'Komité des médailles' },
  { key: 'mp', id: 'mock-resp-police-militaire', name: 'Police militaire' },
] as const;

/** Rôles de compagnie (par slug, cf. table Company créée par migration). */
export const MOCK_COMPANY_ROLES = [
  { slug: 'steel-hawk', id: 'mock-company-steel-hawk', name: 'Baker Company - Steel Hawk' },
  { slug: 'blood-wall', id: 'mock-company-blood-wall', name: 'Dog Company - Blood Wall' },
  { slug: 'sledge-hammer', id: 'mock-company-sledge-hammer', name: 'Fox Company - Sledge Hammer' },
  { slug: 'camp-toccoa', id: 'mock-company-camp-toccoa', name: 'Camp Toccoa' },
] as const;

/** Rôles de platoon (compagnie par slug). Les instructeurs Toccoa réutilisent le rôle Staff Toccoa. */
export const MOCK_PLATOON_ROLES = [
  { slug: 'steel-hawk', platoon: "Platoon d'assaut", id: 'mock-platoon-sh-assaut', name: "Steel Hawk - Platoon d'assaut" },
  { slug: 'steel-hawk', platoon: 'Platoon de soutien', id: 'mock-platoon-sh-soutien', name: 'Steel Hawk - Platoon de soutien' },
  { slug: 'blood-wall', platoon: '1st Platoon', id: 'mock-platoon-bw-1', name: 'Blood Wall - 1st Platoon' },
  { slug: 'blood-wall', platoon: '2nd Platoon', id: 'mock-platoon-bw-2', name: 'Blood Wall - 2nd Platoon' },
  { slug: 'sledge-hammer', platoon: '1st Platoon', id: 'mock-platoon-sledge-1', name: 'Sledge Hammer - 1st Platoon' },
  { slug: 'sledge-hammer', platoon: '2nd Platoon', id: 'mock-platoon-sledge-2', name: 'Sledge Hammer - 2nd Platoon' },
  { slug: 'camp-toccoa', platoon: 'Recrues', id: 'mock-platoon-toccoa-recrues', name: 'Toccoa - Recrues' },
] as const;
