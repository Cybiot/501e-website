import { createHash, createHmac, randomBytes } from 'node:crypto';
import { config } from '../config.js';

export const randomToken = (bytes = 32) => randomBytes(bytes).toString('base64url');

export const sha256 = (value: string) => createHash('sha256').update(value).digest('hex');

/** Empreinte salée (HMAC) : sert à pseudonymiser IP et identifiants dans les logs. */
export const saltedHash = (value: string) =>
  createHmac('sha256', config.HASH_SALT).update(value).digest('hex').slice(0, 32);

/** Nombre pseudo-aléatoire déterministe dans [-1, 1] dérivé d'une chaîne. */
export function deterministicUnit(seed: string): number {
  const h = createHmac('sha256', config.HASH_SALT).update(seed).digest();
  return (h.readUInt32BE(0) / 0xffffffff) * 2 - 1;
}
