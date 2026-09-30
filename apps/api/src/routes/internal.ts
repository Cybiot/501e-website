import { timingSafeEqual } from 'node:crypto';
import { Router } from 'express';
import { z } from 'zod';
import { applyMemberInfo } from '../auth/sync.js';
import { config } from '../config.js';
import { unauthorized } from '../lib/errors.js';
import { parse } from '../lib/validate.js';

/**
 * Routes appelées uniquement par le bot Discord (réseau interne Docker),
 * authentifiées par un jeton partagé (INTERNAL_API_TOKEN).
 */
export const internalRouter = Router();

internalRouter.use((req, _res, next) => {
  const header = req.get('authorization') ?? '';
  const expected = Buffer.from(`Bearer ${config.INTERNAL_API_TOKEN}`);
  const given = Buffer.from(header);
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return next(unauthorized());
  next();
});

const MemberBody = z.object({
  discordId: z.string().min(1).max(32),
  /** null = le membre a quitté le serveur. */
  member: z
    .object({
      displayName: z.string().min(1).max(100),
      avatarUrl: z.string().max(300).nullable(),
      roles: z.array(z.string().max(32)).max(250),
      joinedAt: z.coerce.date().nullable(),
    })
    .nullable(),
});

/** Événements guildMemberUpdate / guildMemberRemove relayés par le bot. */
internalRouter.post('/discord/member', async (req, res) => {
  const body = parse(MemberBody, req.body);
  const updated = await applyMemberInfo(
    body.discordId,
    body.member ? { discordId: body.discordId, ...body.member } : null,
  );
  res.json({ known: Boolean(updated), status: updated?.status ?? null });
});
