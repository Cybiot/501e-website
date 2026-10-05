import { z } from 'zod';
import { config, isMockDiscord } from '../config.js';
import { prisma } from '../db.js';
import { MOCK_ROLES } from '../discord/mock-data.js';

/**
 * Paramètres modifiables depuis l'admin (table `settings`).
 * Les variables d'environnement servent de valeurs par défaut.
 */
export const SettingsSchema = z.object({
  announceChannelId: z.string().max(40),
  inviteUrl: z.union([z.url(), z.literal('')]),
  /** Mentionner (@membre) les récipiendaires dans l'annonce Discord. */
  announceMentions: z.boolean(),
  consentVersion: z.string().min(1).max(40),
  consentText: z.string().min(1).max(5000),
});
export type AppSettings = z.infer<typeof SettingsSchema>;

export const DEFAULT_CONSENT_TEXT = [
  "Pour utiliser l'espace membre, nous traitons ton identifiant Discord, ton pseudo, ton avatar et tes rôles sur le serveur de la communauté (intérêt légitime : fonctionnement de la communauté).",
  'Les options ci-dessous sont facultatives et modifiables à tout moment depuis « Mon profil » :',
  '• Profil public : ta fiche (pseudo, grade, médailles, responsabilités, phrase) est visible des visiteurs non connectés. Si tu la masques, elle reste visible des autres membres connectés.',
  "• Image personnalisée : tu peux envoyer une image, validée par un admin avant publication.",
  '• Localisation : tu peux indiquer jusqu’à 2 villes (jamais d’adresse), visibles uniquement des membres connectés.',
  "Aucun e-mail n'est collecté. Tu peux exporter ou supprimer tes données à tout moment.",
].join('\n');

function defaults(): AppSettings {
  return {
    announceChannelId:
      config.DISCORD_ANNOUNCE_CHANNEL_ID || (isMockDiscord ? 'mock-channel-annonces' : ''),
    inviteUrl: config.DISCORD_INVITE_URL,
    announceMentions: true,
    consentVersion: '2026-09-v1',
    consentText: DEFAULT_CONSENT_TEXT,
  };
}

/**
 * Rôles Discord donnant un statut, fixés par l'environnement (non modifiables depuis l'admin) :
 * « État-major » pour Admin, « 501e » pour Membre.
 */
export function statusRoles(): { adminRoleId: string; memberRoleId: string } {
  return {
    adminRoleId: config.DISCORD_ADMIN_ROLE_ID || (isMockDiscord ? MOCK_ROLES.admin.id : ''),
    memberRoleId: config.DISCORD_MEMBER_ROLE_ID || (isMockDiscord ? MOCK_ROLES.member.id : ''),
  };
}

let cache: { value: AppSettings; at: number } | null = null;
const CACHE_MS = 5_000;

export async function getSettings(): Promise<AppSettings> {
  if (cache && Date.now() - cache.at < CACHE_MS) return cache.value;
  const rows = await prisma.setting.findMany();
  const stored = Object.fromEntries(rows.map((r) => [r.key, r.value]));
  const merged = { ...defaults(), ...stored };
  const value = SettingsSchema.parse(merged);
  cache = { value, at: Date.now() };
  return value;
}

export async function updateSettings(patch: Partial<AppSettings>): Promise<AppSettings> {
  const valid = SettingsSchema.partial().parse(patch);
  await prisma.$transaction(
    Object.entries(valid).map(([key, value]) =>
      prisma.setting.upsert({
        where: { key },
        create: { key, value: value as never },
        update: { value: value as never },
      }),
    ),
  );
  cache = null;
  return getSettings();
}

export const invalidateSettingsCache = () => {
  cache = null;
};
