import { inject } from '@angular/core';
import { CanActivateChildFn, CanMatchFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

export const accountantWorkspaceGuard: CanActivateChildFn = (_, state) => {
  const role = inject(AuthService).user()?.role;
  return role !== 'ACCOUNTANT' || ['/', '/accounting-reports'].includes(state.url.split('?')[0])
    ? true : inject(Router).createUrlTree(['/accounting-reports']);
};
export const accountingReportsGuard: CanMatchFn = () => {
  const role = inject(AuthService).user()?.role;
  return role === 'ADMIN' || role === 'ACCOUNTANT'
    ? true : inject(Router).createUrlTree(['/']);
};
