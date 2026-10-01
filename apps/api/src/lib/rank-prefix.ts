import { prisma } from '../db.js';
import { logger } from './logger.js';

/**
 * Les pseudos Discord commencent par l'abréviation du grade (« Sfc. Walter Kloux »). Le site
 * affiche déjà le grade à côté du nom : on retire ce préfixe à l'affichage, la base garde le
 * pseudo complet. Les abréviations viennent de la table Rank, gardées en mémoire (instance
 * unique) et rechargées au démarrage et à chaque modification d'un grade.
 */
let prefixPattern: RegExp | null = null;

const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&');

export async function refreshRankPrefixes() {
  try {
    const ranks = await prisma.rank.findMany({ select: { abbreviation: true } });
    const bare = ranks
      .map((r) => r.abbreviation.trim().replace(/\.$/, ''))
      .filter(Boolean)
      // Les plus longues d'abord : « Lt.Col » avant « Col ».
      .sort((a, b) => b.length - a.length)
      .map(escapeRegExp);
    // Point final facultatif, puis au moins un espace : « Sfc. Kloux », « SFC Kloux ».
    prefixPattern = bare.length ? new RegExp(`^(?:${bare.join('|')})\\.?\\s+`, 'i') : null;
  } catch (err) {
    logger.warn({ err }, 'Chargement des abréviations de grade impossible');
  }
}

export function stripRankPrefix(name: string): string {
  if (!prefixPattern) return name;
  const rest = name.replace(prefixPattern, '').trim();
  return rest || name;
}
