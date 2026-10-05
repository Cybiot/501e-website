import { prisma } from '../db.js';
import { logger } from '../lib/logger.js';
import {
  MOCK_COMPANY_ROLES,
  MOCK_PLATOON_ROLES,
  MOCK_RANK_ROLES,
  MOCK_RESPONSIBILITY_ROLES,
  MOCK_ROLES,
} from './mock-data.js';
import { getSettings } from '../lib/settings.js';
import {
  DiscordError,
  type DiscordGateway,
  type DiscordMessagePayload,
  type DiscordRole,
  type GuildMemberInfo,
} from './types.js';

/**
 * Discord simulé : les rôles d'un utilisateur sont lus dans la colonne `discordRoleIds`.
 * Permet de tester tout le site (connexion, médailles, promotions, annonces) sans application Discord.
 * Un changement de grade écrit directement dans `discordRoleIds`.
 */
export class MockDiscordGateway implements DiscordGateway {
  readonly mode = 'mock' as const;
  /** Messages « envoyés » (consultables dans les tests). */
  readonly sentMessages: { channelId: string; payload: DiscordMessagePayload; id: string }[] = [];
  /** Permet aux tests de simuler une panne Discord sur les N prochains appels. */
  failNext = 0;

  private maybeFail() {
    if (this.failNext > 0) {
      this.failNext--;
      throw new Error('Discord simulé indisponible');
    }
  }

  async getMember(discordId: string): Promise<GuildMemberInfo | null> {
    this.maybeFail();
    const u = await prisma.user.findUnique({ where: { discordId } });
    if (!u || u.discordRoleIds.length === 0) return null;
    return {
      discordId,
      displayName: u.displayName,
      avatarUrl: u.discordAvatarUrl,
      roles: u.discordRoleIds,
      joinedAt: u.joinedAt,
    };
  }

  async listMembers() {
    this.maybeFail();
    const users = await prisma.user.findMany({
      where: { NOT: { discordRoleIds: { isEmpty: true } } },
    });
    return users.map((u) => ({
      discordId: u.discordId,
      displayName: u.displayName,
      avatarUrl: u.discordAvatarUrl,
      roles: u.discordRoleIds,
      joinedAt: u.joinedAt,
    }));
  }

  async listRoles(): Promise<DiscordRole[]> {
    this.maybeFail();
    let position = 100;
    const base: DiscordRole[] = [
      ...Object.values(MOCK_ROLES).map((r) => ({ id: r.id, name: r.name, color: r.color })),
      ...MOCK_RANK_ROLES.map((r) => ({ id: r.id, name: r.name, color: 0x6b7f3a })),
      ...MOCK_RESPONSIBILITY_ROLES.map((r) => ({ id: r.id, name: r.name, color: 0x4f6a8a })),
      ...MOCK_COMPANY_ROLES.map((r) => ({ id: r.id, name: r.name, color: 0x8a4f4f })),
      ...MOCK_PLATOON_ROLES.map((r) => ({ id: r.id, name: r.name, color: 0x8a6a4f })),
    ].map((r) => ({ ...r, position: position--, managed: false }));
    return base.filter((r, i) => base.findIndex((x) => x.id === r.id) === i);
  }

  async setRankRole(discordId: string, addRoleId: string, removeRoleIds: string[]) {
    this.maybeFail();
    const u = await prisma.user.findUnique({ where: { discordId } });
    if (!u) throw new DiscordError('Membre inconnu', 404);
    const roles = u.discordRoleIds.filter((r) => r !== addRoleId && !removeRoleIds.includes(r));
    await prisma.user.update({ where: { discordId }, data: { discordRoleIds: [...roles, addRoleId] } });
    logger.info({ discordId, addRoleId, removeRoleIds }, '[discord mock] rôle de grade changé');
  }

  /** Rôles « créés » (consultables dans les tests). */
  readonly createdRoles: { id: string; name: string }[] = [];

  async createRole(name: string) {
    this.maybeFail();
    const id = `mock-role-${Date.now().toString(36)}-${this.createdRoles.length}`;
    this.createdRoles.push({ id, name });
    logger.info({ id, name }, '[discord mock] rôle créé');
    return id;
  }

  async postAnnouncement(payload: DiscordMessagePayload) {
    this.maybeFail();
    const { announceChannelId: channelId } = await getSettings();
    if (!channelId) throw new DiscordError("Aucun salon d'annonce configuré.");
    const id = `mock-msg-${Date.now().toString(36)}-${this.sentMessages.length}`;
    this.sentMessages.push({ channelId, payload, id });
    logger.info({ channelId, embeds: payload.embeds.length }, '[discord mock] annonce postée');
    return id;
  }

  async checkIntegration() {
    return {
      ok: true,
      checks: [{ label: 'Mode démo', ok: true, detail: 'Discord simulé (DISCORD_MODE=mock)' }],
    };
  }
}
