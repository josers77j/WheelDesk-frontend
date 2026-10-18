import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';
import {
  fulfillJson,
  listMeta,
  mockAuthenticatedSession,
} from '../support/session';

type Customer = {
  id: number;
  name: string;
  isTaxPayer: boolean;
  email: string;
  phone: string;
  customerType: 'NATURAL' | 'LEGAL' | null;
  districtId: number;
  address: string;
  createdById: number | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  district: null;
  taxInfo: Record<string, unknown>;
};

const initialCustomer: Customer = {
  id: 1,
  name: 'Cliente Natural',
  isTaxPayer: false,
  email: '',
  phone: '',
  customerType: null,
  districtId: 0,
  address: 'Dirección inicial',
  createdById: null,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  deletedAt: null,
  district: null,
  taxInfo: {},
};

async function setupCustomerPage(page: Page, seeded: Customer[] = [initialCustomer]) {
  await mockAuthenticatedSession(page);
  let records = [...seeded];
  const state: {
    created?: Record<string, unknown>;
    updated?: { id: number; body: Record<string, unknown> };
    deletedId?: number;
  } = {};

  await page.route(/\/api\/customers(?:\?.*)?$/, async (route) => {
    const request = route.request();
    if (request.method() === 'GET') {
      await fulfillJson(route, {
        data: records,
        meta: listMeta(records.length),
      });
      return;
    }
    if (request.method() === 'POST') {
      const body = request.postDataJSON() as Record<string, unknown>;
      state.created = body;
      const created: Customer = {
        ...initialCustomer,
        ...body,
        id: 2,
        name: String(body.name),
        isTaxPayer: Boolean(body.isTaxPayer),
        email: String(body.email ?? ''),
        phone: String(body.phone ?? ''),
        customerType: (body.customerType as Customer['customerType']) ?? null,
        districtId: Number(body.districtId ?? 0),
        address: String(body.address ?? ''),
        createdAt: '2026-01-02T00:00:00.000Z',
        updatedAt: '2026-01-02T00:00:00.000Z',
      };
      records = [...records, created];
      await fulfillJson(route, created);
      return;
    }
    await fulfillJson(route, { message: 'Método no permitido' }, 405);
  });

  await page.route(/\/api\/customers\/\d+$/, async (route) => {
    const request = route.request();
    const id = Number(new URL(request.url()).pathname.split('/').pop());
    if (request.method() === 'PATCH') {
      const body = request.postDataJSON() as Record<string, unknown>;
      state.updated = { id, body };
      const current = records.find((record) => record.id === id)!;
      const updated = { ...current, ...body } as Customer;
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

  await page.route('**/api/catalog/category/tax-document-type**', async (route) => {
    await fulfillJson(route, []);
  });

  return { state };
}

test('crea un cliente no contribuyente con datos parciales', async ({ page }) => {
  const { state } = await setupCustomerPage(page);
  await page.goto('/#/customers/list');

  await page.getByRole('button', { name: 'Crear nuevo registro' }).click();
  const modal = page.locator('app-customer-form-modal dialog[open]');
  await expect(modal.getByRole('heading', { name: 'Nuevo Cliente' })).toBeVisible();
  await modal.locator('input[formcontrolname="name"]').fill('Cliente Nuevo');
  await modal.getByRole('button', { name: 'Guardar', exact: true }).click();

  await expect(modal).not.toBeVisible();
  await expect(page.locator('app-customers-page.component').getByText('Cliente creado con éxito', { exact: true })).toBeVisible();
  expect(state.created).toMatchObject({
    name: 'Cliente Nuevo',
    isTaxPayer: false,
  });
  expect(state.created).not.toHaveProperty('taxInfo');
});

test('crea un cliente con tipo jurídico seleccionado por radio', async ({ page }) => {
  const { state } = await setupCustomerPage(page);
  await page.goto('/#/customers/list');

  await page.getByRole('button', { name: 'Crear nuevo registro' }).click();
  const modal = page.locator('app-customer-form-modal dialog[open]');
  await expect(modal.getByRole('heading', { name: 'Nuevo Cliente' })).toBeVisible();
  await modal.locator('input[formcontrolname="name"]').fill('Cliente Jurídico');
  await modal.getByText('Jurídico', { exact: true }).click();
  await expect(modal.getByRole('radio', { name: 'Jurídico' })).toBeChecked();
  await modal.getByRole('button', { name: 'Guardar', exact: true }).click();

  await expect(modal).not.toBeVisible();
  await expect(page.locator('app-customers-page.component').getByText('Cliente creado con éxito', { exact: true })).toBeVisible();
  expect(state.created).toMatchObject({
    name: 'Cliente Jurídico',
    customerType: 'LEGAL',
  });
});

test('edita un cliente no contribuyente', async ({ page }) => {
  const { state } = await setupCustomerPage(page);
  await page.goto('/#/customers/list');

  await page.locator('app-customer-table tbody tr').filter({ hasText: 'Cliente Natural' }).click();
  await page.getByRole('button', { name: 'Modificar' }).click();
  const modal = page.locator('app-customer-form-modal dialog[open]');
  await expect(modal.getByRole('heading', { name: 'Editar Cliente' })).toBeVisible();
  await modal.locator('input[formcontrolname="address"]').fill('Dirección actualizada');
  await modal.getByRole('button', { name: 'Actualizar', exact: true }).click();

  await expect(modal).not.toBeVisible();
  await expect(page.locator('app-customers-page.component').getByText('Cliente actualizado con éxito', { exact: true })).toBeVisible();
  expect(state.updated).toEqual({
    id: 1,
    body: { address: 'Dirección actualizada' },
  });
});

test('elimina un cliente seleccionado', async ({ page }) => {
  const { state } = await setupCustomerPage(page);
  await page.goto('/#/customers/list');

  await page.locator('app-customer-table tbody tr').filter({ hasText: 'Cliente Natural' }).click();
  await page.getByRole('button', { name: 'Eliminar' }).click();
  const confirm = page.locator('app-delete-action-modal dialog[open]');
  await expect(confirm.getByText('Advertencia!', { exact: true })).toBeVisible();
  await confirm.getByRole('button', { name: 'Eliminar', exact: true }).click();

  await expect(page.locator('app-customers-page.component').getByText('Cliente eliminado con éxito', { exact: true })).toBeVisible();
  expect(state.deletedId).toBe(1);
});

/** Contribuyente natural con exactamente los mismos faltantes que el no contribuyente. */
const taxPayerWithMissingData: Customer = {
  ...initialCustomer,
  id: 10,
  name: 'Contribuyente Natural Incompleto',
  isTaxPayer: true,
  customerType: 'NATURAL',
  districtId: 0,
  address: '',
  taxInfo: {},
};

/** Contribuyente jurídico con los mismos faltantes. */
const legalTaxPayerWithMissingData: Customer = {
  ...taxPayerWithMissingData,
  id: 11,
  name: 'Contribuyente Jurídico Incompleto',
  customerType: 'LEGAL',
};

/** No contribuyente con idénticos faltantes: no debe marcarse. */
const nonTaxPayerWithMissingData: Customer = {
  ...initialCustomer,
  id: 12,
  name: 'No Contribuyente Incompleto',
  isTaxPayer: false,
  districtId: 0,
  address: '',
  taxInfo: {},
};

const warningIcon = (row: Locator) => row.locator('span.icon-\\[tabler--alert-triangle\\]');
const warningTooltip = (row: Locator) => row.locator('[data-tip]');

test('marca con warning solo al contribuyente con datos faltantes', async ({ page }) => {
  await setupCustomerPage(page, [taxPayerWithMissingData, nonTaxPayerWithMissingData]);
  await page.goto('/#/customers/list');

  const rows = page.locator('app-customer-table tbody tr');

  const contributorRow = rows.filter({ hasText: 'Contribuyente Natural Incompleto' });
  await expect(contributorRow).toHaveCount(1);
  await expect(warningIcon(contributorRow)).toBeVisible();
  await expect(warningTooltip(contributorRow)).toHaveAttribute(
    'data-tip',
    'Faltan: NRC, actividad económica, nombre comercial, tipo de documento, dirección, distrito',
  );

  const nonTaxPayerRow = rows.filter({ hasText: 'No Contribuyente Incompleto' });
  await expect(nonTaxPayerRow).toHaveCount(1);
  await expect(warningIcon(nonTaxPayerRow)).toHaveCount(0);
  await expect(warningTooltip(nonTaxPayerRow)).toHaveCount(0);
});

test('marca con warning al contribuyente jurídico con datos faltantes', async ({ page }) => {
  await setupCustomerPage(page, [legalTaxPayerWithMissingData]);
  await page.goto('/#/customers/list');

  const row = page
    .locator('app-customer-table tbody tr')
    .filter({ hasText: 'Contribuyente Jurídico Incompleto' });
  await expect(row).toHaveCount(1);
  await expect(warningIcon(row)).toBeVisible();
  await expect(warningTooltip(row)).toHaveAttribute(
    'data-tip',
    'Faltan: NRC, actividad económica, nombre comercial, tipo de documento, dirección, distrito',
  );
});

test('no marca con warning al contribuyente con todos sus datos', async ({ page }) => {
  const completeTaxPayer: Customer = {
    ...initialCustomer,
    id: 13,
    name: 'Contribuyente Completo',
    isTaxPayer: true,
    customerType: 'NATURAL',
    districtId: 5,
    address: 'Dirección completa',
    taxInfo: {
      nrc: '1234-5678901',
      tradeName: 'Cliente Contribuyente Completo',
      taxDocumentTypeId: 1,
      taxDocumentType: { id: 1, code: '36', name: 'NIT' },
      taxDocumentNumber: '0614-1234567',
      economicActivityId: 1,
      economicActivity: { id: 1, code: '6201', name: 'Programación', isLegacy: false },
    },
  };
  await setupCustomerPage(page, [completeTaxPayer]);
  await page.goto('/#/customers/list');

  const row = page.locator('app-customer-table tbody tr').filter({ hasText: 'Contribuyente Completo' });
  await expect(row).toHaveCount(1);
  await expect(warningIcon(row)).toHaveCount(0);
});
