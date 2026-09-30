import type { Prisma } from '@prisma/client';
import { prisma, type Tx } from '../db.js';

export type NotificationType =
  | 'join_click'
  | 'image_submitted'
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
