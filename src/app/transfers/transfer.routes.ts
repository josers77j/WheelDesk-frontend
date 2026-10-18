import { APP_BRANDING } from '../shared/consts/branding.const';
import { Routes } from "@angular/router";
import { TransfersPageComponent } from "./pages/transfers-page/transfers-page.component";
import { TransferPageComponent } from "./pages/transfer-page/transfer-page.component";

export const TransferRoutes: Routes = [
  {
    path: "list",
    title: `Transferencias | ${APP_BRANDING.name}`,
    component: TransfersPageComponent,
  },
  {
    path: "detail/:id",
    title: `Detalle de la transferencia | ${APP_BRANDING.name}`,
    component: TransferPageComponent,
  },
  {
    path: "**",
    redirectTo: "list",
  },
];

export default TransferRoutes;