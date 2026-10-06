import { config } from '../config.js';
import { discordFetch, DISCORD_API } from './http.js';
import { toMemberInfo, type ApiGuildMember } from './live.js';
import { avatarUrlFor, DiscordError, type GuildMemberInfo } from './types.js';

/** Scopes minimaux : pas d'e-mail collecté. */
export const OAUTH_SCOPES = ['identify', 'guilds.members.read'];

export const redirectUri = () => `${config.PUBLIC_URL}/api/auth/discord/callback`;

export function authorizeUrl(state: string) {
  const params = new URLSearchParams({
    client_id: config.DISCORD_CLIENT_ID,
    redirect_uri: redirectUri(),
    response_type: 'code',
    scope: OAUTH_SCOPES.join(' '),
    state,
  });
  return `https://discord.com/oauth2/authorize?${params.toString()}`;
}

export async function exchangeCode(code: string): Promise<string> {
  const res = await fetch(`${DISCORD_API}/oauth2/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: config.DISCORD_CLIENT_ID,
      client_secret: config.DISCORD_CLIENT_SECRET,
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri(),
    }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new DiscordError(`Échange du code OAuth refusé (${res.status})`, res.status);
  const data = (await res.json()) as { access_token: string };
  return data.access_token;
}

export interface OAuthIdentity {
  discordId: string;
  displayName: string;
  avatarUrl: string | null;
  /** null si l'utilisateur n'est pas sur le serveur de la communauté. */
  member: GuildMemberInfo | null;
}

interface ApiUser {
  id: string;
  username: string;
  global_name?: string | null;
  avatar?: string | null;
}

export async function fetchIdentity(accessToken: string): Promise<OAuthIdentity> {
  const authorization = `Bearer ${accessToken}`;
  const user = await discordFetch<ApiUser>('/users/@me', { authorization });
  if (!user) throw new DiscordError('Profil Discord introuvable');
  const rawMember = await discordFetch<ApiGuildMember>(
    `/users/@me/guilds/${config.DISCORD_GUILD_ID}/member`,
    { authorization, allowNotFound: true },
  );
  const member = rawMember ? toMemberInfo({ ...rawMember, user: rawMember.user ?? user }) : null;
  // Révocation immédiate du jeton utilisateur : il n'est plus utile (minimisation).
  void fetch(`${DISCORD_API}/oauth2/token/revoke`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: config.DISCORD_CLIENT_ID,
      client_secret: config.DISCORD_CLIENT_SECRET,
      token: accessToken,
    }),
  }).catch(() => undefined);
  return {
    discordId: user.id,
    displayName: member?.displayName ?? user.global_name ?? user.username,
    avatarUrl: member?.avatarUrl ?? avatarUrlFor(user.id, user.avatar),
    member,
  };
}
