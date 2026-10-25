import { HttpErrorResponse } from '@angular/common/http';
import { TodoError } from '../todo';

// Every API error is a ProblemDetails (application/problem+json): { title, detail, status, errors? }.
// HttpClient reports a failed response as an HttpErrorResponse whose `error` is that parsed body.

/** HTTP status of an error coming from HttpClient, undefined for anything else. */
export function httpStatus(err: unknown): number | undefined {
  return err instanceof HttpErrorResponse ? err.status : undefined;
}

/**
 * Validation errors of a 400 ProblemDetails, keyed by camelCase field name ("Name" or "$.price" → "name", "price"),
 * first message only. Use it to show server-side errors next to the matching form control.
 */
export function fieldErrors(err: unknown): Record<string, string> {
  if (!(err instanceof HttpErrorResponse) || err.status !== 400 || !err.error?.errors) return {};
  const result: Record<string, string> = {};
  for (const [key, messages] of Object.entries(err.error.errors as Record<string, string[]>)) {
    const name = key.replace(/^\$\.?/, '');
    if (messages?.length) result[name.charAt(0).toLowerCase() + name.slice(1)] = messages[0];
  }
  return result;
}

/** A French, user-facing message for any error thrown by HttpClient (or by an exercise stub). */
export function errorMessage(err: unknown): string {
  if (err instanceof TodoError) return err.message;
  if (!(err instanceof HttpErrorResponse)) return 'Une erreur inattendue est survenue.';
  switch (err.status) {
    case 0:
      return 'Impossible de joindre le serveur. Vérifiez que l’API est démarrée puis réessayez.';
    case 401:
      return 'Votre session a expiré (401). Reconnectez-vous.';
    case 403:
      return 'Cette action est interdite pour votre rôle (403).';
    case 404:
      return 'L’élément demandé est introuvable (404).';
    case 429: {
      const retry = err.headers.get('Retry-After');
      return `Trop de requêtes (429). Réessayez dans ${retry ? `${retry} s` : 'quelques instants'}.`;
    }
    default:
      if (err.status >= 500) return 'Une erreur interne est survenue côté serveur.';
      return err.error?.detail ?? err.error?.title ?? `La requête a échoué (${err.status}).`;
  }
}
