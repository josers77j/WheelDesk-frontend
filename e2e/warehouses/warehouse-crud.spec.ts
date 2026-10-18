import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import {
  fulfillJson,
  listMeta,
  mockAuthenticatedSession,
} from '../support/session';

type Zone = {
  id: number;
  name: string;
  warehouseId: number;
  createdAt: string;
  updatedAt: string | null;
  deletedAt: string | null;
};

type Warehouse = {
  id: number;
  name: string;
  address: string | null;
  zones: Zone[];
  createdAt: string;
  updatedAt: string | null;
  deletedAt: string | null;
};

const initialWarehouse: Warehouse = {
  id: 1,
  name: 'Bodega Central',
  address: 'Zona centro',
  zones: [],
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: null,
  deletedAt: null,
};

async function setupWarehousePage(page: Page) {
  await mockAuthenticatedSession(page);
  let records = [initialWarehouse];
  const state: {
    created?: { name: string; address: string; zones?: { name: string }[] };
    updated?: {
      id: number;
      body: { name: string; address: string; zones?: { name: string }[] };
    };
    deletedId?: number;
  } = {};

  await page.route(/\/api\/warehouses(?:\?.*)?$/, async (route) => {
    const request = route.request();
    if (request.method() === 'GET') {
      await fulfillJson(route, {
        data: records,
        meta: listMeta(records.length),
      });
      return;
    }
    if (request.method() === 'POST') {
      const body = request.postDataJSON() as {
        name: string;
        address: string;
        zones?: { name: string }[];
      };
      state.created = body;
      const created: Warehouse = {
        ...body,
        id: 2,
        address: body.address || null,
        zones: (body.zones ?? []).map((zone, index) => ({
          ...zone,
          id: index + 2,
          warehouseId: 2,
          createdAt: '2026-01-02T00:00:00.000Z',
          updatedAt: null,
          deletedAt: null,
        })),
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

  await page.route(/\/api\/warehouses\/\d+$/, async (route) => {
    const request = route.request();
    const id = Number(new URL(request.url()).pathname.split('/').pop());
    if (request.method() === 'PATCH') {
      const body = request.postDataJSON() as {
        name: string;
        address: string;
        zones?: { name: string }[];
      };
      state.updated = { id, body };
      const current = records.find((record) => record.id === id)!;
      const updated: Warehouse = {
        ...current,
        ...body,
        address: body.address || null,
        zones: body.zones
          ? body.zones.map((zone, index) => ({
              ...zone,
              id: index + 2,
              warehouseId: id,
              createdAt: '2026-01-02T00:00:00.000Z',
              updatedAt: null,
              deletedAt: null,
            }))
          : current.zones,
      };
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

test('crea una bodega con solo el nombre', async ({ page }) => {
  const { state } = await setupWarehousePage(page);
  await page.goto('/#/warehouses/list');

  await page.getByRole('button', { name: 'Crear nuevo registro' }).click();
  const modal = page.locator('app-warehouse-form-modal dialog[open]');
  await expect(modal.getByRole('heading', { name: 'Nueva Bodega' })).toBeVisible();
  await modal.locator('input[formcontrolname="name"]').fill('Bodega Nueva');
  await modal.getByRole('button', { name: 'Guardar', exact: true }).click();

  await expect(modal).not.toBeVisible();
  await expect(page.locator('app-warehouses-page.component').getByText('Bodega creada con éxito', { exact: true })).toBeVisible();
  expect(state.created).toEqual({ name: 'Bodega Nueva', address: '' });
});

test('edita una bodega y agrega una zona', async ({ page }) => {
  const { state } = await setupWarehousePage(page);
  await page.goto('/#/warehouses/list');

  await page.locator('app-warehouse-table tbody tr').filter({ hasText: 'Bodega Central' }).click();
  await page.getByRole('button', { name: 'Modificar' }).click();
  const modal = page.locator('app-warehouse-form-modal dialog[open]');
  await expect(modal.getByRole('heading', { name: 'Editar Bodega' })).toBeVisible();
  await modal.locator('input[formcontrolname="address"]').fill('Zona industrial');
  await modal.getByPlaceholder('Nombre de la zona (Ej. Zona A)').fill('Zona Norte');
  await modal.getByRole('button', { name: 'Agregar' }).click();
  await modal.getByRole('button', { name: 'Actualizar', exact: true }).click();

  await expect(modal).not.toBeVisible();
  await expect(page.locator('app-warehouses-page.component').getByText('Bodega actualizada con éxito', { exact: true })).toBeVisible();
  expect(state.updated).toEqual({
    id: 1,
    body: {
      name: 'Bodega Central',
      address: 'Zona industrial',
      zones: [{ name: 'Zona Norte' }],
    },
  });
});

test('elimina una bodega seleccionada', async ({ page }) => {
  const { state } = await setupWarehousePage(page);
  await page.goto('/#/warehouses/list');

  await page.locator('app-warehouse-table tbody tr').filter({ hasText: 'Bodega Central' }).click();
  await page.getByRole('button', { name: 'Eliminar' }).click();
  const confirm = page.locator('app-delete-action-modal dialog[open]');
  await expect(confirm.getByText('Advertencia!', { exact: true })).toBeVisible();
  await confirm.getByRole('button', { name: 'Eliminar', exact: true }).click();

  await expect(page.locator('app-warehouses-page.component').getByText('Bodega eliminada con éxito', { exact: true })).toBeVisible();
  expect(state.deletedId).toBe(1);
});
