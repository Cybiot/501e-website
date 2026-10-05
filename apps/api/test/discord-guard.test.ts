import { describe, expect, it } from 'vitest';
import { discordFetch } from '../src/discord/http.js';

describe('Garde-fou du bot Discord', () => {
  const bot = { authorization: 'Bot jeton-de-test' };

  it.each([
    ['PUT', '/guilds/1/members/2/roles/3'],
    ['DELETE', '/guilds/1/members/2/roles/3'],
    ['POST', '/guilds/1/roles'],
    ['PATCH', '/guilds/1/members/2'],
    ['DELETE', '/guilds/1/members/2'],
    ['PUT', '/guilds/1/bans/2'],
    ['DELETE', '/channels/1/messages/2'],
    ['POST', '/channels/1/webhooks'],
  ])('refuse %s %s avant tout appel réseau', async (method, path) => {
    await expect(discordFetch(path, { ...bot, method })).rejects.toThrow(/non autorisée pour le bot/);
  });

  it.each([{ permissions: '8' }, { name: 'Sans permissions explicites' }])('refuse la création d’un rôle avec des permissions (%o)', async (body) => {
    await expect(discordFetch('/guilds/1/roles', { ...bot, method: 'POST', body })).rejects.toThrow(/non autorisée pour le bot/);
  });
});
