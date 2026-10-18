import { APP_BRANDING } from '../shared/consts/branding.const';
import { Routes } from "@angular/router";
import { PurchaseOrdersPageComponent } from "./pages/purchase-orders-page/purchase-orders-page.component";
import { PurchaseOrderPageComponent } from "./pages/purchase-order-page/purchase-order-page.component";

export const PurchaseOrderRoutes: Routes = [
  {
    path: 'list',
    title: `Órdenes de compra | ${APP_BRANDING.name}`,
    component: PurchaseOrdersPageComponent
  },
  {
    path:'detail/:id',
    title: `Detalle de la orden de compra | ${APP_BRANDING.name}`,
    component: PurchaseOrderPageComponent
  },
  {
    path:'**',
    redirectTo: 'list'
  }
]


export default PurchaseOrderRoutes;
