import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import {
  fulfillJson,
  listMeta,
  mockAuthenticatedSession,
} from '../support/session';

type Provider = {
  id: number;
  name: string;
  description: string;
  createdAt: string;
  updatedAt: string | null;
  deletedAt: string | null;
};

const initialProvider: Provider = {
  id: 1,
  name: 'Distribuidora Central',
  description: 'Proveedor principal',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: null,
  deletedAt: null,
};

async function setupProviderPage(page: Page) {
  await mockAuthenticatedSession(page);
  let records = [initialProvider];
  const state: {
    created?: { name: string; description: string };
    updated?: { id: number; body: { name: string; description: string } };
    deletedId?: number;
  } = {};

  await page.route(/\/api\/providers(?:\?.*)?$/, async (route) => {
    const request = route.request();
    if (request.method() === 'GET') {
      await fulfillJson(route, {
        data: records,
        meta: listMeta(records.length),
      });
      return;
    }
    if (request.method() === 'POST') {
      const body = request.postDataJSON() as Provider;
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

  await page.route(/\/api\/providers\/\d+$/, async (route) => {
    const request = route.request();
    const id = Number(new URL(request.url()).pathname.split('/').pop());
    if (request.method() === 'PATCH') {
      const body = request.postDataJSON() as Pick<Provider, 'name' | 'description'>;
      state.updated = { id, body };
      const updated = { ...records.find((record) => record.id === id)!, ...body };
      records = records.map((record) => (record.id === id ? updated : record));
      await fulfillJson(route, updated);
      return;
    }
    if (request.method() === 'DELETE') {
      state.deletedId = id;
      const deleted = records.find((record) => record.id === id);
      records = records.filter((record) => record.id !== id);
      await fulfillJson(route, deleted ?? null);
      return;
    }
    await fulfillJson(route, { message: 'Método no permitido' }, 405);
  });

  return { state };
}

test('crea un proveedor con solo los campos requeridos', async ({ page }) => {
  const { state } = await setupProviderPage(page);
  await page.goto('/#/providers/list');

  await page.getByRole('button', { name: 'Crear nuevo registro' }).click();
  const modal = page.locator('app-provider-form-modal dialog[open]');
  await expect(modal.getByRole('heading', { name: 'Nuevo Proveedor' })).toBeVisible();
  await modal.locator('input[formcontrolname="name"]').fill('Importaciones del Norte');
  await modal.getByRole('button', { name: 'Guardar', exact: true }).click();

  await expect(modal).not.toBeVisible();
  await expect(page.locator('app-providers-page').getByText('Proveedor creado con éxito', { exact: true })).toBeVisible();
  expect(state.created).toEqual({
    name: 'Importaciones del Norte',
    description: '',
  });
});

test('edita un proveedor existente', async ({ page }) => {
  const { state } = await setupProviderPage(page);
  await page.goto('/#/providers/list');

  await page.locator('app-provider-table tbody tr').filter({ hasText: 'Distribuidora Central' }).click();
  await page.getByRole('button', { name: 'Modificar' }).click();
  const modal = page.locator('app-provider-form-modal dialog[open]');
  await expect(modal.getByRole('heading', { name: 'Editar Proveedor' })).toBeVisible();
  await modal.locator('textarea[formcontrolname="description"]').fill('Proveedor actualizado');
  await modal.getByRole('button', { name: 'Actualizar', exact: true }).click();

  await expect(modal).not.toBeVisible();
  await expect(page.locator('app-providers-page').getByText('Proveedor actualizado con éxito', { exact: true })).toBeVisible();
  expect(state.updated).toEqual({
    id: 1,
    body: { name: 'Distribuidora Central', description: 'Proveedor actualizado' },
  });
});

test('elimina un proveedor seleccionado', async ({ page }) => {
  const { state } = await setupProviderPage(page);
  await page.goto('/#/providers/list');

  await page.locator('app-provider-table tbody tr').filter({ hasText: 'Distribuidora Central' }).click();
  await page.getByRole('button', { name: 'Eliminar' }).click();
  const confirm = page.locator('app-delete-action-modal dialog[open]');
  await expect(confirm.getByText('Advertencia!', { exact: true })).toBeVisible();
  await confirm.getByRole('button', { name: 'Eliminar', exact: true }).click();

  await expect(page.locator('app-providers-page').getByText('Proveedor eliminado con éxito', { exact: true })).toBeVisible();
  expect(state.deletedId).toBe(1);
});
