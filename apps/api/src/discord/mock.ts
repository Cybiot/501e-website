import { prisma } from '../db.js';
import { logger } from '../lib/logger.js';
import {
  MOCK_MEDAL_ROLE_PREFIX,
  MOCK_RANK_ROLES,
  MOCK_RESPONSIBILITY_ROLES,
  MOCK_ROLES,
} from './mock-data.js';
import type {
  DiscordGateway,
  DiscordMessagePayload,
  DiscordRole,
  GuildMemberInfo,
} from './types.js';

/**
 * Discord simulé : les rôles d'un utilisateur sont lus/écrits dans la colonne `discordRoleIds`.
 * Permet de tester tout le site (connexion, médailles, annonces) sans application Discord.
 */
export class MockDiscordGateway implements DiscordGateway {
  readonly mode = 'mock' as const;
  /** Messages « envoyés » (consultables dans les tests). */
  readonly sentMessages: { channelId: string; payload: DiscordMessagePayload; id: string }[] = [];
  private createdRoles: DiscordRole[] = [];
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

  async addRole(discordId: string, roleId: string) {
    this.maybeFail();
    const u = await prisma.user.findUnique({ where: { discordId } });
    if (!u) return;
    if (!u.discordRoleIds.includes(roleId)) {
      await prisma.user.update({
        where: { discordId },
        data: { discordRoleIds: [...u.discordRoleIds, roleId] },
      });
    }
    logger.info({ discordId, roleId }, '[discord mock] rôle ajouté');
  }

  async removeRole(discordId: string, roleId: string) {
    this.maybeFail();
    const u = await prisma.user.findUnique({ where: { discordId } });
    if (!u) return;
    await prisma.user.update({
      where: { discordId },
      data: { discordRoleIds: u.discordRoleIds.filter((r) => r !== roleId) },
    });
    logger.info({ discordId, roleId }, '[discord mock] rôle retiré');
  }

  async listRoles(): Promise<DiscordRole[]> {
    this.maybeFail();
    const medals = await prisma.medal.findMany({
      where: { discordRoleId: { startsWith: MOCK_MEDAL_ROLE_PREFIX } },
    });
    let position = 100;
    const base: DiscordRole[] = [
      ...Object.values(MOCK_ROLES).map((r) => ({ id: r.id, name: r.name, color: r.color })),
      ...MOCK_RANK_ROLES.map((r) => ({ id: r.id, name: r.name, color: 0x6b7f3a })),
      ...MOCK_RESPONSIBILITY_ROLES.map((r) => ({ id: r.id, name: r.name, color: 0x4f6a8a })),
      ...medals.map((m) => ({ id: m.discordRoleId!, name: `Médaille — ${m.name}`, color: 0xc9a24b })),
    ].map((r) => ({ ...r, position: position--, managed: false }));
    const all = [...base, ...this.createdRoles];
    return all.filter((r, i) => all.findIndex((x) => x.id === r.id) === i);
  }

  async createRole(name: string, color: number) {
    this.maybeFail();
    const role = {
      id: `${MOCK_MEDAL_ROLE_PREFIX}${Date.now().toString(36)}`,
      name,
      color,
      position: 1,
      managed: false,
    };
    this.createdRoles.push(role);
    return role;
  }

  async sendMessage(channelId: string, payload: DiscordMessagePayload) {
    this.maybeFail();
    const id = `mock-msg-${Date.now().toString(36)}-${this.sentMessages.length}`;
    this.sentMessages.push({ channelId, payload, id });
    logger.info({ channelId, embeds: payload.embeds.length }, '[discord mock] message envoyé');
    return id;
  }

  async checkIntegration() {
    return {
      ok: true,
      checks: [{ label: 'Mode démo', ok: true, detail: 'Discord simulé (DISCORD_MODE=mock)' }],
    };
  }
}
