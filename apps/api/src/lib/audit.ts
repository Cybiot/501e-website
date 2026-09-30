import type { Request } from 'express';
import type { Prisma } from '@prisma/client';
import { prisma, type Tx } from '../db.js';
import { saltedHash } from './crypto.js';
import { logger } from './logger.js';

/** Actions journalisées (journal d'audit immuable depuis l'UI). */
export type AuditAction =
  | 'auth.login'
  | 'auth.logout'
  | 'auth.login_failed'
  | 'user.status_changed'
  | 'profile.updated'
  | 'profile.visibility_changed'
  | 'consent.accepted'
  | 'image.submitted'
  | 'image.approved'
  | 'image.rejected'
  | 'location.added'
  | 'location.deleted'
  | 'medal.created'
  | 'medal.updated'
  | 'medal.deleted'
  | 'medal.awarded'
  | 'medal.revoked'
  | 'announcement.published'
  | 'settings.updated'
  | 'discord.error'
  | 'gdpr.export'
  | 'gdpr.delete'
  | 'retention.purge';

interface AuditInput {
  action: AuditAction;
  actorId?: string | null;
  targetType?: string;
  targetId?: string;
  metadata?: Prisma.InputJsonValue;
  req?: Request;
}

export async function audit(input: AuditInput, tx: Tx = prisma): Promise<void> {
  try {
    await tx.auditLog.create({
      data: {
        action: input.action,
        actorId: input.actorId ?? input.req?.user?.id ?? null,
        targetType: input.targetType,
        targetId: input.targetId,
        metadata: input.metadata,
        ipHash: input.req?.ip ? saltedHash(input.req.ip) : null,
      },
    });
  } catch (err) {
    // Un échec de journalisation ne doit pas casser l'action métier, mais il est signalé.
    logger.error({ err, action: input.action }, "Échec d'écriture du journal d'audit");
  }
}
