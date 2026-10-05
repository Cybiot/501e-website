import request from 'supertest';
import type { UserStatus } from '@prisma/client';
import { createApp } from '../src/app.js';
import { prisma } from '../src/db.js';
import { discord } from '../src/discord/index.js';
import type { MockDiscordGateway } from '../src/discord/mock.js';
import { invalidateSettingsCache } from '../src/lib/settings.js';

export const app = createApp();
export const mockDiscord = () => discord() as MockDiscordGateway;

/** Vide toutes les tables entre deux tests. */
export async function resetDb() {
  const tables = await prisma.$queryRaw<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`;
  await prisma.$executeRawUnsafe(`TRUNCATE ${tables.map((t) => `"${t.tablename}"`).join(', ')} CASCADE`);
  invalidateSettingsCache();
  mockDiscord().sentMessages.length = 0;
  mockDiscord().createdRoles.length = 0;
  mockDiscord().failNext = 0;
}

let counter = 0;

/** Crée un utilisateur avec les rôles Discord correspondant au statut voulu. */
export async function createUser(status: UserStatus, opts: { consent?: boolean; publicProfile?: boolean } = {}) {
  counter++;
  const roles = status === 'admin' ? ['role-member', 'role-admin'] : status === 'member' ? ['role-member'] : [];
  const consent = opts.consent ?? status !== 'none';
  return prisma.user.create({
    data: {
      discordId: `t-${counter}-${Date.now()}`,
      displayName: `Testeur ${counter}`,
      status,
      discordRoleIds: roles,
      rolesSyncedAt: new Date(),
      publicProfileEnabled: opts.publicProfile ?? true,
      consentAcceptedAt: consent ? new Date() : null,
      consentVersion: consent ? '2026-09-v1' : null,
      consentCustomImage: consent,
      consentLocation: consent,
      profile: { create: {} },
    },
  });
}

/**
 * Agent HTTP connecté (connexion démo) avec gestion du jeton CSRF.
 * Renvoie des helpers get/post/patch/delete qui ajoutent l'en-tête X-XSRF-TOKEN.
 */
export async function loginAs(discordId?: string) {
  const agent = request.agent(app);
  const first = await agent.get('/api/auth/me');
  const cookies = ([] as string[]).concat(first.headers['set-cookie'] ?? []);
  const xsrf = cookies.map((c) => /XSRF-TOKEN=([^;]+)/.exec(c)?.[1]).find(Boolean) ?? '';
  if (discordId) {
    const res = await agent.post('/api/auth/demo/login').set('X-XSRF-TOKEN', xsrf).send({ discordId });
    if (res.status !== 200) throw new Error(`login failed ${res.status} ${JSON.stringify(res.body)}`);
  }
  return {
    agent,
    get: (url: string) => agent.get(url),
    post: (url: string, body?: object) => agent.post(url).set('X-XSRF-TOKEN', xsrf).send(body),
    patch: (url: string, body?: object) => agent.patch(url).set('X-XSRF-TOKEN', xsrf).send(body),
    put: (url: string, body?: object) => agent.put(url).set('X-XSRF-TOKEN', xsrf).send(body),
    delete: (url: string, body?: object) => agent.delete(url).set('X-XSRF-TOKEN', xsrf).send(body),
    xsrf,
  };
}

export async function createMedal(opts: { repeatable?: boolean; tiered?: boolean } = {}) {
  counter++;
  return prisma.medal.create({
    data: {
      name: `Médaille ${counter}`,
      description: 'Test',
      category: 'Bravoure',
      imageUrl: '/medailles/test.png',
      ...(opts.tiered
        ? { imageBronzeUrl: '/medailles/test-bronze.png', imageSilverUrl: '/medailles/test-argent.png', imageGoldUrl: '/medailles/test-or.png' }
        : {}),
      repeatable: opts.repeatable ?? true,
    },
  });
}
