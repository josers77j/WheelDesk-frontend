import { APP_BRANDING } from '../shared/consts/branding.const';
import { Routes } from '@angular/router';
import { CompanyPageComponent } from './pages/company-page/company-page.component';

export default [
  {
    path: '',
    title: `Configuración de empresa | ${APP_BRANDING.name}`,
    component: CompanyPageComponent,
  },
] satisfies Routes;
