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
 * Tout ce que le site demande à Discord passe par cette interface.
 * Deux implémentations : `live` (API REST Discord via le jeton du bot) et `mock` (démo/tests).
 */
export interface DiscordGateway {
  readonly mode: 'live' | 'mock';
  getMember(discordId: string): Promise<GuildMemberInfo | null>;
  listMembers(): Promise<GuildMemberInfo[]>;
  addRole(discordId: string, roleId: string): Promise<void>;
  removeRole(discordId: string, roleId: string): Promise<void>;
  listRoles(): Promise<DiscordRole[]>;
  createRole(name: string, color: number): Promise<DiscordRole>;
  /** Retourne l'identifiant du message créé. */
  sendMessage(channelId: string, payload: DiscordMessagePayload): Promise<string>;
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

export const avatarUrlFor = (discordId: string, avatarHash: string | null | undefined): string => {
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
