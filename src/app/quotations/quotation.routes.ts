import { APP_BRANDING } from '../shared/consts/branding.const';
import { Routes } from '@angular/router';

const quotationRoutes: Routes = [
  { path: 'new', title: `Nueva cotización | ${APP_BRANDING.name}`, loadComponent: () => import('./pages/quotation-form-page/quotation-form-page.component').then((module) => module.QuotationFormPageComponent) },
  { path: 'edit/:id', title: `Editar cotización | ${APP_BRANDING.name}`, loadComponent: () => import('./pages/quotation-form-page/quotation-form-page.component').then((module) => module.QuotationFormPageComponent) },
  {
    path: 'list',
    title: `Cotizaciones | ${APP_BRANDING.name}`,
    loadComponent: () =>
      import('./pages/quotations-page/quotations-page.component').then(
        (module) => module.QuotationsPageComponent,
      ),
  },
  {
    path: 'detail/:id',
    title: `Detalle de la cotización | ${APP_BRANDING.name}`,
    loadComponent: () =>
      import(
        './pages/quotation-detail-page/quotation-detail-page.component'
      ).then((module) => module.QuotationDetailPageComponent),
  },
  { path: '', pathMatch: 'full', redirectTo: 'list' },
];

export default quotationRoutes;
