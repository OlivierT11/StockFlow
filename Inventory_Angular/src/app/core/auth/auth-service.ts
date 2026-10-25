import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { Observable, catchError, map, of, switchMap, tap } from 'rxjs';
import { API_BASE_URL } from '../api/api-base-url';
import { Profile, Role } from '../api/api-models';
import { todo } from '../todo';
import { TokenStorage } from './token-storage';

export interface SessionUser {
  id: number;
  email: string;
  role: Role;
}

interface LoginResponse {
  access_token: string;
  refresh_token: string;
}

/**
 * The signed-in user, and the calls that change it (login, register, logout, refresh).
 *
 * LEARN(B3) : `providedIn: 'root'` crée UNE seule instance pour toute l'application, la première fois que
 * quelque chose l'injecte. Tous les composants qui font `inject(AuthService)` lisent les mêmes signals : c'est
 * ainsi qu'un état est partagé entre composants sans le transmettre par des inputs.
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  // LEARN(B3) : inject() fonctionne dans les initialiseurs de champs et les constructeurs (un « contexte d'injection »).
  private readonly http = inject(HttpClient);
  private readonly tokens = inject(TokenStorage);
  private readonly baseUrl = inject(API_BASE_URL);

  // LEARN(B2) : un signal modifiable privé et une vue publique en lecture seule : seul ce service peut changer
  // l'utilisateur, tous les autres peuvent le lire (dans un template, `auth.user()` se ré-affiche quand il change).
  private readonly _user = signal<SessionUser | null>(null);
  readonly user = this._user.asReadonly();

  // LEARN(B2) : computed() dérive une valeur d'autres signals. Elle est mise en cache et recalculée seulement
  // quand un signal lu lors du dernier calcul change.
  readonly isLoggedIn = computed(() => this._user() !== null);

  // TODO(B2) : dérive isAdmin de user() avec computed() : true quand le rôle est 'Admin'.
  // En attendant, personne n'est admin : les boutons d'administration restent masqués partout.
  readonly isAdmin = computed(() => false);

  /** Set by the interceptor when a request gets a 401 that a refresh cannot fix: the shell shows a banner. */
  readonly sessionExpired = signal(false);

  /** Called once at startup (provideAppInitializer in app.config.ts): validates the stored token. */
  restoreSession(): Observable<unknown> {
    if (!this.tokens.access) return of(null);
    return this.loadProfile().pipe(
      catchError(() => {
        this.clearSession();
        return of(null);
      }),
    );
  }

  // LEARN(B4) : les méthodes de HttpClient renvoient un Observable *froid* : rien n'est envoyé tant que personne
  // ne s'abonne (ici : LoginPage.submit()). Il émet une fois le corps JSON décodé, puis se termine.
  // LEARN(C1) : switchMap enchaîne une deuxième requête qui a besoin du résultat de la première : le profil est
  // chargé une fois les jetons enregistrés. tap() exécute un effet de bord sans changer la valeur.
  login(email: string, password: string): Observable<SessionUser> {
    return this.http
      .post<LoginResponse>(`${this.baseUrl}/api/v1/auth/login`, { email, password })
      .pipe(
        tap((res) => this.tokens.set(res.access_token, res.refresh_token)),
        switchMap(() => this.loadProfile()),
      );
  }

  // TODO(B4) : POST /api/v1/auth/register avec { username, email, password } (l'API répond { message }),
  // puis connecte-toi avec les mêmes identifiants. Indice : enchaîne this.login(...) avec switchMap, comme
  // login() enchaîne loadProfile().
  register(username: string, email: string, password: string): Observable<SessionUser> {
    return todo('B4', 'AuthService.register');
  }

  // TODO(B4) : POST /api/v1/auth/logout avec { refreshToken: this.tokens.refresh } pour que l'API révoque les
  // jetons, puis vide TOUJOURS la session locale, même si la requête échoue (indice : les opérateurs finalize()
  // ou catchError()). Pour l'instant la session est seulement fermée localement.
  logout(): Observable<void> {
    this.clearSession();
    return of(undefined);
  }

  /**
   * Exchanges the refresh token for a new pair. Emits true when it worked, false otherwise (never errors).
   * Used by authInterceptor (step C1).
   */
  refresh(): Observable<boolean> {
    const refreshToken = this.tokens.refresh;
    if (!refreshToken) return of(false);
    return this.http
      .post<{ accessToken: string; refreshToken: string }>(`${this.baseUrl}/api/v1/auth/refresh`, {
        refreshToken,
      })
      .pipe(
        tap((res) => this.tokens.set(res.accessToken, res.refreshToken)),
        map(() => true),
        catchError(() => of(false)),
      );
  }

  private loadProfile(): Observable<SessionUser> {
    return this.http.get<Profile>(`${this.baseUrl}/api/v1/profile`).pipe(
      map((profile) => ({
        id: Number(profile.userId),
        email: profile.email ?? '',
        role: profile.role === 'Admin' ? ('Admin' as const) : ('User' as const),
      })),
      tap((user) => {
        this._user.set(user);
        this.sessionExpired.set(false);
      }),
    );
  }

  private clearSession(): void {
    this.tokens.clear();
    this._user.set(null);
    this.sessionExpired.set(false);
  }
}
