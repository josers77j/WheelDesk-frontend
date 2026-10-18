import { APP_BRANDING } from '../shared/consts/branding.const';
import { Routes } from '@angular/router';
import { AuditPageComponent } from './pages/audit-page/audit-page.component';

export const auditRoutes: Routes = [
  {
    path: '',
    title: `Auditoría | ${APP_BRANDING.name}`,
    component: AuditPageComponent,
  },
];

export default auditRoutes;
