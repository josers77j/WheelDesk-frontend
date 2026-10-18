import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import {
  fulfillJson,
  listMeta,
  mockAuthenticatedSession,
} from '../support/session';

type Brand = {
  id: number;
  name: string;
  description: string;
  createdAt: string;
  updatedAt: string | null;
  deletedAt: string | null;
};

const initialBrand: Brand = {
  id: 1,
  name: 'Michelin',
  description: 'Neumáticos',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: null,
  deletedAt: null,
};

async function setupBrandPage(page: Page) {
  await mockAuthenticatedSession(page);
  let records = [initialBrand];
  const state: {
    created?: { name: string; description: string };
    updated?: { id: number; body: { name: string; description: string } };
    deletedId?: number;
  } = {};

  await page.route(/\/api\/brand(?:\?.*)?$/, async (route) => {
    const request = route.request();
    if (request.method() === 'GET') {
      await fulfillJson(route, {
        data: records,
        meta: listMeta(records.length),
      });
      return;
    }
    if (request.method() === 'POST') {
      const body = request.postDataJSON() as Brand;
      state.created = body;
      const created = {
        ...body,
        id: 2,
        createdAt: '2026-01-02T00:00:00.000Z',
        updatedAt: null,
        deletedAt: null,
      };
      records = [...records, created];
      await fulfillJson(route, created);
      return;
    }
    await fulfillJson(route, { message: 'Método no permitido' }, 405);
  });

  await page.route(/\/api\/brand\/\d+$/, async (route) => {
    const request = route.request();
    const id = Number(new URL(request.url()).pathname.split('/').pop());
    if (request.method() === 'GET') {
      await fulfillJson(route, records.find((record) => record.id === id) ?? null);
      return;
    }
    if (request.method() === 'PATCH') {
      const body = request.postDataJSON() as Pick<Brand, 'name' | 'description'>;
      state.updated = { id, body };
      const updated = { ...records.find((record) => record.id === id)!, ...body };
      records = records.map((record) => (record.id === id ? updated : record));
      await fulfillJson(route, updated);
      return;
    }
    if (request.method() === 'DELETE') {
      state.deletedId = id;
      records = records.filter((record) => record.id !== id);
      await fulfillJson(route, records.find((record) => record.id === id) ?? null);
      return;
    }
    await fulfillJson(route, { message: 'Método no permitido' }, 405);
  });

  return { state };
}

test('crea una marca con solo los campos requeridos', async ({ page }) => {
  const { state } = await setupBrandPage(page);
  await page.goto('/#/brands/list');

  await page.getByRole('button', { name: 'Crear nuevo registro' }).click();
  const modal = page.locator('app-brand-form-modal dialog[open]');
  await expect(modal.getByRole('heading', { name: 'Nueva Marca' })).toBeVisible();
  await modal.locator('input[formcontrolname="name"]').fill('Goodyear');
  await modal.getByRole('button', { name: 'Guardar', exact: true }).click();

  await expect(modal).not.toBeVisible();
  await expect(page.locator('app-brands-page.component').getByText('Marca creada con éxito', { exact: true })).toBeVisible();
  expect(state.created).toEqual({ name: 'Goodyear', description: '' });
});

test('edita una marca existente', async ({ page }) => {
  const { state } = await setupBrandPage(page);
  await page.goto('/#/brands/list');

  await page.locator('app-brand-table tbody tr').filter({ hasText: 'Michelin' }).click();
  await page.getByRole('button', { name: 'Modificar' }).click();
  const modal = page.locator('app-brand-form-modal dialog[open]');
  await expect(modal.getByRole('heading', { name: 'Editar Marca' })).toBeVisible();
  await modal.locator('textarea[formcontrolname="description"]').fill('Neumáticos premium');
  await modal.getByRole('button', { name: 'Actualizar', exact: true }).click();

  await expect(modal).not.toBeVisible();
  await expect(page.locator('app-brands-page.component').getByText('Marca actualizada con éxito', { exact: true })).toBeVisible();
  expect(state.updated).toEqual({
    id: 1,
    body: { name: 'Michelin', description: 'Neumáticos premium' },
  });
});

test('no habilita actualizar una marca sin cambios reales', async ({ page }) => {
  const { state } = await setupBrandPage(page);
  await page.goto('/#/brands/detail/1');

  const save = page.getByRole('button', { name: 'Guardar', exact: true });
  await expect(save).toBeDisabled();
  await page.locator('textarea[formcontrolname="description"]').fill('Neumáticos premium');
  await expect(save).toBeEnabled();
  expect(state.updated).toBeUndefined();
});

test('elimina una marca seleccionada', async ({ page }) => {
  const { state } = await setupBrandPage(page);
  await page.goto('/#/brands/list');

  await page.locator('app-brand-table tbody tr').filter({ hasText: 'Michelin' }).click();
  await page.getByRole('button', { name: 'Eliminar' }).click();
  const confirm = page.locator('app-delete-action-modal dialog[open]');
  await expect(confirm.getByText('Advertencia!', { exact: true })).toBeVisible();
  await confirm.getByRole('button', { name: 'Eliminar', exact: true }).click();

  await expect(page.locator('app-brands-page.component').getByText('Marca eliminada con éxito', { exact: true })).toBeVisible();
  expect(state.deletedId).toBe(1);
});
