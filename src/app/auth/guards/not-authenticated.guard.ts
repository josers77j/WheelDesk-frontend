import {
  Router,
  type CanMatchFn,
} from '@angular/router';
import { AuthService } from '../services/auth.service';
import { firstValueFrom } from 'rxjs';
import { inject } from '@angular/core';

export const notAuthenticatedGuard: CanMatchFn = async () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  // The interceptor resolves an expired access token on /auth/profile, so an
  // authenticated user reaching login gets redirected to '/' automatically.
  if (await firstValueFrom(authService.checkProfile())) {
    router.navigateByUrl(authService.user()?.role === 'ACCOUNTANT' ? '/accounting-reports' : '/');
    return false;
  }

  return true;
};
