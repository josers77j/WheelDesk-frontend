import { APP_BRANDING } from '../shared/consts/branding.const';
import { Routes } from "@angular/router";
import { BrandsPageComponent } from "./pages/brands-page/brands-page.component";
import { BrandPageComponent } from "./pages/brand-page/brand-page.component";

export const BrandRoutes:Routes = [
  {
    path:'list',
    title: `Marcas | ${APP_BRANDING.name}`,
    component: BrandsPageComponent
  },
  {
    path:'detail/:id',
    title: `Detalle de la marca | ${APP_BRANDING.name}`,
    component: BrandPageComponent
  },
  {
    path:'**',
    redirectTo:'list'
  }
]

export default BrandRoutes;
