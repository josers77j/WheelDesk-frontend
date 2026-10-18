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
  brandId: number | null;
  providerId: number | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  brand: { id: number; name: string } | null;
  provider: { id: number; name: string } | null;
  taxType: string;
  itemTypeCatalogId: number;
  unitOfMeasureCatalogId: number;
  itemTypeCatalog: { id: number; name: string } | null;
  unitOfMeasureCatalog: { id: number; name: string } | null;
  tire: null;
};

const initialProduct: Product = {
  id: 1,
  name: 'Aceite sintético',
  type: 'SUPPLY',
  purchasePrice: '20',
  salePrice: '30',
  stock: 0,
  notes: 'Descripción inicial',
  brandId: 1,
  providerId: null,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  deletedAt: null,
  brand: { id: 1, name: 'Michelin' },
  provider: null,
  taxType: 'EXEMPT',
  itemTypeCatalogId: 1,
  unitOfMeasureCatalogId: 1,
  itemTypeCatalog: { id: 1, name: 'Insumo' },
  unitOfMeasureCatalog: { id: 1, name: 'Unidad' },
  tire: null,
};

async function setupSupplyPage(page: Page) {
  await mockAuthenticatedSession(page);
  let record = initialProduct;
  const state: {
    updated?: Record<string, unknown>;
    brandQueries: number;
    providerQueries: number;
  } = { brandQueries: 0, providerQueries: 0 };

  await page.route(/\/api\/brand\/search-by-name\/?(?:\?.*)?$/, async (route) => {
    state.brandQueries += 1;
    await fulfillJson(route, [{ id: 1, name: 'Michelin' }]);
  });

  await page.route(/\/api\/providers\/search-by-name\/?(?:\?.*)?$/, async (route) => {
    state.providerQueries += 1;
    await fulfillJson(route, [{ id: 1, name: 'Proveedor E2E' }]);
  });

  await page.route(/\/api\/products(?:\?.*)?$/, async (route) => {
    if (route.request().method() === 'GET') {
      await fulfillJson(route, {
        data: [record],
        meta: listMeta(1),
      });
      return;
    }
    await fulfillJson(route, { message: 'Método no permitido' }, 405);
  });

  await page.route(/\/api\/products\/\d+(?:\?.*)?$/, async (route) => {
    await fulfillJson(route, record);
  });

  await page.route(/\/api\/products\/update-supply\/\d+$/, async (route) => {
    state.updated = route.request().postDataJSON() as Record<string, unknown>;
    record = { ...record, ...state.updated };
    await fulfillJson(route, record);
  });

  return { state };
}

test('entra a productos sin iniciar transiciones superpuestas', async ({ page }) => {
  await setupSupplyPage(page);
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));

  await page.goto('/#/products/list');
  await expect(page.locator('app-tire-tab')).toBeVisible();
  await page.waitForTimeout(100);

  expect(errors).toEqual([]);
});

test('edita un insumo cambiando únicamente sus notas', async ({ page }) => {
  const { state } = await setupSupplyPage(page);
  await page.goto('/#/products/list?tabType=supply');

  const section = page.locator('app-supply-tab');
  await section.locator('app-supply-table tbody tr').filter({ hasText: 'Aceite sintético' }).click();
  await section.getByRole('button', { name: 'Modificar' }).click();
  const modal = page.locator('app-supply-form-modal dialog[open]');
  await expect(modal.getByRole('heading', { name: 'Editar Insumo' })).toBeVisible();
  await modal.locator('textarea[formcontrolname="notes"]').fill('Descripción actualizada');
  await modal.getByRole('button', { name: 'Actualizar', exact: true }).click();

  await expect(modal).not.toBeVisible();
  await expect(section.getByRole('alert').filter({ hasText: 'Producto actualizado con éxito' })).toBeVisible();
  expect(state.updated).toEqual({ notes: 'Descripción actualizada' });
});

test('seleccionar un filtro no abre el combobox que queda debajo', async ({ page }) => {
  const { state } = await setupSupplyPage(page);
  await page.setViewportSize({ width: 640, height: 900 });
  await page.goto('/#/products/list?tabType=supply');

  const section = page.locator('app-supply-tab');
  await section.getByRole('button', { name: 'Filtros' }).click();
  const brand = section.locator('app-combobox').nth(0);
  const provider = section.locator('app-combobox').nth(1);
  await provider.locator('.dropdown').evaluate((element) => {
    element.style.marginTop = '20px';
  });
  await brand.locator('button').click();
  const option = page.locator('div.menu:not([hidden]) a').filter({ hasText: 'Michelin' });
  await expect(option).toBeVisible();
  await option.dispatchEvent('pointerdown');
  await page.waitForTimeout(0);
  await provider.locator('button').dispatchEvent('click');

  await expect(brand).toContainText('Michelin');
  await expect(provider.locator('div.menu:not([hidden])')).toHaveCount(0);
  expect(state.brandQueries).toBe(1);
  expect(state.providerQueries).toBe(0);
});
