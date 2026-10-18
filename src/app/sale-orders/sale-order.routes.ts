import { APP_BRANDING } from '../shared/consts/branding.const';
import { Routes } from '@angular/router';
import { SaleOrdersPageComponent } from './pages/sale-orders-page/sale-orders-page.component';
import { SaleOrderDetailPageComponent } from './pages/sale-order-detail-page/sale-order-detail-page.component';

export const SaleOrderRoutes: Routes = [
  {
    path: 'list',
    title: `Órdenes de venta | ${APP_BRANDING.name}`,
    component: SaleOrdersPageComponent,
  },
  {
    path: 'detail/:id',
    title: `Detalle de la orden de venta | ${APP_BRANDING.name}`,
    component: SaleOrderDetailPageComponent,
  },
  {
    path: '**',
    redirectTo: 'list',
  },
];

export default SaleOrderRoutes;
