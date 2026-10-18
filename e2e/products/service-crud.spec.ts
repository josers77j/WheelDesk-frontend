import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import {
  fulfillJson,
  listMeta,
  mockAuthenticatedSession,
} from '../support/session';

type Product = {
  id: number;
  name: string;
  type: string;
  purchasePrice: string;
  salePrice: string;
  stock: number;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
};

const initialProduct: Product = {
  id: 1,
  name: 'Balanceo',
  type: 'SERVICE',
  purchasePrice: '',
  salePrice: '15',
  stock: 0,
  notes: 'Servicio de mantenimiento',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  deletedAt: null,
};

async function setupServicePage(page: Page) {
  await mockAuthenticatedSession(page);
  let records = [initialProduct];
  const state: { deletedId?: number } = {};

  await page.route(/\/api\/products(?:\?.*)?$/, async (route) => {
    if (route.request().method() === 'GET') {
      await fulfillJson(route, {
        data: records,
        meta: listMeta(records.length),
      });
      return;
    }
    await fulfillJson(route, { message: 'Método no permitido' }, 405);
  });

  await page.route(/\/api\/products\/\d+$/, async (route) => {
    if (route.request().method() === 'DELETE') {
      state.deletedId = Number(new URL(route.request().url()).pathname.split('/').pop());
      records = [];
      await route.fulfill({ status: 204 });
      return;
    }
    await fulfillJson(route, { message: 'Método no permitido' }, 405);
  });

  return { state };
}

test('elimina un servicio seleccionado', async ({ page }) => {
  const { state } = await setupServicePage(page);
  await page.goto('/#/products/list?tabType=service');

  const section = page.locator('app-service-tab');
  await section.locator('app-service-table tbody tr').filter({ hasText: 'Balanceo' }).click();
  await section.getByRole('button', { name: 'Eliminar' }).click();
  const confirm = page.locator('app-delete-action-modal dialog[open]');
  await expect(confirm.getByText('Advertencia!', { exact: true })).toBeVisible();
  await confirm.getByRole('button', { name: 'Eliminar', exact: true }).click();

  await expect(section.getByRole('alert').filter({ hasText: 'Producto eliminado con éxito' })).toBeVisible();
  expect(state.deletedId).toBe(1);
});
