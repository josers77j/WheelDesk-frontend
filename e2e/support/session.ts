import type { Page, Route } from '@playwright/test';

export const authenticatedUser = {
  id: 1,
  name: 'Usuario E2E',
  email: 'e2e@example.com',
  role: 'ADMIN',
};

export const listMeta = (total = 1, limit = 10) => ({
  page: 1,
  limit,
  total,
  totalPages: 1,
  hasNextPage: false,
  hasPreviousPage: false,
});

export async function mockAuthenticatedSession(page: Page) {
  await page.route('**/api/auth/profile', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ payload: authenticatedUser }),
    });
  });
}

export async function fulfillJson(
  route: Route,
  body: unknown,
  status = 200,
) {
  await route.fulfill({
    status,
    contentType: 'application/json',
    body: JSON.stringify(body),
  });
}
