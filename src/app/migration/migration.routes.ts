import { APP_BRANDING } from '../shared/consts/branding.const';
import { Routes } from '@angular/router';
import { MigrationPageComponent } from './pages/migration-page/migration-page.component';

export const migrationRoutes: Routes = [
  {
    path: '',
    title: `Importación de facturas | ${APP_BRANDING.name}`,
    component: MigrationPageComponent,
  },
];

export default migrationRoutes;
