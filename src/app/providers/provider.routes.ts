import { APP_BRANDING } from '../shared/consts/branding.const';
import { Routes } from "@angular/router";
import { ProvidersPageComponent } from "./pages/providers-page/providers-page.component";
import { ProviderPageComponent } from "./pages/provider-page/provider-page.component";

export const ProviderRoutes: Routes= [
  {
    path:'list',
    title: `Proveedores | ${APP_BRANDING.name}`,
    component: ProvidersPageComponent
  },
  {
    path:'detail/:id',
    title: `Detalle del proveedor | ${APP_BRANDING.name}`,
    component: ProviderPageComponent
  },
  {
    path: '**',
    redirectTo: 'list'
  }
]

export default ProviderRoutes;
