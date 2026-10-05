import { config } from '../config.js';
import { prisma } from '../db.js';
import { getSettings } from '../lib/settings.js';
import { discordFetch } from './http.js';
import {
  avatarUrlFor,
  DiscordError,
  type DiscordGateway,
  type DiscordMessagePayload,
  type DiscordRole,
  type GuildMemberInfo,
} from './types.js';

export interface ApiGuildMember {
  user?: { id: string; username: string; global_name?: string | null; avatar?: string | null };
  nick?: string | null;
  roles: string[];
  joined_at?: string | null;
}

export const toMemberInfo = (m: ApiGuildMember): GuildMemberInfo | null => {
  if (!m.user) return null;
  return {
    discordId: m.user.id,
    displayName: m.nick || m.user.global_name || m.user.username,
    avatarUrl: avatarUrlFor(m.user.id, m.user.avatar),
    roles: m.roles,
    joinedAt: m.joined_at ? new Date(m.joined_at) : null,
  };
};

/** Salon d'annonce configuré (Admin > Paramètres) : le seul où le bot peut écrire. */
async function announceChannel() {
  const { announceChannelId } = await getSettings();
  if (!/^\d+$/.test(announceChannelId)) throw new DiscordError("Aucun salon d'annonce valide n'est configuré.");
  return announceChannelId;
}

const ADMINISTRATOR = 1n << 3n;
const MANAGE_ROLES = 1n << 28n;

/**
 * Permissions de serveur dont le bot n'a pas besoin (et qui lui permettraient d'agir sur Discord).
 * « Gérer les rôles » est requise pour les promotions et les rôles de médaille ; le garde-fou (http.ts)
 * limite son usage aux rôles de grade et à la création de rôles sans permission.
 */
const EXCESS_PERMISSIONS: [bigint, string][] = [
  [1n << 3n, 'Administrateur'],
  [1n << 1n, 'Expulser des membres'],
  [1n << 2n, 'Bannir des membres'],
  [1n << 4n, 'Gérer les salons'],
  [1n << 5n, 'Gérer le serveur'],
  [1n << 13n, 'Gérer les messages'],
  [1n << 27n, 'Gérer les pseudos'],
  [1n << 29n, 'Gérer les webhooks'],
  [1n << 30n, 'Gérer les expressions'],
  [1n << 33n, 'Gérer les événements'],
  [1n << 34n, 'Gérer les fils'],
  [1n << 40n, 'Exclure temporairement des membres'],
];

/** Implémentation réelle : API REST Discord authentifiée avec le jeton du bot (lecture, grades, annonces). */
export class LiveDiscordGateway implements DiscordGateway {
  readonly mode = 'live' as const;
  private readonly auth = `Bot ${config.DISCORD_BOT_TOKEN}`;
  private readonly guild = config.DISCORD_GUILD_ID;

  async getMember(discordId: string) {
    const m = await discordFetch<ApiGuildMember>(`/guilds/${this.guild}/members/${discordId}`, {
      authorization: this.auth,
      allowNotFound: true,
    });
    return m ? toMemberInfo(m) : null;
  }

  async listMembers() {
    const all: GuildMemberInfo[] = [];
    let after = '0';
    // Pagination par blocs de 1000 (nécessite l'intent privilégié « Server Members »).
    for (;;) {
      const page = await discordFetch<ApiGuildMember[]>(
        `/guilds/${this.guild}/members?limit=1000&after=${after}`,
        { authorization: this.auth },
      );
      if (!page || page.length === 0) break;
      for (const m of page) {
        const info = toMemberInfo(m);
        if (info) all.push(info);
      }
      if (page.length < 1000) break;
      after = page[page.length - 1]!.user!.id;
    }
    return all;
  }

  async listRoles() {
    const roles = await discordFetch<DiscordRole[]>(`/guilds/${this.guild}/roles`, {
      authorization: this.auth,
    });
    return (roles ?? [])
      .filter((r) => r.id !== this.guild) // @everyone
      .map(({ id, name, color, position, managed }) => ({ id, name, color, position, managed }))
      .sort((a, b) => b.position - a.position);
  }

  async setRankRole(discordId: string, addRoleId: string, removeRoleIds: string[]) {
    const path = (roleId: string) => `/guilds/${this.guild}/members/${discordId}/roles/${roleId}`;
    // Ajout d'abord : le membre n'est jamais sans grade, même si le retrait échoue.
    await discordFetch(path(addRoleId), { method: 'PUT', authorization: this.auth });
    for (const roleId of removeRoleIds) await discordFetch(path(roleId), { method: 'DELETE', authorization: this.auth });
  }

  async createRole(name: string) {
    const role = await discordFetch<{ id: string }>(`/guilds/${this.guild}/roles`, {
      method: 'POST',
      authorization: this.auth,
      body: { name, permissions: '0', hoist: false, mentionable: false },
    });
    if (!role) throw new DiscordError('Création du rôle impossible');
    return role.id;
  }

  async postAnnouncement(payload: DiscordMessagePayload) {
    const channelId = await announceChannel();
    const msg = await discordFetch<{ id: string }>(`/channels/${channelId}/messages`, {
      method: 'POST',
      authorization: this.auth,
      body: {
        content: payload.content,
        embeds: payload.embeds,
        // Seules les personnes annoncées peuvent être notifiées (jamais @everyone ni de rôle).
        allowed_mentions: { parse: [], users: payload.mentionUserIds.slice(0, 100) },
      },
    });
    if (!msg) throw new DiscordError('Envoi du message impossible');
    return msg.id;
  }

  /**
   * Permissions du bot qui dépassent son usage, et capacité à gérer les rôles de grade :
   * « Gérer les rôles » et un rôle du bot placé au-dessus de tous les rôles de grade.
   */
  private async permissionAudit(botId: string) {
    const [member, roles, ranks] = await Promise.all([
      discordFetch<{ roles: string[] }>(`/guilds/${this.guild}/members/${botId}`, { authorization: this.auth, maxAttempts: 1 }),
      discordFetch<{ id: string; permissions: string; position: number }[]>(`/guilds/${this.guild}/roles`, { authorization: this.auth, maxAttempts: 1 }),
      prisma.rank.findMany({ where: { discordRoleId: { not: null } }, select: { name: true, discordRoleId: true } }),
    ]);
    const held = new Set([this.guild, ...(member?.roles ?? [])]); // @everyone a l'ID du serveur
    const heldRoles = (roles ?? []).filter((r) => held.has(r.id));
    const perms = heldRoles.reduce((acc, r) => acc | BigInt(r.permissions), 0n);
    const extra = EXCESS_PERMISSIONS.filter(([bit]) => (perms & bit) !== 0n).map(([, name]) => name);

    const top = Math.max(0, ...heldRoles.map((r) => r.position));
    const position = new Map((roles ?? []).map((r) => [r.id, r.position]));
    const above = ranks.filter((r) => (position.get(r.discordRoleId!) ?? 0) >= top).map((r) => r.name);
    const manageRoles = (perms & (MANAGE_ROLES | ADMINISTRATOR)) !== 0n;
    return { extra, manageRoles, above };
  }

  async checkIntegration() {
    const checks: { label: string; ok: boolean; detail?: string }[] = [];
    let me: { id: string; username: string } | null;
    try {
      me = await discordFetch<{ id: string; username: string }>('/users/@me', {
        authorization: this.auth,
        maxAttempts: 1,
      });
      checks.push({ label: 'Jeton du bot valide', ok: true, detail: me?.username });
    } catch (err) {
      checks.push({ label: 'Jeton du bot valide', ok: false, detail: (err as Error).message });
      return { ok: false, checks };
    }
    try {
      const g = await discordFetch<{ name: string }>(`/guilds/${this.guild}`, {
        authorization: this.auth,
        maxAttempts: 1,
      });
      checks.push({ label: 'Accès au serveur', ok: true, detail: g?.name });
    } catch (err) {
      checks.push({ label: 'Accès au serveur', ok: false, detail: (err as Error).message });
    }
    try {
      const roles = await this.listRoles();
      checks.push({ label: 'Lecture des rôles', ok: true, detail: `${roles.length} rôles` });
    } catch (err) {
      checks.push({ label: 'Lecture des rôles', ok: false, detail: (err as Error).message });
    }
    try {
      const channelId = await announceChannel();
      const ch = await discordFetch<{ name: string; guild_id?: string }>(`/channels/${channelId}`, {
        authorization: this.auth,
        maxAttempts: 1,
      });
      const ok = ch?.guild_id === this.guild;
      checks.push({ label: "Salon d'annonce accessible", ok, detail: ok ? `#${ch!.name}` : "Le salon n'appartient pas au serveur" });
    } catch (err) {
      checks.push({ label: "Salon d'annonce accessible", ok: false, detail: (err as Error).message });
    }
    try {
      const { extra, manageRoles, above } = await this.permissionAudit(me!.id);
      checks.push({
        label: 'Gestion des rôles de grade',
        ok: manageRoles && above.length === 0,
        detail: !manageRoles
          ? 'Donne la permission « Gérer les rôles » au rôle du bot'
          : above.length
            ? `Place le rôle du bot au-dessus de : ${above.join(', ')}`
            : 'Promotions et rétrogradations possibles',
      });
      checks.push({
        label: 'Aucune permission superflue',
        ok: extra.length === 0,
        detail: extra.length ? `À retirer au rôle du bot : ${extra.join(', ')}` : 'Lecture, grades et annonces uniquement',
      });
    } catch (err) {
      checks.push({ label: 'Permissions du bot', ok: false, detail: (err as Error).message });
    }
    return { ok: checks.every((c) => c.ok), checks };
  }
}
