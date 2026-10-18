import { APP_BRANDING } from './shared/consts/branding.const';
import { Routes } from '@angular/router';
import DashboardLayoutComponent from './dashboard/layouts/dashboard-layout/dashboard-layout.component';
import { notAuthenticatedGuard } from './auth/guards/not-authenticated.guard';
import { authenticatedGuard } from './auth/guards/authenticated.guard';
import { accountantWorkspaceGuard, accountingReportsGuard } from './auth/guards/accounting-reports.guard';
import { adminGuard } from './auth/guards/admin.guard';

export const routes: Routes = [
  {
    path: '',

    children: [
      {
        path: 'auth',
        loadChildren: () => import('./auth/auth.routes'),
        canMatch: [notAuthenticatedGuard],
      },
      {
        path: '',
        canMatch: [authenticatedGuard],
        component: DashboardLayoutComponent,
        canActivateChild: [accountantWorkspaceGuard],
        children: [
          { path: 'accounting-reports', title: `Reportes contables | ${APP_BRANDING.name}`, canMatch: [accountingReportsGuard], loadComponent: () => import('./accounting-reports/accounting-reports-page.component').then((module) => module.AccountingReportsPageComponent) },
          {
            path: '',
            title: `Panel de control | ${APP_BRANDING.name}`,
            loadChildren: () => import('./dashboard/dashboard.routes'),
          },
          {
            path: 'products',
            title: `Productos | ${APP_BRANDING.name}`,
            loadChildren: () => import('./products/product.routes'),
          },
          {
            path: 'brands',
            title: `Marcas | ${APP_BRANDING.name}`,
            loadChildren: () => import('./brands/brand.routes'),
          },
          {
            path: 'providers',
            title: `Proveedores | ${APP_BRANDING.name}`,
            loadChildren: () => import('./providers/provider.routes'),
          },
          {
            path: 'users',
            canMatch: [adminGuard],
            canActivateChild: [adminGuard],
            title: `Usuarios | ${APP_BRANDING.name}`,
            loadChildren: () => import('./users/user.routes'),
          },
          {
            path: 'purchase-orders',
            title: `Órdenes de compra | ${APP_BRANDING.name}`,
            loadChildren: () =>
              import('./purchases-order/purchase-order.route'),
          },
          {
            path: 'customers',
            title: `Clientes | ${APP_BRANDING.name}`,
            loadChildren: () => import('./customers/customer.routes'),
          },
          {
            path: 'warehouses',
            title: `Bodegas | ${APP_BRANDING.name}`,
            loadChildren: () => import('./warehouses/warehouse.routes'),
          },
          {
            path: 'transfers',
            title: `Transferencias | ${APP_BRANDING.name}`,
            loadChildren: () => import('./transfers/transfer.routes'),
          },
          {
            path: 'sale-orders',
            title: `Órdenes de venta | ${APP_BRANDING.name}`,
            loadChildren: () => import('./sale-orders/sale-order.routes'),
          },
          {
            path: 'quotations',
            title: `Cotizaciones | ${APP_BRANDING.name}`,
            loadChildren: () => import('./quotations/quotation.routes'),
          },
          {
            path: 'audit',
            canMatch: [adminGuard],
            canActivateChild: [adminGuard],
            title: `Auditoría | ${APP_BRANDING.name}`,
            loadChildren: () => import('./audit/audit.routes'),
          },
          {
            path: 'migration',
            canMatch: [adminGuard],
            canActivateChild: [adminGuard],
            title: `Importación de facturas | ${APP_BRANDING.name}`,
            loadChildren: () => import('./migration/migration.routes'),
          },
          {
            path: 'company',
            canMatch: [adminGuard],
            canActivateChild: [adminGuard],
            title: `Configuración de empresa | ${APP_BRANDING.name}`,
            loadChildren: () => import('./company/company.routes'),
          },
        ],
      },
    ],
  },
];
