import { APP_BRANDING } from '../shared/consts/branding.const';
import { Routes } from "@angular/router";
import { DashboardPageComponent } from "./pages/dashboard-page/dashboard-page.component";


export const dashboardRoutes: Routes = [
  {
    path:'',
    title: `Panel de control | ${APP_BRANDING.name}`,
    component: DashboardPageComponent
  }
]

export default dashboardRoutes;
