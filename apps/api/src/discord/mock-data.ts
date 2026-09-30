/**
 * Rôles Discord fictifs utilisés en mode démo (DISCORD_MODE=mock) et par le seed.
 * En mode live, ces identifiants ne sont jamais utilisés : tout vient du .env et de l'admin.
 */
export const MOCK_ROLES = {
  member: { id: 'mock-role-membre', name: 'Membre 501e', color: 0x6b7f3a },
  admin: { id: 'mock-role-etat-major', name: 'État-major', color: 0xc9a24b },
  recruit: { id: 'mock-role-recrue', name: 'Recrue', color: 0x8a8f80 },
} as const;

export const MOCK_RANK_ROLES = [
  { key: 'pvt', id: 'mock-rank-pvt', name: 'Private' },
  { key: 'pfc', id: 'mock-rank-pfc', name: 'Private First Class' },
  { key: 'cpl', id: 'mock-rank-cpl', name: 'Corporal' },
  { key: 'sgt', id: 'mock-rank-sgt', name: 'Sergeant' },
  { key: 'ssg', id: 'mock-rank-ssg', name: 'Staff Sergeant' },
  { key: '2lt', id: 'mock-rank-2lt', name: 'Second Lieutenant' },
  { key: '1lt', id: 'mock-rank-1lt', name: 'First Lieutenant' },
  { key: 'cpt', id: 'mock-rank-cpt', name: 'Captain' },
  { key: 'maj', id: 'mock-rank-maj', name: 'Major' },
] as const;

export const MOCK_RESPONSIBILITY_ROLES = [
  { key: 'chef', id: 'mock-resp-chef-section', name: 'Chef de section' },
  { key: 'instr', id: 'mock-resp-instructeur', name: 'Instructeur' },
  { key: 'recr', id: 'mock-resp-recruteur', name: 'Recruteur' },
  { key: 'modo', id: 'mock-resp-moderateur', name: 'Modérateur' },
  { key: 'radio', id: 'mock-resp-radio', name: 'Opérateur radio' },
] as const;

export const MOCK_MEDAL_ROLE_PREFIX = 'mock-medal-';
