import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ApiErrorBody } from './models';

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
  }
}

type Params = Record<string, string | number | boolean | null | undefined>;

const toParams = (p?: Params) => {
  let hp = new HttpParams();
  for (const [k, v] of Object.entries(p ?? {})) {
    if (v !== undefined && v !== null && v !== '') hp = hp.set(k, String(v));
  }
  return hp;
};

/** Normalise toutes les erreurs HTTP en ApiError (message en français prêt à afficher). */
function toApiError(err: unknown): ApiError {
  if (err instanceof HttpErrorResponse) {
    const body = err.error as ApiErrorBody | null;
    if (body?.error) return new ApiError(err.status, body.error.code, body.error.message, body.error.details);
    if (err.status === 0) return new ApiError(0, 'NETWORK', 'Connexion au serveur impossible. Vérifie ta connexion.');
    if (err.status === 429) return new ApiError(429, 'RATE_LIMIT', 'Trop de requêtes. Patiente quelques instants.');
    return new ApiError(err.status, 'HTTP_ERROR', 'Une erreur est survenue. Réessaie dans un instant.');
  }
  return new ApiError(0, 'UNKNOWN', 'Une erreur inattendue est survenue.');
}

/** Client HTTP typé de l'API (promesses, erreurs normalisées). */
@Injectable({ providedIn: 'root' })
export class Api {
  private readonly http = inject(HttpClient);

  private async run<T>(obs: import('rxjs').Observable<T>): Promise<T> {
    try {
      return await firstValueFrom(obs);
    } catch (err) {
      throw toApiError(err);
    }
  }

  get<T>(url: string, params?: Params) {
    return this.run(this.http.get<T>(`/api${url}`, { params: toParams(params) }));
  }
  post<T>(url: string, body: unknown = {}) {
    return this.run(this.http.post<T>(`/api${url}`, body));
  }
  put<T>(url: string, body: unknown = {}) {
    return this.run(this.http.put<T>(`/api${url}`, body));
  }
  patch<T>(url: string, body: unknown = {}) {
    return this.run(this.http.patch<T>(`/api${url}`, body));
  }
  delete<T>(url: string, body?: unknown) {
    return this.run(this.http.delete<T>(`/api${url}`, { body }));
  }
  upload<T>(url: string, form: FormData, method: 'POST' | 'PATCH' = 'POST') {
    return this.run(this.http.request<T>(method, `/api${url}`, { body: form }));
  }
}
