import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import {
  fulfillJson,
  listMeta,
  mockAuthenticatedSession,
} from '../support/session';

type SessionUser = {
  id: number;
  name: string;
  email: string;
  role: 'ADMIN' | 'SELLER' | 'VIEWER';
  createdAt: string;
  refreshToken: {
    id: string;
    userAgent: string;
    deviceType: string;
    ipAddress: string;
    country: string;
    city: string;
    expiresAt: string;
  }[];
};

async function setupUserSecurityPage(page: Page, user: SessionUser) {
  await mockAuthenticatedSession(page);
  const state: { deletedId?: number; revokedTokenId?: string } = {};

  await page.route(/\/api\/users(?:\?.*)?$/, async (route) => {
    if (route.request().method() === 'GET') {
      await fulfillJson(route, {
        data: [user],
        meta: listMeta(1),
      });
      return;
    }
    await fulfillJson(route, { message: 'Método no permitido' }, 405);
  });

  await page.route(/\/api\/users\/\d+$/, async (route) => {
    if (route.request().method() === 'DELETE') {
      state.deletedId = Number(new URL(route.request().url()).pathname.split('/').pop());
      await fulfillJson(route, null);
      return;
    }
    await fulfillJson(route, { message: 'Método no permitido' }, 405);
  });

  await page.route(/\/api\/users\/revoke-sessions\/[^/]+$/, async (route) => {
    state.revokedTokenId = new URL(route.request().url()).pathname.split('/').pop();
    await route.fulfill({ status: 204 });
  });

  return { state };
}

const selfUser: SessionUser = {
  id: 1,
  name: 'Usuario Actual',
  email: 'actual@example.com',
  role: 'ADMIN',
  createdAt: '2026-01-01T00:00:00.000Z',
  refreshToken: [],
};

const userWithSession: SessionUser = {
  id: 2,
  name: 'Usuario Con Sesión',
  email: 'sesion@example.com',
  role: 'SELLER',
  createdAt: '2026-01-01T00:00:00.000Z',
  refreshToken: [
    {
      id: 'token-1',
      userAgent: 'Chrome E2E',
      deviceType: 'Desktop',
      ipAddress: '190.86.72.1',
      country: 'El Salvador',
      city: 'San Salvador',
      expiresAt: '2026-02-01T00:00:00.000Z',
    },
  ],
};

test('no permite eliminar el usuario de la sesión actual', async ({ page }) => {
  const { state } = await setupUserSecurityPage(page, selfUser);
  await page.goto('/#/users/list');

  await page.locator('app-user-table tbody tr').filter({ hasText: 'Usuario Actual' }).click();

  await expect(page.getByRole('button', { name: 'Eliminar' })).toHaveCount(0);
  expect(state.deletedId).toBeUndefined();
});

test('permite revocar una sesión activa de otro usuario', async ({ page }) => {
  const { state } = await setupUserSecurityPage(page, userWithSession);
  await page.goto('/#/users/list');

  await page.locator('app-user-table tbody tr').filter({ hasText: 'Usuario Con Sesión' }).click();
  await page.getByRole('button', { name: 'Cerrar sesiones' }).click();
  const sessions = page.locator('app-revoke-sessions-modal dialog[open]');
  await expect(sessions.getByRole('heading', { name: 'Sesiones Activas' })).toBeVisible();
  await sessions.getByRole('button', { name: 'Revocar' }).click();
  await sessions.getByRole('button', { name: '¿Confirmar?' }).click();

  await expect(page.locator('app-users-page').getByText('Sesión revocada con éxito', { exact: true })).toBeVisible();
  expect(state.revokedTokenId).toBe('token-1');
});

test('cancela la revocación sin cerrar la sesión', async ({ page }) => {
  const { state } = await setupUserSecurityPage(page, userWithSession);
  await page.goto('/#/users/list');

  await page.locator('app-user-table tbody tr').filter({ hasText: 'Usuario Con Sesión' }).click();
  await page.getByRole('button', { name: 'Cerrar sesiones' }).click();
  const sessions = page.locator('app-revoke-sessions-modal dialog[open]');
  await expect(sessions.getByRole('heading', { name: 'Sesiones Activas' })).toBeVisible();
  await sessions.getByRole('button', { name: 'Revocar' }).click();
  await expect(sessions.getByRole('button', { name: '¿Confirmar?' })).toBeVisible();
  await sessions.getByRole('button', { name: 'Cancelar' }).click();

  await expect(sessions.getByRole('button', { name: 'Revocar' })).toBeVisible();
  await expect(sessions.getByRole('button', { name: '¿Confirmar?' })).toHaveCount(0);
  expect(state.revokedTokenId).toBeUndefined();
});
