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

export interface AnnouncementMessage extends DiscordMessagePayload {
  /** Attributions couvertes par ce message (marquées annoncées si l'envoi réussit). */
  awardIds: string[];
}

const GOLD = 0xc9a24b;

export const TIER_LABELS: Record<MedalTier, string> = { bronze: 'Bronze', silver: 'Argent', gold: 'Or' };

const embedSize = (e: DiscordEmbed) =>
  (e.title?.length ?? 0) + (e.description?.length ?? 0) + (e.footer?.text.length ?? 0);

/**
 * Construit le récapitulatif des médailles à annoncer, regroupé par médaille,
 * et le découpe automatiquement en plusieurs embeds/messages selon les limites Discord.
 */
export function buildAnnouncementMessages(
  awards: AnnounceableAward[],
  opts: { mentions: boolean; siteUrl?: string },
): AnnouncementMessage[] {
  if (awards.length === 0) return [];

  const byMedal = new Map<string, AnnounceableAward[]>();
  for (const a of [...awards].sort((x, y) => x.medal.order - y.medal.order || x.awardedAt.getTime() - y.awardedAt.getTime())) {
    const list = byMedal.get(a.medal.id) ?? [];
    list.push(a);
    byMedal.set(a.medal.id, list);
  }

  // 1. Un ou plusieurs embeds par médaille (description ≤ 4096 caractères).
  const embeds: { embed: DiscordEmbed; awardIds: string[]; userIds: string[] }[] = [];
  for (const list of byMedal.values()) {
    const medalName = list[0]!.medal.name;
    let lines: string[] = [];
    let ids: string[] = [];
    let users: string[] = [];
    let part = 1;
    const flush = () => {
      if (!lines.length) return;
      const title = `🎖️ ${medalName}${part > 1 ? ` (suite ${part})` : ''}`.slice(0, DISCORD_LIMITS.embedTitle);
      embeds.push({ embed: { title, description: lines.join('\n'), color: GOLD }, awardIds: ids, userIds: users });
      lines = [];
      ids = [];
      users = [];
      part++;
    };
    for (const a of list) {
      const who = opts.mentions ? `<@${a.user.discordId}>` : `**${a.user.displayName}**`;
      const tier = a.tier ? ` (${TIER_LABELS[a.tier]})` : '';
      const line = `• ${who}${tier} — ${a.reason}`.slice(0, 1000);
      const currentLength = lines.reduce((n, l) => n + l.length + 1, 0);
      if (currentLength + line.length + 1 > DISCORD_LIMITS.embedDescription) flush();
      lines.push(line);
      ids.push(a.id);
      users.push(a.user.discordId);
    }
    flush();
  }

  // 2. Regroupement des embeds en messages (≤ 10 embeds et ≤ 6000 caractères par message).
  const messages: AnnouncementMessage[] = [];
  let current: typeof embeds = [];
  let size = 0;
  const pushMessage = () => {
    if (!current.length) return;
    const userIds = [...new Set(current.flatMap((e) => e.userIds))];
    const isFirst = messages.length === 0;
    let content = isFirst ? '**📣 Nouvelles décorations — 501st PIR**' : '';
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
      awardIds: current.flatMap((e) => e.awardIds),
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
  const footer = `${awards.length} décoration${awards.length > 1 ? 's' : ''}${opts.siteUrl ? ` · ${opts.siteUrl}` : ''}`;
  if (embedSize(lastEmbed) + footer.length <= DISCORD_LIMITS.embedTotalChars) {
    lastEmbed.footer = { text: footer };
    lastEmbed.timestamp = new Date().toISOString();
  }
  return messages;
}
