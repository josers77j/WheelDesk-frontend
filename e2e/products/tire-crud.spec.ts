import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';
import {
  fulfillJson,
  listMeta,
  mockAuthenticatedSession,
} from '../support/session';

async function selectCombobox(
  modal: Locator,
  label: string,
  option: string,
) {
  const control = modal.locator('app-combobox-form-control').filter({
    hasText: `Seleccionar ${label}`,
  });
  await control.locator('button').click();
  const panel = modal.locator('div.menu:not([hidden])');
  const result = panel.locator('a').filter({ hasText: option });
  await expect(result).toBeVisible();
  await result.click();
}

async function setupTirePage(page: Page) {
  await mockAuthenticatedSession(page);
  const state: {
    created?: Record<string, unknown>;
    brandQueries: number;
    unitQueries: number;
  } = { brandQueries: 0, unitQueries: 0 };

  await page.route(/\/api\/products(?:\?.*)?$/, async (route) => {
    if (route.request().method() === 'GET') {
      await fulfillJson(route, { data: [], meta: listMeta(0) });
      return;
    }
    await fulfillJson(route, { message: 'Método no permitido' }, 405);
  });

  await page.route('**/api/products/vehicle-types', async (route) => {
    await fulfillJson(route, [{ id: 1, name: 'Sedan' }]);
  });

  await page.route('**/api/brand/search-by-name/**', async (route) => {
    state.brandQueries += 1;
    await fulfillJson(route, [{ id: 1, name: 'Michelin' }]);
  });

  await page.route('**/api/catalog/category/item-type**', async (route) => {
    await fulfillJson(route, [{ id: 1, name: 'Llanta' }]);
  });

  await page.route('**/api/catalog/category/unit-of-measure**', async (route) => {
    state.unitQueries += 1;
    await fulfillJson(route, [{ id: 1, name: 'Unidad' }]);
  });

  await page.route('**/api/products/create-tire', async (route) => {
    state.created = route.request().postDataJSON() as Record<string, unknown>;
    await fulfillJson(route, { id: 2, type: 'TIRE' });
  });

  return { state };
}

test('crea una llanta con los datos requeridos', async ({ page }) => {
  const { state } = await setupTirePage(page);
  await page.goto('/#/products/list?tabType=tire');

  const section = page.locator('app-tire-tab');
  await section.getByRole('button', { name: 'Crear nuevo registro' }).click();
  const modal = page.locator('app-tire-form-modal dialog[open]');
  await expect(modal.getByRole('heading', { name: 'Nueva Llanta' })).toBeVisible();

  await selectCombobox(modal, 'marca', 'Michelin');
  await modal.locator('input[formcontrolname="purchasePrice"]').fill('50');
  await modal.locator('input[formcontrolname="salePrice"]').fill('75');
  await modal.getByRole('radio', { name: 'Nuevo', exact: true }).check();
  await modal.getByRole('radio', { name: 'A', exact: true }).check();
  await modal.locator('input[formcontrolname="width"]').fill('205');
  await modal.locator('input[formcontrolname="rimDiameter"]').fill('17');
  await modal.locator('select[formcontrolname="itemTypeCatalogId"]').selectOption({ label: 'Llanta' });
  await selectCombobox(modal, 'unidad de medida', 'Unidad');
  const vehicleType = modal.locator('label').filter({ hasText: 'Sedan' }).locator('input');
  await expect(vehicleType).toHaveCount(1);
  await vehicleType.evaluate((input: HTMLInputElement) => input.click());
  await modal.getByRole('button', { name: 'Guardar', exact: true }).click();

  await expect(modal).not.toBeVisible();
  await expect(section.getByRole('alert').filter({ hasText: 'Producto creado con éxito' })).toBeVisible();
  expect(state.created).toMatchObject({
    brandId: 1,
    purchasePrice: 50,
    salePrice: 75,
    itemTypeCatalogId: 1,
    unitOfMeasureCatalogId: 1,
    providerId: 0,
    tire: {
      width: 205,
      rimDiameter: 17,
      construction: 'RADIAL',
      condition: 'NEW',
      quality: 'A',
      vehicleTypeId: [1],
    },
  });
});

test('seleccionar un combobox no abre el combobox inferior', async ({ page }) => {
  const { state } = await setupTirePage(page);
  await page.setViewportSize({ width: 640, height: 900 });
  await page.goto('/#/products/list?tabType=tire');

  const section = page.locator('app-tire-tab');
  await section.getByRole('button', { name: 'Crear nuevo registro' }).click();
  const modal = page.locator('app-tire-form-modal dialog[open]');
  const brand = modal.locator('app-combobox-form-control').nth(0);
  const unit = modal.locator('app-combobox-form-control').nth(1);
  await unit.evaluate((element) => {
    (element as HTMLElement).style.marginTop = '-800px';
  });

  await brand.locator('button').click();
  const option = modal.locator('div.menu:not([hidden]) a').filter({ hasText: 'Michelin' });
  await expect(option).toBeVisible();
  await option.dispatchEvent('pointerdown');
  await page.waitForTimeout(0);
  await unit.locator('button').dispatchEvent('pointerup');
  await unit.locator('button').dispatchEvent('click');

  await expect(brand.locator('button')).toContainText('Michelin');
  await expect(unit.locator('div.menu:not([hidden])')).toHaveCount(0);
  expect(state.brandQueries).toBe(1);
  expect(state.unitQueries).toBe(0);
});

test('seleccionar el combobox inferior no selecciona el superior cuando abre hacia arriba', async ({ page }) => {
  const { state } = await setupTirePage(page);
  await page.setViewportSize({ width: 640, height: 500 });
  await page.goto('/#/products/list?tabType=tire');

  const section = page.locator('app-tire-tab');
  await section.getByRole('button', { name: 'Crear nuevo registro' }).click();
  const modal = page.locator('app-tire-form-modal dialog[open]');
  const brand = modal.locator('app-combobox-form-control').nth(0);
  const unit = modal.locator('app-combobox-form-control').nth(1);
  await brand.evaluate((element) => {
    (element as HTMLElement).style.cssText = 'position: fixed; top: 70px; left: 20px; width: 500px; z-index: 1;';
  });
  await unit.evaluate((element) => {
    (element as HTMLElement).style.cssText = 'position: fixed; top: 350px; left: 20px; width: 500px; z-index: 1;';
  });

  await unit.locator('button').click();
  const option = modal.locator('div.menu:not([hidden]) a').filter({ hasText: 'Unidad' });
  await expect(option).toBeVisible();
  await option.dispatchEvent('pointerdown');
  await page.waitForTimeout(0);
  await brand.locator('button').dispatchEvent('pointerup');
  await brand.locator('button').dispatchEvent('click');

  await expect(unit.locator('button')).toContainText('Unidad');
  await expect(brand.locator('div.menu:not([hidden])')).toHaveCount(0);
  expect(state.unitQueries).toBe(1);
  expect(state.brandQueries).toBe(0);
});
