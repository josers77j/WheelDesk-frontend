import {
  HttpClient,
  HttpErrorResponse,
  HttpStatusCode,
} from '@angular/common/http';
import { computed, inject, Injectable, signal } from '@angular/core';
import { environment } from '../../../environments/environment';
import {
  catchError,
  finalize,
  map,
  mergeMap,
  Observable,
  of,
  shareReplay,
  timeout,
} from 'rxjs';
import { User } from '../interfaces/user.interface';
import { AuthResponse } from '../interfaces/auth-response.interface';
import { LogoutResponse } from '../interfaces/logout-response.interface';
import { QueryClient } from '@tanstack/angular-query-experimental';

const baseUrl = environment.baseUrl;
export type AuthStatus = 'checking' | 'authenticated' | 'not_authenticated';
export const AUTH_STATUS = {
  CHECKING: 'checking',
  AUTHENTICATED: 'authenticated',
  NOT_AUTHENTICATED: 'not_authenticated',
} as const;

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  /**
   * How long an in-memory session/profile is considered "fresh" before we
   * re-validate against /auth/profile.
   *
   * Deliberately 1 minute shorter than the backend token lifetime
   * (~15 min) so that a request that takes a few seconds to round-trip can
   * never outlive the cookie after the frontend marked it as fresh.
   */
  private static readonly CHECK_STATUS_TTL_MS = 14 * 60 * 1000;
  /**
   * After a successful refresh, the freshly-obtained access cookie is valid
   * for a while. Requests that were sent with the OLD (already expired) token
   * may keep 401ing for a few moments; within this window we reuse that fresh
   * cookie instead of firing one refresh per 401.
   */
  private static readonly REFRESH_COOLDOWN_MS = 5_000;

  private readonly _authStatus = signal<AuthStatus>(AUTH_STATUS.CHECKING);
  private readonly _user = signal<User | null>(null);
  private readonly _lastCheckAt = signal<number | null>(null);

  // When the last refresh succeeded (so we can short-circuit duplicate
  // refreshes during a burst of 401s).
  private lastSuccessfulRefreshAt = 0;
  private sessionGeneration = 0;

  // In-flight guards so concurrent guard evaluations reuse a single request
  // instead of firing duplicate HTTP calls.
  private checkProfileInFlight$: Observable<boolean> | null = null;
  private refreshSessionInFlight$: Observable<boolean> | null = null;

  private readonly http = inject(HttpClient);
  private readonly queryClient = inject(QueryClient);

  loginErrorMessage = signal<string | null>(null);

  authStatus = computed<AuthStatus>(() => this._authStatus());
  user = computed<User | null>(() => this._user());
  readonly isAdmin = computed<boolean>(() => this.user()?.role === 'ADMIN');

  /**
   * Validates the current session using the in-memory cache when it is still
   * fresh, otherwise re-hits /auth/profile (in-flight deduplicated).
   *
   * - NOT_AUTHENTICATED (explicit logout / refresh 401) -> false, no network.
   * - Cache fresh + user data present                        -> true, no network.
   * - Otherwise                                              -> /auth/profile.
   */
  checkProfile(): Observable<boolean> {
    if (this._authStatus() === AUTH_STATUS.NOT_AUTHENTICATED) {
      return of(false);
    }

    if (this.isSessionFresh()) {
      return of(true);
    }

    if (!this.checkProfileInFlight$) {
      const generation = this.sessionGeneration;
      this.checkProfileInFlight$ = this.http
        .get<AuthResponse>(`${baseUrl}/auth/profile`, {})
        .pipe(
          map((resp) => this.handleAuthSuccess(resp, generation)),
          catchError((error: unknown) => {
            if (generation !== this.sessionGeneration) return of(false);
            // Access token expired/refused -> drop identity but leave status
            // alone so the guard can still try the refresh-session flow.
            if (
              error instanceof HttpErrorResponse &&
              error.status === HttpStatusCode.Unauthorized
            )
              return this.refreshSession();
            this.endSession();
            return of(false);
          }),
          shareReplay(1),
          finalize(() => {
            this.checkProfileInFlight$ = null;
          }),
        );
    }

    return this.checkProfileInFlight$;
  }

  /**
   * Tries to obtain a fresh session via the refresh cookie. If it returns a
   * 401 the session is genuinely over -> NOT_AUTHENTICATED.
   */
  refreshSession(): Observable<boolean> {
    if (this._authStatus() === AUTH_STATUS.NOT_AUTHENTICATED) {
      return of(false);
    }

    // A refresh just succeeded (burst window): the access cookie is already
    // fresh. Requests that were sent with the old expired token can just retry
    // with the new cookie instead of firing yet another refresh.
    if (
      this._authStatus() === AUTH_STATUS.AUTHENTICATED &&
      Date.now() - this.lastSuccessfulRefreshAt <
        AuthService.REFRESH_COOLDOWN_MS
    ) {
      return of(true);
    }

    if (!this.refreshSessionInFlight$) {
      const generation = this.sessionGeneration;
      this.refreshSessionInFlight$ = this.http
        .post<AuthResponse>(`${baseUrl}/auth/refresh-session`, {})
        .pipe(
          timeout(10_000),
          map((resp) => {
            const ok = this.handleAuthSuccess(resp, generation);
            if (ok) this.lastSuccessfulRefreshAt = Date.now();
            return ok;
          }),
          catchError((error: unknown) => {
            if (generation !== this.sessionGeneration) return of(false);
            // Refresh 401/refused -> the session / refresh-cookie is gone.
            if (error instanceof HttpErrorResponse && error.status === 401) {
              this.endSession();
            }
            return of(false);
          }),
          shareReplay(1),
          finalize(() => {
            this.refreshSessionInFlight$ = null;
          }),
        );
    }

    return this.refreshSessionInFlight$;
  }

  login(email: string, password: string): Observable<boolean> {
    const generation = this.sessionGeneration;
    return this.http
      .post<AuthResponse>(`${baseUrl}/auth/login`, {
        email,
        password,
      })
      .pipe(
        map((resp) => this.handleAuthSuccess(resp, generation)),
        catchError((error) => this.handleLoginError(error)),
      );
  }

  /**
   * Best-effort logout: clears local state regardless of the endpoint result,
   * and never throws, so the UI can always navigate away cleanly.
   */
  logout(): Observable<boolean> {
    return this.http.post<LogoutResponse>(`${baseUrl}/auth/logout`, {}).pipe(
      timeout(10_000),
      mergeMap(() => this.handleLogout()),
      catchError(() => {
        return this.handleLogout();
      }),
    );
  }

  /**
   * Invalidates the in-memory TTL cache so the next checkProfile() re-fetches
   * /auth/profile. Call this after any mutation that changes the logged-in
   * user's profile (e.g. name/email), so the cached _user data is refreshed.
   */
  invalidateProfileCache() {
    this._lastCheckAt.set(null);
  }

  // ------------------------------------------------------------------------
  // Internal helpers
  // ------------------------------------------------------------------------

  private isSessionFresh(): boolean {
    const lastCheckAt = this._lastCheckAt();
    return (
      !!lastCheckAt &&
      !!this._user() &&
      Date.now() - lastCheckAt < AuthService.CHECK_STATUS_TTL_MS
    );
  }

  private handleAuthSuccess(resp: AuthResponse, generation: number): boolean {
    if (generation !== this.sessionGeneration) return false;
    this._lastCheckAt.set(Date.now());
    this._user.set(resp.payload);
    this._authStatus.set(AUTH_STATUS.AUTHENTICATED);
    return true;
  }

  private handleLoginError(error: unknown): Observable<boolean> {
    if (error instanceof HttpErrorResponse) {
      const backendMessage = this.getBackendErrorMessage(error);
      this.loginErrorMessage.set(
        backendMessage ??
          (error.status === 0 || (error.status >= 500 && error.status < 530)
            ? 'Error de servidor'
            : 'Credenciales invalidas, intente nuevamente.'),
      );
      return of(false);
    }
    this.loginErrorMessage.set('Error desconocido del servidor');

    return of(false);
  }

  private getBackendErrorMessage(error: HttpErrorResponse): string | null {
    const body = error.error;
    if (typeof body === 'string' && body.trim()) return body;
    if (
      typeof body === 'object' &&
      body !== null &&
      'message' in body &&
      typeof body.message === 'string' &&
      body.message.trim()
    ) {
      return body.message;
    }
    return null;
  }

  private handleLogout(): Observable<boolean> {
    this.endSession();
    return of(true);
  }

  /** Invalidate local identity without another request after server-side revocation. */
  endSession(): void {
    this.sessionGeneration += 1;
    this.lastSuccessfulRefreshAt = 0;
    this._authStatus.set(AUTH_STATUS.NOT_AUTHENTICATED);
    this._user.set(null);
    this._lastCheckAt.set(null);
    this.queryClient.clear();
  }
}
