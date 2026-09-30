import { Pipe, PipeTransform } from '@angular/core';
import { fr } from './fr';

type Dict = { [k: string]: string | Dict };

/** Langue active. Architecture prête pour l'anglais : ajouter `en` ici. */
const dictionaries: Record<string, Dict> = { fr };
let current: Dict = dictionaries['fr']!;

export const setLocale = (locale: string) => {
  current = dictionaries[locale] ?? dictionaries['fr']!;
};

/** Traduit une clé « a.b.c » et remplace les paramètres {nom}. */
export function t(key: string, params?: Record<string, string | number>): string {
  let node: string | Dict | undefined = current;
  for (const part of key.split('.')) {
    node = typeof node === 'object' ? node[part] : undefined;
  }
  let text = typeof node === 'string' ? node : key;
  if (params) {
    for (const [k, v] of Object.entries(params)) text = text.replaceAll(`{${k}}`, String(v));
  }
  return text;
}

@Pipe({ name: 't' })
export class TPipe implements PipeTransform {
  transform(key: string, params?: Record<string, string | number>) {
    return t(key, params);
  }
}
