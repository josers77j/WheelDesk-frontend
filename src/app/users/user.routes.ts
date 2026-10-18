import { APP_BRANDING } from '../shared/consts/branding.const';
import { Routes } from "@angular/router";
import { UsersPageComponent } from "./pages/users-page/users-page.component";
import { UserPageComponent } from "./pages/user-page/user-page.component";


export const UserRoutes: Routes= [
  {
    path:'list',
    title: `Usuarios | ${APP_BRANDING.name}`,
    component: UsersPageComponent
  },
  {
    path:'detail/:id',
    title: `Detalle del usuario | ${APP_BRANDING.name}`,
    component: UserPageComponent
  },
  {
    path: '**',
    redirectTo: 'list'
  }
]

export default UserRoutes;
