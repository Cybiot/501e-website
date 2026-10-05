import { z } from 'zod';

const secret = (name: string) =>
  z.string().min(16, `${name} doit contenir au moins 16 caractères`);

const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PUBLIC_URL: z.url().default('http://localhost:4200'),
  API_PORT: z.coerce.number().int().positive().default(3000),
  DATABASE_URL: z.string().min(1),

  SESSION_SECRET: secret('SESSION_SECRET'),
  HASH_SALT: secret('HASH_SALT'),
  INTERNAL_API_TOKEN: secret('INTERNAL_API_TOKEN'),
  SESSION_TTL_DAYS: z.coerce.number().int().positive().default(7),

  DISCORD_MODE: z.enum(['mock', 'live']).default('mock'),
  DISCORD_CLIENT_ID: z.string().default(''),
  DISCORD_CLIENT_SECRET: z.string().default(''),
  DISCORD_BOT_TOKEN: z.string().default(''),
  DISCORD_GUILD_ID: z.string().default(''),
  /** ID du rôle Discord « 501e » : seul rôle donnant le statut Membre. */
  DISCORD_MEMBER_ROLE_ID: z.string().trim().default(''),
  /** ID du rôle Discord « État-major » : seul rôle donnant le statut Admin. */
  DISCORD_ADMIN_ROLE_ID: z.string().trim().default(''),
  DISCORD_ANNOUNCE_CHANNEL_ID: z.string().default(''),
  DISCORD_INVITE_URL: z.string().default(''),
  ROLE_SYNC_INTERVAL_MINUTES: z.coerce.number().int().min(0).default(15),

  STORAGE_DIR: z.string().default('./storage'),

  GEOCODER: z.enum(['demo', 'photon']).default('demo'),
  PHOTON_URL: z.string().default('http://localhost:2322'),
  MAP_TILE_URL: z.string().default('https://tile.openstreetmap.org/{z}/{x}/{y}.png'),
  MAP_TILE_ATTRIBUTION: z.string().default('&copy; OpenStreetMap contributors'),
  /** « dark » : filtre CSS assombrissant les tuiles claires (OSM standard) ; « none » : tuiles telles quelles. */
  MAP_TILE_FILTER: z.enum(['dark', 'none']).default('dark'),

  AUDIT_LOG_RETENTION_MONTHS: z.coerce.number().int().positive().default(12),
  REJECTED_IMAGE_RETENTION_DAYS: z.coerce.number().int().positive().default(30),
  DEPARTED_MEMBER_RETENTION_DAYS: z.coerce.number().int().positive().default(30),
  INACTIVE_ACCOUNT_MONTHS: z.coerce.number().int().positive().default(24),

  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
});

export type Config = z.infer<typeof EnvSchema>;

function loadConfig(): Config {
  const parsed = EnvSchema.safeParse(process.env);
  if (!parsed.success) {
    const details = parsed.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`);
    throw new Error(`Configuration invalide :\n${details.join('\n')}`);
  }
  const cfg = parsed.data;
  if (cfg.DISCORD_MODE === 'live') {
    const required = [
      'DISCORD_CLIENT_ID',
      'DISCORD_CLIENT_SECRET',
      'DISCORD_BOT_TOKEN',
      'DISCORD_GUILD_ID',
    ] as const;
    const missing = required.filter((k) => !cfg[k]);
    if (missing.length) {
      throw new Error(`DISCORD_MODE=live mais variables manquantes : ${missing.join(', ')}`);
    }
  }
  if (cfg.NODE_ENV === 'production' && cfg.DISCORD_MODE === 'mock') {
    console.warn('[config] ATTENTION : DISCORD_MODE=mock en production (connexion simulée active).');
  }
  return cfg;
}

export const config = loadConfig();

export const isProd = config.NODE_ENV === 'production';
export const isMockDiscord = config.DISCORD_MODE === 'mock';
/** Les cookies Secure ne fonctionnent qu'en HTTPS : on les active dès que l'URL publique l'est. */
export const secureCookies = config.PUBLIC_URL.startsWith('https://');
