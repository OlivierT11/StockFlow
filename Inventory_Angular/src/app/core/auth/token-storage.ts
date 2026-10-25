import { Injectable } from '@angular/core';

const ACCESS_KEY = 'access_token';
const REFRESH_KEY = 'refresh_token';

/**
 * The access token (15 min) and the refresh token (rotated on every refresh), kept in localStorage.
 *
 * LEARN(B3) : envelopper une API du navigateur dans un service la rend remplaçable dans les tests, et plus tard
 * côté serveur (étape C5 : localStorage n'existe pas pendant le rendu côté serveur).
 */
@Injectable({ providedIn: 'root' })
export class TokenStorage {
  get access(): string | null {
    return read(ACCESS_KEY);
  }

  get refresh(): string | null {
    return read(REFRESH_KEY);
  }

  set(access: string, refresh: string): void {
    localStorage.setItem(ACCESS_KEY, access);
    localStorage.setItem(REFRESH_KEY, refresh);
  }

  clear(): void {
    localStorage.removeItem(ACCESS_KEY);
    localStorage.removeItem(REFRESH_KEY);
  }
}

// Storage can throw (private browsing, blocked site data): treat it as empty.
function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
