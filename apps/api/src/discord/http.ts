import { DiscordError } from './types.js';
import { logger } from '../lib/logger.js';

export const DISCORD_API = 'https://discord.com/api/v10';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

interface DiscordFetchOptions {
  method?: string;
  body?: unknown;
  /** « Bot xxx » ou « Bearer xxx » */
  authorization: string;
  /** Nombre maximal de tentatives (limites de débit et erreurs 5xx/réseau). */
  maxAttempts?: number;
  /** Retourne null au lieu de lever une erreur sur 404. */
  allowNotFound?: boolean;
}

/** Seule écriture autorisée avec le jeton du bot : poster un message dans un salon. */
const BOT_WRITE_ALLOWED = /^\/channels\/\d+\/messages$/;

/**
 * Appel REST Discord avec gestion des limites de débit (429 + retry_after)
 * et retry avec backoff exponentiel sur les erreurs transitoires.
 */
export async function discordFetch<T>(path: string, opts: DiscordFetchOptions): Promise<T | null> {
  const method = opts.method ?? 'GET';
  // Garde-fou : le bot ne fait que lire et poster les annonces, jamais d'autre écriture.
  if (opts.authorization.startsWith('Bot ') && method !== 'GET' && !(method === 'POST' && BOT_WRITE_ALLOWED.test(path))) {
    throw new DiscordError(`Action Discord non autorisée pour le bot : ${method} ${path}`);
  }
  const maxAttempts = opts.maxAttempts ?? 4;
  let attempt = 0;
  let lastError: unknown;
  while (attempt < maxAttempts) {
    attempt++;
    try {
      const headers: Record<string, string> = { Authorization: opts.authorization };
      if (opts.body !== undefined) headers['Content-Type'] = 'application/json';
      const res = await fetch(`${DISCORD_API}${path}`, {
        method,
        headers,
        body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
        signal: AbortSignal.timeout(10_000),
      });
      if (res.status === 429) {
        const data = (await res.json().catch(() => ({}))) as { retry_after?: number };
        const wait = Math.ceil((data.retry_after ?? 1) * 1000) + 100;
        logger.warn({ path, wait }, 'Discord : limite de débit atteinte, nouvel essai');
        await sleep(wait);
        continue;
      }
      if (res.status >= 500) {
        lastError = new DiscordError(`Discord indisponible (${res.status})`, res.status);
        await sleep(2 ** attempt * 250);
        continue;
      }
      if (res.status === 404 && opts.allowNotFound) return null;
      if (res.status === 204) return null;
      const data = (await res.json().catch(() => null)) as T & { message?: string; code?: number };
      if (!res.ok) {
        throw new DiscordError(data?.message ?? `Erreur Discord ${res.status}`, res.status, data?.code);
      }
      return data;
    } catch (err) {
      if (err instanceof DiscordError) throw err;
      lastError = err;
      await sleep(2 ** attempt * 250);
    }
  }
  throw lastError instanceof DiscordError
    ? lastError
    : new DiscordError(`Discord injoignable : ${(lastError as Error)?.message ?? 'erreur réseau'}`);
}
