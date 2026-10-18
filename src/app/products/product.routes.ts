import { APP_BRANDING } from '../shared/consts/branding.const';
import { Routes } from "@angular/router";
import { ProductsPageComponent } from "./pages/products-page/products-page.component";

import { ProductPageComponent } from "./pages/product-page/product-page.component";

export const ProductRoutes: Routes = [
  {
    path: 'list',
    title: `Productos | ${APP_BRANDING.name}`,
    component: ProductsPageComponent
  },
  {
    path: 'detail/:id',
    title: `Detalle del producto | ${APP_BRANDING.name}`,
    component: ProductPageComponent
  },
  {
    path: '**',
    redirectTo: 'list'
  }
]

export default ProductRoutes;
