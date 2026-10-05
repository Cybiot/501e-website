import type { Prisma } from '@prisma/client';
import { prisma, type Tx } from '../db.js';

export type NotificationType =
  | 'join_click'
  | 'image_submitted'
  | 'tagline_submitted'
  | 'new_member'
  | 'discord_error'
  | 'inactive_account';

export async function notifyAdmins(
  type: NotificationType,
  payload: Prisma.InputJsonObject,
  tx: Tx = prisma,
) {
  return tx.notification.create({ data: { type, payload } });
}

/**
 * Issue d'une demande soumise à modération : approuvée ou refusée par un admin, remplacée par
 * une nouvelle demande du membre, ou retirée par celui-ci avant d'être traitée.
 */
export type ModerationOutcome =
  | { status: 'approved'; by: string }
  | { status: 'rejected'; by: string; reason: string }
  | { status: 'replaced' | 'withdrawn' };

/**
 * Inscrit l'issue de la modération dans les notifications correspondantes (repérées par les
 * champs `match` de leur contenu), pour que l'interface admin affiche « Modéré » et le détail.
 */
export async function resolveModerationNotifications(
  type: Extract<NotificationType, 'image_submitted' | 'tagline_submitted'>,
  match: Record<string, string>,
  outcome: ModerationOutcome,
  tx: Tx = prisma,
) {
  const notifications = await tx.notification.findMany({
    where: { type, AND: Object.entries(match).map(([key, value]) => ({ payload: { path: [key], equals: value } })) },
  });
  for (const n of notifications) {
    const payload = n.payload as Prisma.JsonObject;
    if (payload['moderation']) continue;
    await tx.notification.update({
      where: { id: n.id },
      data: { payload: { ...payload, moderation: { ...outcome, at: new Date().toISOString() } } },
    });
  }
}
