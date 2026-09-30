import pino from 'pino';
import { config } from '../config.js';

/** Logs applicatifs structurés (JSON). Aucune donnée personnelle inutile : pas d'IP, pas de cookie. */
export const logger = pino({
  level: config.NODE_ENV === 'test' ? 'silent' : config.LOG_LEVEL,
  redact: ['req.headers.cookie', 'req.headers.authorization', 'res.headers["set-cookie"]'],
});
