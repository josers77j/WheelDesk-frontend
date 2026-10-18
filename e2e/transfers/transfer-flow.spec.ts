import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';
import {
  fulfillJson,
  listMeta,
  mockAuthenticatedSession,
} from '../support/session';

async function selectCombobox(
  page: Page,
  scope: Locator,
  label: string,
  option: string,
) {
  const control = scope.locator('app-combobox-form-control').filter({
    hasText: `Seleccionar ${label}`,
  });
  await control.locator('button').click();
  const result = page.locator('div.menu:not([hidden])').locator('a').filter({ hasText: option });
  await expect(result).toBeVisible();
  await result.click();
}

async function setupTransferPage(
  page: Page,
  sameZoneDestination = false,
) {
  await mockAuthenticatedSession(page);
  const state: {
    warehouseQueries: URLSearchParams[];
    zoneQueries: URLSearchParams[];
    productQueries: URLSearchParams[];
    transferPayload?: Record<string, unknown>;
  } = { warehouseQueries: [], zoneQueries: [], productQueries: [] };

  await page.route(/\/api\/warehouses\/search-by-name(?:\?.*)?$/, async (route) => {
    const url = new URL(route.request().url());
    state.warehouseQueries.push(url.searchParams);
    const stockStatus = url.searchParams.get('stockStatus');
    await fulfillJson(
      route,
      stockStatus === 'IN_STOCK'
        ? [{ id: 1, name: 'Bodega Origen' }]
        : [
            { id: 1, name: 'Bodega Origen' },
            { id: 2, name: 'Bodega Destino' },
            { id: 3, name: 'Bodega Sin Stock' },
          ],
    );
  });

  await page.route(/\/api\/zones\/search-by-name(?:\?.*)?$/, async (route) => {
    const url = new URL(route.request().url());
    state.zoneQueries.push(url.searchParams);
    const stockStatus = url.searchParams.get('stockStatus');
    await fulfillJson(
      route,
      stockStatus === 'IN_STOCK'
        ? [{ id: 1, name: 'Bodega Origen / Zona Origen' }]
        : [
            {
              id: sameZoneDestination ? 1 : 2,
              name: sameZoneDestination
                ? 'Bodega Destino / Zona Común'
                : 'Bodega Destino / Zona Destino',
            },
          ],
    );
  });

  await page.route(/\/api\/products\/summary(?:\?.*)?$/, async (route) => {
    const url = new URL(route.request().url());
    state.productQueries.push(url.searchParams);
    await fulfillJson(route, [
      { id: 10, name: 'Producto con stock', stock: 8, zoneStock: 4 },
    ]);
  });

  await page.route('**/api/transfers', async (route) => {
    if (route.request().method() === 'POST') {
      state.transferPayload = route.request().postDataJSON() as Record<string, unknown>;
      await fulfillJson(route, {
        transferId: 1,
        status: 'COMPLETED',
        movementsCreated: 1,
      });
      return;
    }
    await fulfillJson(route, { data: [], meta: listMeta(0) });
  });

  return { state };
}

test('no consulta productos antes de seleccionar una zona de origen', async ({ page }) => {
  const { state } = await setupTransferPage(page);
  await page.goto('/#/transfers/detail/0');

  const transfer = page.locator('app-transfer-detail');
  await expect(transfer.getByText('Seleccione una zona de origen con stock para agregar productos.', { exact: true })).toBeVisible();
  await expect(transfer.getByRole('button', { name: 'Agregar producto' })).toBeDisabled();
  expect(state.productQueries).toHaveLength(0);
});

test('permite la misma bodega con una zona diferente', async ({ page }) => {
  await setupTransferPage(page);
  await page.goto('/#/transfers/detail/0');

  const transfer = page.locator('app-transfer-detail');
  const sourceWarehouse = transfer.locator('app-combobox-form-control').filter({
    hasText: 'Seleccionar bodega de origen',
  });
  await sourceWarehouse.locator('button').click();
  const sourceMenu = page.locator('div.menu:not([hidden])');
  await expect(sourceMenu.getByText('Bodega Origen', { exact: true })).toBeVisible();
  await expect(sourceMenu.getByText('Bodega Sin Stock', { exact: true })).not.toBeVisible();
  await sourceMenu.getByText('Bodega Origen', { exact: true }).click();
  await selectCombobox(page, transfer, 'origen', 'Zona Origen');

  await selectCombobox(page, transfer, 'bodega de destino', 'Bodega Origen');
  await selectCombobox(page, transfer, 'destino', 'Zona Destino');

  await expect(transfer.getByRole('button', { name: 'Zona Destino', exact: true })).toBeVisible();
});

test('no permite seleccionar la misma zona de origen y destino', async ({ page }) => {
  await setupTransferPage(page, true);
  await page.goto('/#/transfers/detail/0');

  const transfer = page.locator('app-transfer-detail');
  await selectCombobox(page, transfer, 'bodega de origen', 'Bodega Origen');
  await selectCombobox(page, transfer, 'origen', 'Zona Origen');
  await selectCombobox(page, transfer, 'bodega de destino', 'Bodega Destino');
  await selectCombobox(page, transfer, 'destino', 'Zona Común');

  await expect(
    transfer.getByRole('alert').filter({
      hasText: 'La zona de origen y destino deben ser diferentes',
    }),
  ).toBeVisible();
});

test('transfiere un producto disponible en la zona de origen', async ({ page }) => {
  const { state } = await setupTransferPage(page);
  await page.goto('/#/transfers/detail/0');

  const transfer = page.locator('app-transfer-detail');
  await selectCombobox(page, transfer, 'bodega de origen', 'Bodega Origen');
  await selectCombobox(page, transfer, 'origen', 'Zona Origen');
  await expect(transfer.getByRole('button', { name: 'Zona Origen', exact: true })).toBeVisible();
  await selectCombobox(page, transfer, 'bodega de destino', 'Bodega Destino');
  await selectCombobox(page, transfer, 'destino', 'Zona Destino');
  await expect(transfer.getByRole('button', { name: 'Zona Destino', exact: true })).toBeVisible();

  await transfer.getByRole('button', { name: 'Agregar producto' }).click();
  const modal = page.locator('dialog[open]');
  await selectCombobox(page, modal, 'producto', 'Producto con stock');
  await modal.locator('input[formcontrolname="quantity"]').fill('2');
  await modal.getByRole('button', { name: 'Guardar' }).click();

  await expect(
    transfer.locator('tbody tr').filter({ hasText: 'Producto con stock' }),
  ).toBeVisible();
  await modal.getByRole('button', { name: 'Cerrar' }).click();
  await expect(modal).not.toBeVisible();
  expect(state.warehouseQueries[0]?.get('name')).toBe('');
  expect(state.warehouseQueries[0]?.get('stockStatus')).toBe('IN_STOCK');
  const sourceZoneQuery = state.zoneQueries.find(
    (query) => query.get('stockStatus') === 'IN_STOCK',
  );
  const destinationZoneQuery = state.zoneQueries.find(
    (query) => query.get('warehouseId') === '2',
  );
  expect(sourceZoneQuery?.get('warehouseId')).toBe('1');
  expect(destinationZoneQuery?.get('warehouseId')).toBe('2');
  expect(state.productQueries[0]?.get('zoneId')).toBe('1');

  await transfer.getByRole('button', { name: 'Realizar transferencia' }).click();

  await expect.poll(() => state.transferPayload).toEqual({
    fromZoneId: 1,
    toZoneId: 2,
    details: [{ productId: 10, quantity: 2 }],
  });
});

test('no permite transferir más que el stock disponible del origen', async ({ page }) => {
  const { state } = await setupTransferPage(page);
  await page.goto('/#/transfers/detail/0');

  const transfer = page.locator('app-transfer-detail');
  await selectCombobox(page, transfer, 'bodega de origen', 'Bodega Origen');
  await selectCombobox(page, transfer, 'origen', 'Zona Origen');
  await selectCombobox(page, transfer, 'bodega de destino', 'Bodega Destino');
  await selectCombobox(page, transfer, 'destino', 'Zona Destino');
  await transfer.getByRole('button', { name: 'Agregar producto' }).click();

  const modal = page.locator('dialog[open]');
  await selectCombobox(page, modal, 'producto', 'Producto con stock');
  await modal.locator('input[formcontrolname="quantity"]').fill('5');
  await modal.getByRole('button', { name: 'Guardar' }).click();

  await expect(transfer.getByText('Solo hay 4 unidades disponibles en el origen', { exact: true })).toBeVisible();
  expect(state.transferPayload).toBeUndefined();
});

