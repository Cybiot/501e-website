import type { MedalTier } from '@prisma/client';
import type { DiscordEmbed, DiscordMessagePayload } from '../discord/types.js';

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
  medal: { id: string; name: string; order: number };
}

export interface AnnounceablePromotion {
  id: string;
  promotedAt: Date;
  user: { discordId: string; displayName: string };
  fromRank: { name: string } | null;
  toRank: { name: string; order: number };
}

export interface AnnouncementMessage extends DiscordMessagePayload {
  /** Attributions et promotions couvertes par ce message (marquées annoncées si l'envoi réussit). */
  awardIds: string[];
  promotionIds: string[];
}

const GOLD = 0xc9a24b;
const OLIVE = 0x6b7f3a;

export const TIER_LABELS: Record<MedalTier, string> = { bronze: 'Bronze', silver: 'Argent', gold: 'Or' };

const embedSize = (e: DiscordEmbed) =>
  (e.title?.length ?? 0) + (e.description?.length ?? 0) + (e.footer?.text.length ?? 0);

const plural = (n: number, word: string) => `${n} ${word}${n > 1 ? 's' : ''}`;

/** Une ligne d'annonce, rattachée à une attribution ou à une promotion. */
interface Entry {
  kind: 'award' | 'promotion';
  id: string;
  userId: string;
  line: string;
}

/**
 * Construit l'annonce groupée : les promotions (du plus haut grade au plus bas), puis les
 * médailles regroupées par médaille. Le tout est découpé automatiquement en plusieurs
 * embeds/messages selon les limites Discord.
 */
export function buildAnnouncementMessages(
  items: { awards: AnnounceableAward[]; promotions?: AnnounceablePromotion[] },
  opts: { mentions: boolean; siteUrl?: string },
): AnnouncementMessage[] {
  const { awards } = items;
  const promotions = items.promotions ?? [];
  if (awards.length === 0 && promotions.length === 0) return [];
  const who = (u: { discordId: string; displayName: string }) => (opts.mentions ? `<@${u.discordId}>` : `**${u.displayName}**`);

  const sections: { title: string; color: number; entries: Entry[] }[] = [];
  if (promotions.length) {
    const sorted = [...promotions].sort((x, y) => y.toRank.order - x.toRank.order || x.promotedAt.getTime() - y.promotedAt.getTime());
    sections.push({
      title: '⬆️ Promotions',
      color: OLIVE,
      entries: sorted.map((p) => ({
        kind: 'promotion',
        id: p.id,
        userId: p.user.discordId,
        line: `• ${who(p.user)} — ${p.fromRank ? `${p.fromRank.name} → ` : ''}**${p.toRank.name}**`,
      })),
    });
  }
  const byMedal = new Map<string, AnnounceableAward[]>();
  for (const a of [...awards].sort((x, y) => x.medal.order - y.medal.order || x.awardedAt.getTime() - y.awardedAt.getTime())) {
    const list = byMedal.get(a.medal.id) ?? [];
    list.push(a);
    byMedal.set(a.medal.id, list);
  }
  for (const list of byMedal.values()) {
    sections.push({
      title: `🎖️ ${list[0]!.medal.name}`,
      color: GOLD,
      entries: list.map((a) => ({
        kind: 'award',
        id: a.id,
        userId: a.user.discordId,
        line: `• ${who(a.user)}${a.tier ? ` (${TIER_LABELS[a.tier]})` : ''} — ${a.reason}`,
      })),
    });
  }

  // 1. Un ou plusieurs embeds par section (description ≤ 4096 caractères).
  const embeds: { embed: DiscordEmbed; entries: Entry[] }[] = [];
  for (const section of sections) {
    let lines: string[] = [];
    let entries: Entry[] = [];
    let part = 1;
    const flush = () => {
      if (!lines.length) return;
      const title = `${section.title}${part > 1 ? ` (suite ${part})` : ''}`.slice(0, DISCORD_LIMITS.embedTitle);
      embeds.push({ embed: { title, description: lines.join('\n'), color: section.color }, entries });
      lines = [];
      entries = [];
      part++;
    };
    for (const e of section.entries) {
      const line = e.line.slice(0, 1000);
      const currentLength = lines.reduce((n, l) => n + l.length + 1, 0);
      if (currentLength + line.length + 1 > DISCORD_LIMITS.embedDescription) flush();
      lines.push(line);
      entries.push(e);
    }
    flush();
  }

  const heading =
    awards.length && promotions.length
      ? '**📣 Promotions et décorations — 501e**'
      : promotions.length
        ? '**📣 Promotions — 501e**'
        : '**📣 Nouvelles décorations — 501e**';

  // 2. Regroupement des embeds en messages (≤ 10 embeds et ≤ 6000 caractères par message).
  const messages: AnnouncementMessage[] = [];
  let current: typeof embeds = [];
  let size = 0;
  const pushMessage = () => {
    if (!current.length) return;
    const entries = current.flatMap((e) => e.entries);
    const userIds = [...new Set(entries.map((e) => e.userId))];
    const isFirst = messages.length === 0;
    let content = isFirst ? heading : '';
    if (opts.mentions) {
      // Les mentions dans un embed ne notifient pas : on les place aussi dans le contenu.
      const mentionLine = `Félicitations à ${userIds.map((id) => `<@${id}>`).join(' ')} !`;
      const joined = content ? `${content}\n${mentionLine}` : mentionLine;
      content = joined.length <= DISCORD_LIMITS.content ? joined : content;
    }
    messages.push({
      content: content || undefined,
      embeds: current.map((e) => e.embed),
      mentionUserIds: opts.mentions ? userIds : [],
      awardIds: entries.filter((e) => e.kind === 'award').map((e) => e.id),
      promotionIds: entries.filter((e) => e.kind === 'promotion').map((e) => e.id),
    });
    current = [];
    size = 0;
  };
  for (const e of embeds) {
    const s = embedSize(e.embed);
    if (current.length >= DISCORD_LIMITS.embedsPerMessage || size + s > DISCORD_LIMITS.embedTotalChars) pushMessage();
    current.push(e);
    size += s;
  }
  pushMessage();

  // Pied de page sur le dernier embed du dernier message.
  const last = messages[messages.length - 1]!;
  const lastEmbed = last.embeds[last.embeds.length - 1]!;
  const counts = [promotions.length ? plural(promotions.length, 'promotion') : '', awards.length ? plural(awards.length, 'décoration') : '']
    .filter(Boolean)
    .join(' · ');
  const footer = `${counts}${opts.siteUrl ? ` · ${opts.siteUrl}` : ''}`;
  if (embedSize(lastEmbed) + footer.length <= DISCORD_LIMITS.embedTotalChars) {
    lastEmbed.footer = { text: footer };
    lastEmbed.timestamp = new Date().toISOString();
  }
  return messages;
}
