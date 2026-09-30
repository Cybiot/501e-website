import type { z } from 'zod';

/** Valide une entrée avec Zod ; l'erreur est convertie en 400 par le gestionnaire d'erreurs. */
export const parse = <T extends z.ZodType>(schema: T, data: unknown): z.infer<T> => schema.parse(data);

export interface Page<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export const toPage = <T>(items: T[], total: number, page: number, pageSize: number): Page<T> => ({
  items,
  page,
  pageSize,
  total,
  totalPages: Math.max(1, Math.ceil(total / pageSize)),
});
