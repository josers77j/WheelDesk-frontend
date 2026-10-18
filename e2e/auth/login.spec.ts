import { expect, test } from '@playwright/test';

const user = {
  id: 1,
  name: 'Usuario E2E',
  email: 'e2e@example.com',
  role: 'ADMIN',
};

const dashboardSummary = {
  kpis: {
    salesTotal: 0,
    income: 0,
    profit: 0,
    documents: 0,
    rejected: 0,
    ticketAvg: 0,
    prevIncome: 0,
  },
  salesByDay: [],
  topProducts: [],
  bottomProducts: [],
  lowStock: [],
};

test.beforeEach(async ({ page }) => {
  await page.route('**/api/auth/profile', async (route) => {
    await route.fulfill({
      status: 401,
      contentType: 'application/json',
      body: JSON.stringify({ message: 'No autenticado' }),
    });
  });

  await page.route('**/api/auth/refresh-session', async (route) => {
    await route.fulfill({
      status: 401,
      contentType: 'application/json',
      body: JSON.stringify({ message: 'Sesión expirada' }),
    });
  });

  await page.route('**/api/dashboard/summary**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(dashboardSummary),
    });
  });
});

test('permite iniciar sesión y abrir el dashboard', async ({ page }) => {
  let loginPayload: unknown;

  await page.route('**/api/auth/login', async (route) => {
    loginPayload = route.request().postDataJSON();
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ payload: user }),
    });
  });

  await page.goto('/auth/login');
  await expect(page.locator('input[type="email"]')).toBeVisible();
  await expect(page.locator('input[type="password"]')).toBeVisible();

  await page.locator('input[type="email"]').fill(user.email);
  await page.locator('input[type="password"]').fill('Strongpassword123!');

  await page.getByRole('button', { name: 'Ingresar' }).click();

  await expect(page).toHaveURL(/#\/$/);
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
  await expect(page.getByText(user.name, { exact: true })).toBeVisible();
  expect(loginPayload).toEqual({
    email: user.email,
    password: 'Strongpassword123!',
  });
});
