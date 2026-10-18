import { requestPreflight } from './request-preflight';
import { HttpContextToken, HttpErrorResponse, HttpInterceptorFn, HttpRequest } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, switchMap, tap, throwError, type Observable } from 'rxjs';
import { AuthService, AUTH_STATUS } from '../services/auth.service';

/**
 * Marks a request that has already been retried once after a token refresh,
 * so a second 401 on the same request does not loop forever.
 */
const IS_RETRY = new HttpContextToken<boolean>(() => false);

// One redirect per 401 "burst": if several requests fail together we only
// navigate to login once. Reset as soon as any request succeeds again.
let redirectingToLogin = false;

function isIncorrectMigrationPassword(
  request: HttpRequest<unknown>,
  error: HttpErrorResponse,
): boolean {
  const path = request.url.split(/[?#]/)[0];
  const body: unknown = error.error;
  // This existing module error follows successful session authentication.
  // Other 401 responses, including an expired session, still refresh normally.
  return request.method === 'POST' &&
    /\/migration\/unlock\/?$/.test(path) &&
    typeof body === 'object' && body !== null &&
    'message' in body && body.message === 'Contraseña incorrecta';
}

function goToLogin(router: Router, authService: AuthService) {
  if (redirectingToLogin) return;
  if (authService.authStatus() !== AUTH_STATUS.AUTHENTICATED) {
    redirectingToLogin = true;
    router.navigate(['/auth/login']);
  }
}

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  const rejected = requestPreflight(req, authService.user?.()?.role);
  if (rejected) return throwError(() => new HttpErrorResponse({ status: rejected.status, statusText: 'Validación local', url: req.url, error: { message: rejected.message, statusCode: rejected.status, error: 'Validación local' } }));

  const request = req.clone({ withCredentials: true });
  //  const alreadyRetried = request.headers.has(RETRY_HEADER);
  const alreadyRetried = request.context.get(IS_RETRY);
  return next(request).pipe(
    // Any successful response means the session is fine again -> allow future
    // redirects (e.g. after re-logging in).
    tap(() => {
      redirectingToLogin = false;
    }),
    catchError((error: HttpErrorResponse) => {
      // Only react to 401. Anything else (500, network, ...) just fails.
      if (error.status !== 401 || isIncorrectMigrationPassword(request, error)) {
        return throwError(() => error);
      }

      const url = request.url;

      if (url.includes('/auth/')) {
        return throwError(() => error);
      }

      // Already retried this exact request once after a refresh -> give up.
      if (alreadyRetried) {
        authService.endSession();
        goToLogin(router, authService);
        return throwError(() => error);
      }

      // Any other 401 (data API) is almost certainly an
      // expired access token. Try to obtain a fresh session
      // (refreshSession dedups concurrent calls and short-circuits a burst of
      // repeated 401s) and, on success, transparently retry once.
      return authService.refreshSession().pipe(
        switchMap((refreshed) => {
          if (!refreshed) {
            goToLogin(router, authService);
            return throwError(() => error);
          }
          return next(
            request.clone({
              withCredentials: true,
              context: request.context.set(IS_RETRY, true),
            }),
          ).pipe(
            catchError((retryError: unknown): Observable<never> => {
              if (retryError instanceof HttpErrorResponse && retryError.status === 401 && !isIncorrectMigrationPassword(request, retryError)) {
                authService.endSession();
                goToLogin(router, authService);
              }
              return throwError(() => retryError);
            }),
          );
        }),
      );
    }),
  );
};
