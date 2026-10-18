import { inject } from '@angular/core';
import { Router, type CanMatchFn } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { firstValueFrom } from 'rxjs';

export const authenticatedGuard: CanMatchFn = async () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  // The interceptor already handles a 401 on /auth/profile by refreshing and
  // retrying, so we don't call refreshSession here (that would double-fetch).
  if (await firstValueFrom(authService.checkProfile())) {
    return true;
  }

  router.navigateByUrl('/auth/login');

  return false;
};
