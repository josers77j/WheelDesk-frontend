import { APP_BRANDING } from '../shared/consts/branding.const';
import { Routes } from "@angular/router";
import { CustomersPageComponent } from "./pages/customers-page/customers-page.component";
import { CustomerPageComponent } from "./pages/customer-page/customer-page.component";



export const CustomerRoutes: Routes = [
  {
    path: 'list',
    title: `Clientes | ${APP_BRANDING.name}`,
    component:CustomersPageComponent
  },
  {
    path: 'detail/:id',
    title: `Detalle del cliente | ${APP_BRANDING.name}`,
    component:CustomerPageComponent
  },
  {
    path: '**',
    redirectTo: 'list'
  }
]

export default CustomerRoutes;
