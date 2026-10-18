import { inject } from '@angular/core';
import { Router, UrlTree } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { AlertService } from '../../shared/components/alert/alert.service';
import { AuthService } from '../services/auth.service';

// Use at both the lazy module boundary and its child navigation boundary.
export async function adminGuard(): Promise<boolean | UrlTree> {
  const authService = inject(AuthService);
  const router = inject(Router);
  const alerts = inject(AlertService);

  if (!await firstValueFrom(authService.checkProfile())) {
    return router.createUrlTree(['/auth/login']);
  }
  if (authService.isAdmin()) return true;

  alerts.showError('No tienes permiso para acceder a esta sección.');
  return router.createUrlTree(['/']);
}
