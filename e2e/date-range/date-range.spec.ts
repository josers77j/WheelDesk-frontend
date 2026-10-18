import { expect, test, type Page } from '@playwright/test';
import { fulfillJson, listMeta, mockAuthenticatedSession } from '../support/session';

async function setupTransfersPage(page: Page) {
  await mockAuthenticatedSession(page);
  const queries: URLSearchParams[] = [];
  await page.route(/\/api\/transfers(?:\?.*)?$/, async (route) => {
    const url = new URL(route.request().url());
    queries.push(url.searchParams);
    await fulfillJson(route, { data: [], meta: listMeta(0) });
  });
  return { queries };
}

test('permite seleccionar fechas con el input nativo, incluyendo años anteriores', async ({
  page,
}) => {
  const { queries } = await setupTransfersPage(page);
  await page.goto('/#/transfers');
  await page.getByRole('button', { name: 'Filtros' }).click();

  const range = page.locator('app-date-range');
  const from = range.getByLabel('Desde');
  const to = range.getByLabel('Hasta');

  await expect(from).toHaveAttribute('type', 'date');
  await expect(to).toHaveAttribute('type', 'date');

  await from.fill('2022-03-10');
  await to.fill('2022-03-20');
  await from.dispatchEvent('change');
  await to.dispatchEvent('change');

  await expect
    .poll(() => {
      const last = queries.at(-1);
      return { from: last?.get('from'), to: last?.get('to') };
    })
    .toEqual({ from: '2022-03-10', to: '2022-03-20' });
});
