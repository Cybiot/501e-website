import type { MedalTier } from '@prisma/client';
import type { DiscordMessagePayload } from '../discord/types.js';
import { medalImageFor } from './presenters.js';

/** Limites de l'API Discord pour les messages. */
export const DISCORD_LIMITS = {
  content: 2000,
  embedDescription: 4096,
  embedTitle: 256,
  embedsPerMessage: 10,
  embedTotalChars: 6000,
} as const;

export interface AnnounceableAward {
  id: string;
  reason: string;
  /** Palier de la médaille (null : sans palier). */
  tier?: MedalTier | null;
  awardedAt: Date;
  user: { discordId: string; displayName: string };
  medal: {
    id: string;
    name: string;
    order: number;
    imageUrl: string;
    imageBronzeUrl?: string | null;
    imageSilverUrl?: string | null;
    imageGoldUrl?: string | null;
  };
}

export interface AnnounceablePromotion {
  id: string;
  promotedAt: Date;
  user: { discordId: string; displayName: string };
  toRank: { name: string; order: number; iconUrl?: string | null };
}

export interface AnnouncementMessage extends DiscordMessagePayload {
  /** Attributions et promotions couvertes par ce message (marquées annoncées si l'envoi réussit). */
  awardIds: string[];
  promotionIds: string[];
}

const MEDAL_COLOR = 0xf1c40f;
const PROMOTION_COLOR = 0xe2a81c;

export const TIER_LABELS: Record<MedalTier, string> = { bronze: 'Bronze', silver: 'Argent', gold: 'Or' };

const MAX_REASON = 1000;

/**
 * URL d'image utilisable par Discord : absolue (Discord la télécharge depuis le site public) et
 * jamais en SVG, que Discord n'affiche pas (les insignes ont une copie PNG à côté du SVG).
 */
export function discordImageUrl(url: string | null | undefined, publicUrl: string | undefined): string | undefined {
  if (!url) return undefined;
  const png = url.replace(/\.svg$/i, '.png');
  if (/^https?:\/\//i.test(png)) return png;
  if (!publicUrl) return undefined;
  return `${publicUrl.replace(/\/+$/, '')}/${png.replace(/^\/+/, '')}`;
}

/**
 * Construit l'annonce : un message par promotion (du plus haut grade au plus bas), puis un
 * message par médaille (dans l'ordre du catalogue). Chaque message porte un bandeau
 * « ★★★ PROMOTION ★★★ » ou « ★★★ MEDAILLE ★★★ » et un embed « Garde à vous ! » avec l'image
 * en vignette. Le premier message commence par @here si `here` est activé.
 */
export function buildAnnouncementMessages(
  items: { awards: AnnounceableAward[]; promotions?: AnnounceablePromotion[] },
  opts: { mentions: boolean; here?: boolean; publicUrl?: string },
): AnnouncementMessage[] {
  const promotions = [...(items.promotions ?? [])].sort(
    (x, y) => y.toRank.order - x.toRank.order || x.promotedAt.getTime() - y.promotedAt.getTime(),
  );
  const awards = [...items.awards].sort((x, y) => x.medal.order - y.medal.order || x.awardedAt.getTime() - y.awardedAt.getTime());
  const who = (u: { discordId: string; displayName: string }) => (opts.mentions ? `<@${u.discordId}>` : `**${u.displayName}**`);

  const messages: AnnouncementMessage[] = [];
  const push = (
    banner: string,
    color: number,
    lines: string[],
    image: string | undefined,
    logoHint: string,
    ids: { awardIds?: string[]; promotionIds?: string[] },
  ) => {
    const description = [...lines, ...(image ? ['', `⚠️ ${logoHint}`] : [])].join('\n');
    messages.push({
      content: banner,
      embeds: [{ title: 'Garde à vous !', description, color, ...(image ? { thumbnail: { url: image } } : {}) }],
      mentionUserIds: [],
      awardIds: ids.awardIds ?? [],
      promotionIds: ids.promotionIds ?? [],
    });
  };

  for (const p of promotions) {
    push(
      '★★★ PROMOTION ★★★',
      PROMOTION_COLOR,
      [`Félicitations au ${who(p.user)} pour sa promotion au grade de **${p.toRank.name}**.`],
      discordImageUrl(p.toRank.iconUrl, opts.publicUrl),
      'Voici le logo que vous pouvez mettre en image de profil Discord.',
      { promotionIds: [p.id] },
    );
  }
  for (const a of awards) {
    const reason = a.reason.trim();
    push(
      '★★★ MEDAILLE ★★★',
      MEDAL_COLOR,
      [
        `Félicitations au ${who(a.user)} pour avoir été décoré de : **${a.medal.name}**${a.tier ? ` (${TIER_LABELS[a.tier]})` : ''}`,
        ...(reason ? ['', `**Motif :** ${reason.length > MAX_REASON ? `${reason.slice(0, MAX_REASON - 1)}…` : reason}`] : []),
      ],
      discordImageUrl(
        medalImageFor({ imageBronzeUrl: null, imageSilverUrl: null, imageGoldUrl: null, ...a.medal }, a.tier),
        opts.publicUrl,
      ),
      'Voici le logo que vous pouvez mettre sur votre image de profil Discord.',
      { awardIds: [a.id] },
    );
  }

  if (opts.here && messages[0]) {
    messages[0].content = `@here\n${messages[0].content}`;
    messages[0].mentionHere = true;
  }
  return messages;
}
