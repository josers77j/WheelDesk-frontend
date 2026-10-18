import { APP_BRANDING } from '../shared/consts/branding.const';
import { Routes } from "@angular/router";
import { WarehousesPageComponent } from "./pages/warehouses-page/warehouses-page.component";

export const WarehouseRoutes: Routes = [
  { path: 'zones', title: `Zonas por bodega | ${APP_BRANDING.name}`, loadComponent: () => import('../zones/pages/zones-page/zones-page.component').then(module => module.ZonesPageComponent) },
  {
    path: 'list',
    title: `Bodegas | ${APP_BRANDING.name}`,
    component: WarehousesPageComponent,
  },
  {
    path: '**',
    redirectTo: 'list',
  },
];

export default WarehouseRoutes;