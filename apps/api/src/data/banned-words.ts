/**
 * Filtrage basique de la phrase personnalisée. Liste volontairement courte et modifiable :
 * la modération humaine reste la règle.
 */
export const BANNED_PATTERNS: RegExp[] = [
  /\bn[i1]qu/i,
  /\bencul/i,
  /\bconnard/i,
  /\bconnasse/i,
  /\bsalope/i,
  /\bp[ée]d[ée]\b/i,
  /\bn[ée]gro/i,
  /\bbougnoul/i,
  /\bheil\b/i,
  /\bsieg\b/i,
  /\bnazi/i,
  /\bhitler/i,
  /\bss\b.*\b(totenkopf|waffen)/i,
  /\b88\b/,
  /\b14\s*88\b/,
];

/** Liens et invitations : interdits dans la phrase (anti-spam). */
export const LINK_PATTERN = /(https?:\/\/|www\.|discord\.gg|discord(app)?\.com\/invite)/i;

export function checkTagline(text: string): string | null {
  if (LINK_PATTERN.test(text)) return 'Les liens ne sont pas autorisés dans la phrase.';
  if (BANNED_PATTERNS.some((p) => p.test(text))) return 'Cette phrase contient un contenu interdit.';
  return null;
}
