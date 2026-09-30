import { config } from '../config.js';
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

/** Implémentation réelle : API REST Discord authentifiée avec le jeton du bot. */
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

  async addRole(discordId: string, roleId: string) {
    await discordFetch(`/guilds/${this.guild}/members/${discordId}/roles/${roleId}`, {
      method: 'PUT',
      authorization: this.auth,
      reason: 'Site 501e',
    });
  }

  async removeRole(discordId: string, roleId: string) {
    await discordFetch(`/guilds/${this.guild}/members/${discordId}/roles/${roleId}`, {
      method: 'DELETE',
      authorization: this.auth,
      reason: 'Site 501e',
    });
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

  async createRole(name: string, color: number) {
    const role = await discordFetch<DiscordRole>(`/guilds/${this.guild}/roles`, {
      method: 'POST',
      authorization: this.auth,
      body: { name, color, mentionable: false, hoist: false },
      reason: 'Création de médaille depuis le site 501e',
    });
    if (!role) throw new DiscordError('Création du rôle impossible');
    return role;
  }

  async sendMessage(channelId: string, payload: DiscordMessagePayload) {
    const msg = await discordFetch<{ id: string }>(`/channels/${channelId}/messages`, {
      method: 'POST',
      authorization: this.auth,
      body: {
        content: payload.content,
        embeds: payload.embeds,
        allowed_mentions: { parse: [], users: payload.mentionUserIds.slice(0, 100) },
      },
    });
    if (!msg) throw new DiscordError('Envoi du message impossible');
    return msg.id;
  }

  async checkIntegration() {
    const checks: { label: string; ok: boolean; detail?: string }[] = [];
    try {
      const me = await discordFetch<{ id: string; username: string }>('/users/@me', {
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
    return { ok: checks.every((c) => c.ok), checks };
  }
}
