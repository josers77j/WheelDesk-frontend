import { APP_BRANDING } from '../shared/consts/branding.const';
import { Routes } from '@angular/router';
import { LoginPageComponent } from './pages/login-page-component/login-page.component';
import { AuthLayoutComponent } from './layout/auth-layout/auth-layout';

export const authRoutes: Routes = [
  {
    path: '',
    title: `Iniciar sesión | ${APP_BRANDING.name}`,
    component: AuthLayoutComponent,

    children: [
      {
        path: 'login',
        title: `Iniciar sesión | ${APP_BRANDING.name}`,
        component: LoginPageComponent,
      },
      {
        path: '**',
        title: `Iniciar sesión | ${APP_BRANDING.name}`,
        component: LoginPageComponent,
      },
    ],
  },
];

export default authRoutes;
