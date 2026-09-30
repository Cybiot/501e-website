/**
 * Bot Discord de la 501e.
 *
 * Rôle : écouter en temps réel les changements de rôles sur le serveur (guildMemberUpdate,
 * guildMemberAdd, guildMemberRemove) et les relayer à l'API, qui recalcule le statut
 * (Membre/Admin), le grade et les responsabilités. Les actions (ajout/retrait de rôles,
 * annonces) sont effectuées par l'API via l'API REST Discord avec le même jeton de bot.
 *
 * Permissions minimales du bot : View Channels, Send Messages, Embed Links, Manage Roles.
 * Intent privilégié requis : « Server Members Intent » (portail développeur Discord).
 */
import { Client, Events, GatewayIntentBits, type GuildMember, type PartialGuildMember } from 'discord.js';

const env = (name: string, fallback = '') => process.env[name] ?? fallback;

const MODE = env('DISCORD_MODE', 'mock');
const TOKEN = env('DISCORD_BOT_TOKEN');
const GUILD_ID = env('DISCORD_GUILD_ID');
const API_URL = env('API_INTERNAL_URL', 'http://localhost:3000').replace(/\/$/, '');
const INTERNAL_TOKEN = env('INTERNAL_API_TOKEN');

const log = (level: 'info' | 'warn' | 'error', msg: string, extra: Record<string, unknown> = {}) =>
  console[level](JSON.stringify({ level, time: new Date().toISOString(), service: 'bot', msg, ...extra }));

if (MODE !== 'live') {
  log('info', 'DISCORD_MODE=mock : le bot ne se connecte pas à Discord. Arrêt.');
  process.exit(0);
}
if (!TOKEN || !GUILD_ID || !INTERNAL_TOKEN) {
  log('error', 'DISCORD_BOT_TOKEN, DISCORD_GUILD_ID et INTERNAL_API_TOKEN sont requis.');
  process.exit(1);
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Envoi à l'API avec retry et backoff exponentiel (l'API peut redémarrer). */
async function relay(discordId: string, member: GuildMember | null) {
  const body = {
    discordId,
    member: member
      ? {
          displayName: member.displayName,
          avatarUrl: member.user.displayAvatarURL({ size: 256, extension: 'png' }),
          roles: member.roles.cache.filter((r) => r.id !== GUILD_ID).map((r) => r.id),
          joinedAt: member.joinedAt?.toISOString() ?? null,
        }
      : null,
  };
  for (let attempt = 1; attempt <= 5; attempt++) {
    try {
      const res = await fetch(`${API_URL}/internal/discord/member`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${INTERNAL_TOKEN}` },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(10_000),
      });
      if (res.ok) {
        const data = (await res.json()) as { known: boolean; status: string | null };
        if (data.known) log('info', 'Membre synchronisé', { status: data.status });
        return;
      }
      if (res.status < 500) {
        log('error', "Refus de l'API", { status: res.status });
        return;
      }
    } catch (err) {
      log('warn', 'API injoignable, nouvel essai', { attempt, err: (err as Error).message });
    }
    await sleep(2 ** attempt * 500);
  }
  log('error', 'Abandon du relais après 5 tentatives');
}

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers] });

const inGuild = (m: GuildMember | PartialGuildMember) => m.guild.id === GUILD_ID;

client.once(Events.ClientReady, (c) => {
  log('info', `Bot connecté en tant que ${c.user.tag}`);
});

client.on(Events.GuildMemberUpdate, (oldMember, newMember) => {
  if (!inGuild(newMember)) return;
  const before = [...oldMember.roles.cache.keys()].sort().join();
  const after = [...newMember.roles.cache.keys()].sort().join();
  const renamed = oldMember.displayName !== newMember.displayName;
  if (before !== after || renamed || oldMember.partial) void relay(newMember.id, newMember);
});

client.on(Events.GuildMemberAdd, (member) => {
  if (inGuild(member)) void relay(member.id, member);
});

client.on(Events.GuildMemberRemove, (member) => {
  // Départ du serveur : l'API masque le profil immédiatement.
  if (inGuild(member)) void relay(member.id, null);
});

client.on(Events.Error, (err) => log('error', 'Erreur client Discord', { err: err.message }));

const shutdown = () => {
  log('info', 'Arrêt du bot');
  void client.destroy().finally(() => process.exit(0));
};
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

await client.login(TOKEN);
