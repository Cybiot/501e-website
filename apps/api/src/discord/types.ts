export interface GuildMemberInfo {
  discordId: string;
  displayName: string;
  avatarUrl: string | null;
  roles: string[];
  joinedAt: Date | null;
}

export interface DiscordRole {
  id: string;
  name: string;
  color: number;
  position: number;
  managed: boolean;
}

export interface DiscordEmbed {
  title?: string;
  description?: string;
  color?: number;
  thumbnail?: { url: string };
  footer?: { text: string };
  timestamp?: string;
}

export interface DiscordMessagePayload {
  content?: string;
  embeds: DiscordEmbed[];
  /** Utilisateurs autorisés à être notifiés par la mention (jamais @everyone). */
  mentionUserIds: string[];
}

/**
 * Tout ce que le site demande à Discord passe par cette interface. Le bot a trois usages :
 * lire les membres et les rôles, changer le rôle de grade d'un membre (promotion ou
 * rétrogradation décidée par un admin), créer le rôle (sans permission) d'une nouvelle médaille
 * et poster les annonces (médailles, promotions) dans le salon d'annonce configuré. Aucune autre action (autres rôles, pseudos, messages ailleurs…) n'est exposée.
 * Deux implémentations : `live` (API REST Discord via le jeton du bot) et `mock` (démo/tests).
 */
export interface DiscordGateway {
  readonly mode: 'live' | 'mock';
  getMember(discordId: string): Promise<GuildMemberInfo | null>;
  listMembers(): Promise<GuildMemberInfo[]>;
  listRoles(): Promise<DiscordRole[]>;
  /** Ajoute le rôle de grade `addRoleId` puis retire `removeRoleIds` (rôles de grade configurés uniquement). */
  setRankRole(discordId: string, addRoleId: string, removeRoleIds: string[]): Promise<void>;
  /** Crée un rôle sans aucune permission (rôle de médaille). Retourne son identifiant. */
  createRole(name: string): Promise<string>;
  /** Poste dans le salon d'annonce configuré (le seul où le bot écrit). Retourne l'identifiant du message. */
  postAnnouncement(payload: DiscordMessagePayload): Promise<string>;
  checkIntegration(): Promise<{ ok: boolean; checks: { label: string; ok: boolean; detail?: string }[] }>;
}

export class DiscordError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
    public readonly discordCode?: number,
  ) {
    super(message);
  }
}

/**
 * URL de l'avatar : l'avatar propre au serveur de la communauté s'il existe (`guildAvatar`),
 * sinon l'avatar Discord global, sinon l'avatar par défaut de Discord.
 */
export const avatarUrlFor = (
  discordId: string,
  avatarHash: string | null | undefined,
  guildAvatar?: { guildId: string; hash: string | null | undefined },
): string => {
  if (guildAvatar?.hash) {
    const ext = guildAvatar.hash.startsWith('a_') ? 'gif' : 'png';
    return `https://cdn.discordapp.com/guilds/${guildAvatar.guildId}/users/${discordId}/avatars/${guildAvatar.hash}.${ext}?size=256`;
  }
  if (avatarHash) {
    const ext = avatarHash.startsWith('a_') ? 'gif' : 'png';
    return `https://cdn.discordapp.com/avatars/${discordId}/${avatarHash}.${ext}?size=256`;
  }
  let index = 0;
  try {
    index = Number((BigInt(discordId) >> 22n) % 6n);
  } catch {
    index = 0;
  }
  return `https://cdn.discordapp.com/embed/avatars/${index}.png`;
};
