import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import {
  fulfillJson,
  listMeta,
  mockAuthenticatedSession,
} from '../support/session';

type User = {
  id: number;
  name: string;
  email: string;
  role: 'ADMIN' | 'SELLER' | 'VIEWER';
  createdAt: string;
  refreshToken: unknown[];
};

const initialUser: User = {
  id: 2,
  name: 'Ana Pérez',
  email: 'ana@example.com',
  role: 'VIEWER',
  createdAt: '2026-01-01T00:00:00.000Z',
  refreshToken: [],
};

async function setupUserPage(page: Page) {
  await mockAuthenticatedSession(page);
  let records = [initialUser];
  const state: {
    created?: { name: string; email: string };
    updated?: {
      id: number;
      body: { name: string; email: string; role: User['role'] };
    };
    deletedId?: number;
  } = {};

  await page.route(/\/api\/users(?:\?.*)?$/, async (route) => {
    const request = route.request();
    if (request.method() === 'GET') {
      await fulfillJson(route, {
        data: records,
        meta: listMeta(records.length),
      });
      return;
    }
    if (request.method() === 'POST') {
      const body = request.postDataJSON() as Pick<User, 'name' | 'email'>;
      state.created = body;
      const created: User = {
        ...body,
        id: 3,
        role: 'ADMIN',
        createdAt: '2026-01-02T00:00:00.000Z',
        refreshToken: [],
      };
      records = [...records, created];
      await fulfillJson(route, created);
      return;
    }
    await fulfillJson(route, { message: 'Método no permitido' }, 405);
  });

  await page.route(/\/api\/users\/\d+$/, async (route) => {
    const request = route.request();
    const id = Number(new URL(request.url()).pathname.split('/').pop());
    if (request.method() === 'PATCH') {
      const body = request.postDataJSON() as {
        name: string;
        email: string;
        role: User['role'];
      };
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

test('crea un usuario con los campos requeridos', async ({ page }) => {
  const { state } = await setupUserPage(page);
  await page.goto('/#/users/list');

  await page.getByRole('button', { name: 'Crear nuevo registro' }).click();
  const modal = page.locator('app-user-form-modal dialog[open]');
  await expect(modal.getByRole('heading', { name: 'Nuevo Usuario' })).toBeVisible();
  await modal.locator('input[formcontrolname="name"]').fill('Luis Sánchez');
  await modal.locator('input[formcontrolname="email"]').fill('luis@example.com');
  await modal.getByRole('button', { name: 'Guardar', exact: true }).click();

  await expect(modal).not.toBeVisible();
  await expect(page.locator('app-users-page').getByText('Usuario creado con éxito', { exact: true })).toBeVisible();
  expect(state.created).toEqual({
    name: 'Luis Sánchez',
    email: 'luis@example.com',
  });
});

test('edita un usuario y cambia su rol', async ({ page }) => {
  const { state } = await setupUserPage(page);
  await page.goto('/#/users/list');

  await page.locator('app-user-table tbody tr').filter({ hasText: 'Ana Pérez' }).click();
  await page.getByRole('button', { name: 'Modificar' }).click();
  const modal = page.locator('app-user-form-modal dialog[open]');
  await expect(modal.getByRole('heading', { name: 'Editar Usuario' })).toBeVisible();
  await modal.locator('select[formcontrolname="role"]').selectOption('SELLER');
  await modal.getByRole('button', { name: 'Actualizar', exact: true }).click();

  await expect(modal).not.toBeVisible();
  await expect(page.locator('app-users-page').getByText('Usuario actualizado con éxito', { exact: true })).toBeVisible();
  expect(state.updated).toEqual({
    id: 2,
    body: {
      name: 'Ana Pérez',
      email: 'ana@example.com',
      role: 'SELLER',
    },
  });
});

test('elimina un usuario que no es la sesión actual', async ({ page }) => {
  const { state } = await setupUserPage(page);
  await page.goto('/#/users/list');

  await page.locator('app-user-table tbody tr').filter({ hasText: 'Ana Pérez' }).click();
  await page.getByRole('button', { name: 'Eliminar' }).click();
  const confirm = page.locator('app-delete-action-modal dialog[open]');
  await expect(confirm.getByText('Advertencia!', { exact: true })).toBeVisible();
  await confirm.getByRole('button', { name: 'Eliminar', exact: true }).click();

  await expect(page.locator('app-users-page').getByText('Usuario eliminado con éxito', { exact: true })).toBeVisible();
  expect(state.deletedId).toBe(2);
});
