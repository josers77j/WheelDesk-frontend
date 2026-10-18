import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';
import {
  fulfillJson,
  listMeta,
  mockAuthenticatedSession,
} from '../support/session';

type SaleOrderFixture = {
  id: number;
  customerId: number | null;
  documentNumber: string;
  documentType: string;
  documentTypeCode: string;
  subtotal: string;
  iva: string;
  total: string;
  globalDiscount: string;
  status: string;
  emissionStatus: string;
  customerName: string;
  customerDocumentNumber: string | null;
  createdAt: string;
  updatedAt: string;
  customer: { id: number; name: string };
  details: {
    product: { id: number; name: string };
    unitPrice: string;
    quantity: number;
    subtotal: string;
    zone: { id: number; name: string };
  }[];
  electronicInvoiceDocument: {
    id: number;
    generationCode: string;
    controlNumber: string;
    lifecycleStatus: string;
    selloRecibido: string | null;
    selloRecibidoAt: string | null;
    issueDateTime: string | null;
    createdAt: string;
    updatedAt: string;
    taxAuthorityResponseCode: string | null;
    taxAuthorityResponseMessage: string | null;
    contingencyEvent: null;
  };
};

function makeOrder(overrides: Partial<SaleOrderFixture> = {}): SaleOrderFixture {
  const now = new Date().toISOString();
  return {
    id: 1,
    customerId: 1,
    documentNumber: '001',
    documentType: 'CONSUMIDOR_FINAL',
    documentTypeCode: '01',
    subtotal: '100.00',
    iva: '18.00',
    total: '118.00',
    globalDiscount: '0.00',
    status: 'REJECTED',
    emissionStatus: 'EMITIDA',
    customerName: 'Cliente E2E',
    customerDocumentNumber: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: now,
    customer: { id: 1, name: 'Cliente E2E' },
    details: [
      {
        product: { id: 10, name: 'Llanta E2E' },
        unitPrice: '100.00',
        quantity: 1,
        subtotal: '100.00',
        zone: { id: 20, name: 'Zona E2E' },
      },
    ],
    electronicInvoiceDocument: {
      id: 100,
      generationCode: 'generation-e2e-001',
      controlNumber: 'DTE-0001',
      lifecycleStatus: 'REJECTED',
      selloRecibido: null,
      selloRecibidoAt: null,
      issueDateTime: '2026-01-01T00:00:00.000Z',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: now,
      taxAuthorityResponseCode: 'REJECTED',
      taxAuthorityResponseMessage: 'Documento rechazado por prueba E2E',
      contingencyEvent: null,
    },
    ...overrides,
  };
}

type CustomerFixture = {
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

/** Contribuyente con todos sus datos: nunca lleva warning. */
const completeCustomer: CustomerFixture = {
  id: 77,
  name: 'Cliente E2E',
  isTaxPayer: true,
  email: 'cliente@example.com',
  phone: '7000-0000',
  customerType: 'NATURAL',
  districtId: 5,
  address: 'Dirección E2E',
  createdById: null,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  deletedAt: null,
  district: null,
  taxInfo: {
    nrc: '1234-5678901',
    tradeName: 'Cliente E2E SA de CV',
    taxDocumentTypeId: 1,
    taxDocumentType: { id: 1, code: '36', name: 'NIT' },
    taxDocumentNumber: '0614-1234567',
    economicActivityId: 1,
    economicActivity: { id: 1, code: '6201', name: 'Programación', isLegacy: false },
  },
};

/** Contribuyente migrado incompleto: dispara el warning de datos faltantes. */
const incompleteCustomer: CustomerFixture = {
  ...completeCustomer,
  id: 78,
  name: 'Contribuyente E2E Incompleto',
  districtId: 0,
  address: '',
  taxInfo: {},
};

async function selectCombobox(
  page: Page,
  scope: Locator,
  label: string,
  option: string,
) {
  const control = scope.locator('app-combobox-form-control').filter({
    hasText: `Seleccionar ${label}`,
  });
  await control.locator('button').click();
  const result = page.locator('div.menu:not([hidden])').locator('a').filter({ hasText: option });
  await expect(result).toBeVisible();
  await result.click();
}

async function setupSaleOrderPage(page: Page) {
  await page.addInitScript(() => localStorage.removeItem('workshop.sale-order.draft'));
  await mockAuthenticatedSession(page);
  const order = makeOrder();
  const state: {
    listQueries: URLSearchParams[];
    checkoutPayload?: Record<string, unknown>;
    resendPayload?: Record<string, unknown>;
    createdCustomer?: Record<string, unknown>;
    updatedCustomer?: { id: number; body: Record<string, unknown> };
    deletedCustomerId?: number;
  } = { listQueries: [] };
  let customers: CustomerFixture[] = [completeCustomer, incompleteCustomer];

  await page.route('**/api/electronic-invoices/stream/**', async (route) => {
    await route.abort();
  });
  await page.route('**/api/auth/refresh-session', async (route) => {
    await fulfillJson(route, {
      payload: {
        id: 1,
        name: 'Usuario E2E',
        email: 'e2e@example.com',
        role: 'ADMIN',
      },
    });
  });

  await page.route(/\/api\/sale-orders(?:\?.*)?$/, async (route) => {
    if (route.request().method() !== 'GET') {
      await fulfillJson(route, { message: 'Método no permitido' }, 405);
      return;
    }
    state.listQueries.push(new URL(route.request().url()).searchParams);
    await fulfillJson(route, {
      data: [order],
      meta: listMeta(1),
    });
  });

  await page.route(/\/api\/sale-orders\/\d+\/resend$/, async (route) => {
    state.resendPayload = route.request().postDataJSON() as Record<string, unknown>;
    await fulfillJson(route, { message: 'Re-emisión solicitada' });
  });

  await page.route(/\/api\/sale-orders\/\d+$/, async (route) => {
    await fulfillJson(route, order);
  });

  await page.route('**/api/catalog/category/document-type', async (route) => {
    await fulfillJson(route, [
      { id: 1, code: '01', name: 'Factura Consumidor Final' },
      { id: 2, code: '03', name: 'Crédito Fiscal' },
    ]);
  });
  await page.route('**/api/catalog/category/payment-methode', async (route) => {
    await fulfillJson(route, [
      { id: 10, code: '01', name: 'Efectivo' },
      { id: 11, code: '02', name: 'Tarjeta' },
    ]);
  });
  await page.route('**/api/catalog/category/payment-term', async (route) => {
    await fulfillJson(route, [{ id: 20, code: '01', name: 'Contado' }]);
  });
  await page.route('**/api/catalog/category/contingency-type', async (route) => {
    await fulfillJson(route, [{ id: 30, code: '01', name: 'Falla de servicio' }]);
  });

  await page.route(/\/api\/products\/summary(?:\?.*)?$/, async (route) => {
    await fulfillJson(route, [{ id: 10, name: 'Llanta E2E' }]);
  });
  await page.route(/\/api\/products\/\d+(?:\?.*)?$/, async (route) => {
    await fulfillJson(route, {
      id: 10,
      name: 'Llanta E2E',
      type: 'TIRE',
      salePrice: '100.00',
      stock: 5,
      ProductZoneStock: [
        {
          quantity: 5,
          zone: {
            name: 'Zona E2E',
            warehouse: { name: 'Bodega Central' },
          },
        },
      ],
    });
  });
  await page.route(/\/api\/warehouses\/search-by-name(?:\?.*)?$/, async (route) => {
    await fulfillJson(route, [{ id: 1, name: 'Bodega Central' }]);
  });
  await page.route(/\/api\/zones\/search-by-name(?:\?.*)?$/, async (route) => {
    await fulfillJson(route, [
      { id: 20, name: 'Bodega Central / Zona E2E' },
    ]);
  });
  await page.route(/\/api\/customers(?:\?.*)?$/, async (route) => {
    const request = route.request();
    if (request.method() === 'GET') {
      await fulfillJson(route, {
        data: customers,
        meta: listMeta(customers.length),
      });
      return;
    }
    if (request.method() === 'POST') {
      const body = request.postDataJSON() as Record<string, unknown>;
      state.createdCustomer = body;
      const created: CustomerFixture = {
        ...completeCustomer,
        ...(body as Partial<CustomerFixture>),
        id: 79,
        name: String(body['name'] ?? ''),
        isTaxPayer: Boolean(body['isTaxPayer']),
        address: String(body['address'] ?? ''),
        createdAt: '2026-01-02T00:00:00.000Z',
        updatedAt: '2026-01-02T00:00:00.000Z',
      };
      customers = [...customers, created];
      await fulfillJson(route, created);
      return;
    }
    await fulfillJson(route, { message: 'Método no permitido' }, 405);
  });

  await page.route(/\/api\/customers\/\d+$/, async (route) => {
    const request = route.request();
    const id = Number(new URL(request.url()).pathname.split('/').pop());
    const current = customers.find((customer) => customer.id === id);
    if (request.method() === 'GET') {
      await fulfillJson(route, current ?? null);
      return;
    }
    if (request.method() === 'PATCH') {
      const body = request.postDataJSON() as Record<string, unknown>;
      state.updatedCustomer = { id, body };
      const updated = { ...(current ?? completeCustomer), ...body, id } as CustomerFixture;
      customers = customers.map((customer) => (customer.id === id ? updated : customer));
      await fulfillJson(route, updated);
      return;
    }
    if (request.method() === 'DELETE') {
      state.deletedCustomerId = id;
      customers = customers.filter((customer) => customer.id !== id);
      await fulfillJson(route, current ?? null);
      return;
    }
    await fulfillJson(route, { message: 'Método no permitido' }, 405);
  });

  await page.route('**/api/catalog/category/tax-document-type**', async (route) => {
    await fulfillJson(route, []);
  });

  await page.route('**/api/sale-orders/checkout', async (route) => {
    state.checkoutPayload = route.request().postDataJSON() as Record<string, unknown>;
    await fulfillJson(route, {
      requestId: 'request-e2e-001',
      saleOrderId: 1,
      emissionRequestId: 'emission-e2e-001',
      status: 'COMPLETED',
      finalized: true,
      message: 'Factura creada con éxito',
    });
  });

  return { state };
}

async function confirmSuggestedPrice(page: Page) {
  const confirmation = page.locator('dialog[open]').filter({
    hasText: 'Confirmar precio de venta',
  });
  await expect(confirmation).toContainText(
    'No fue asignado un precio de venta, se empleara el precio de venta sugerido del producto 100.00 esta de acuerdo?',
  );
  await confirmation.getByRole('button', { name: 'OK', exact: true }).click();
}

async function confirmInvoice(page: Page) {
  const confirmation = page.locator('app-confirm-action-modal dialog[open]').filter({
    hasText: 'Facturar venta',
  });
  await expect(confirmation).toContainText(
    '¿Está seguro que la factura cumple con los datos del cliente, monto y producto seleccionado?',
  );
  await confirmation.getByRole('button', { name: 'Facturar', exact: true }).click();
}

async function addSaleItem(page: Page, unitPrice?: string) {
  const checkout = page.locator('app-sale-order-checkout');
  await checkout.getByRole('button', { name: 'Agregar producto' }).click();
  const itemModal = page.locator('app-sale-order-checkout dialog[open]');
  await selectCombobox(page, itemModal, 'producto', 'Llanta E2E');
  await expect(itemModal.getByText('Precio estimado', { exact: true })).toBeVisible();
  await selectCombobox(page, itemModal, 'bodega', 'Bodega Central');
  await selectCombobox(page, itemModal, 'zona', 'Zona E2E');
  await itemModal.locator('input[formcontrolname="quantity"]').fill('2');
  if (unitPrice) {
    await itemModal
      .locator('input[formcontrolname="unitPrice"]')
      .fill(unitPrice);
  }
  await itemModal.getByRole('button', { name: 'Guardar', exact: true }).click();
  await expect(itemModal).not.toBeVisible();
  return checkout;
}

test('filtra órdenes de venta y abre la vista previa', async ({ page }) => {
  const { state } = await setupSaleOrderPage(page);
  await page.goto('/#/sale-orders/list');

  const sales = page.locator('app-sale-orders-page');
  await expect(sales.locator('app-sale-order-table tbody tr')).toHaveCount(1);
  await sales.getByRole('button', { name: 'Filtros' }).click();
  await sales.locator('select[name="status"]').selectOption('REJECTED');
  await sales
    .getByPlaceholder('Buscar por código, documento o cliente')
    .fill('001');
  await sales.getByLabel('Monto desde').fill('50');
  await sales.getByLabel('Monto hasta').fill('500');
  await sales.getByRole('button', { name: 'Buscar' }).click();

  await expect
    .poll(() => {
      const params = state.listQueries.at(-1);
      return {
        status: params?.get('status'),
        search: params?.get('search'),
        minTotal: params?.get('minTotal'),
        maxTotal: params?.get('maxTotal'),
      };
    })
    .toEqual({
      status: 'REJECTED',
      search: '001',
      minTotal: '50',
      maxTotal: '500',
    });
  // El texto viaja unificado: ya no se manda documentNumber suelto.
  expect(state.listQueries.at(-1)?.has('documentNumber')).toBe(false);

  // El select de tipo DTE filtra al instante, sin esperar el debounce.
  await sales.locator('select[name="dteType"]').selectOption('03');
  await expect.poll(() => state.listQueries.at(-1)?.get('dteType')).toBe('03');
  expect(state.listQueries.at(-1)?.get('search')).toBe('001');

  await sales.locator('app-sale-order-table tbody tr').first().click();
  await page.getByRole('button', { name: 'Vista Previa' }).click();
  const preview = page.locator('dialog#sale_order_preview[open]');
  await expect(preview.getByRole('heading', { name: 'Orden 001' })).toBeVisible();
  await expect(preview.locator('h2 + p')).toContainText('Cliente E2E');
  const cliente = preview.locator('section', { hasText: 'Número de documento' });
  await expect(cliente.getByText('Cliente E2E', { exact: true })).toBeVisible();
  await expect(preview.getByText('Llanta E2E', { exact: true })).toBeVisible();
});

test('crea una venta de consumidor final con producto y pago', async ({ page }) => {
  const { state } = await setupSaleOrderPage(page);
  await page.goto('/#/sale-orders/detail/0');

  const checkout = await addSaleItem(page);
  await selectCombobox(page, checkout, 'cliente', 'Cliente E2E');
  await checkout.getByRole('button', { name: 'Agregar pago' }).click();
  await expect(checkout.locator('input[formcontrolname="amount"]')).toHaveValue('200');
  await expect(checkout.getByRole('button', { name: 'Facturar' })).toBeEnabled();
  await checkout.getByRole('button', { name: 'Facturar' }).click();
  await confirmSuggestedPrice(page);
  await confirmInvoice(page);

  await expect.poll(() => state.checkoutPayload).toMatchObject({
    requestId: expect.any(String),
    documentType: 'INVOICE',
    documentTypeId: 1,
    customerId: 77,
    items: [
      {
        productId: 10,
        productName: 'Llanta E2E',
        quantity: 2,
        zoneId: 20,
      },
    ],
    paymentMethod: [
      {
        amount: 200,
        paymentMethodId: 10,
        code: '01',
        name: 'Efectivo',
      },
    ],
  });
  await expect(page).toHaveURL(/#\/sale-orders\/list/);
});

test('envía el precio dinámico cuando el usuario lo asigna', async ({ page }) => {
  const { state } = await setupSaleOrderPage(page);
  await page.goto('/#/sale-orders/detail/0');

  const checkout = await addSaleItem(page, '80');
  await checkout.getByRole('button', { name: 'Agregar pago' }).click();
  await checkout.getByRole('button', { name: 'Facturar' }).click();
  await confirmInvoice(page);

  await expect.poll(() => state.checkoutPayload).toMatchObject({
    items: [{ unitPrice: 80 }],
  });
});

test('cancela la confirmación cuando no se acepta el precio sugerido', async ({ page }) => {
  const { state } = await setupSaleOrderPage(page);
  await page.goto('/#/sale-orders/detail/0');

  const checkout = await addSaleItem(page);
  await checkout.getByRole('button', { name: 'Agregar pago' }).click();
  await checkout.getByRole('button', { name: 'Facturar' }).click();

  const confirmation = page.locator('dialog[open]').filter({
    hasText: 'Confirmar precio de venta',
  });
  await expect(confirmation).toBeVisible();
  await confirmation.getByRole('button', { name: 'Cancelar', exact: true }).click();
  await expect(confirmation).not.toBeVisible();
  expect(state.checkoutPayload).toBeUndefined();
});

test('muestra el resumen fiscal antes de facturar y cancela sin emitir', async ({ page }) => {
  const { state } = await setupSaleOrderPage(page);
  await page.goto('/#/sale-orders/detail/0');

  const checkout = await addSaleItem(page);
  await checkout.getByRole('button', { name: 'Agregar pago' }).click();
  await checkout.getByRole('button', { name: 'Facturar' }).click();
  await confirmSuggestedPrice(page);

  const confirmation = page.locator('app-confirm-action-modal dialog[open]').filter({
    hasText: 'Facturar venta',
  });
  await expect(confirmation).toBeVisible();
  await expect(confirmation).toContainText(
    '¿Está seguro que la factura cumple con los datos del cliente, monto y producto seleccionado?',
  );
  await confirmation.getByRole('button', { name: 'Cancelar', exact: true }).click();
  await expect(confirmation).not.toBeVisible();
  expect(state.checkoutPayload).toBeUndefined();
});

test('no permite facturar cuando el pago no cubre el total', async ({ page }) => {
  const { state } = await setupSaleOrderPage(page);
  await page.goto('/#/sale-orders/detail/0');

  const checkout = await addSaleItem(page);
  await checkout.getByRole('button', { name: 'Agregar pago' }).click();
  await checkout.locator('input[formcontrolname="amount"]').fill('1');
  await checkout.getByRole('button', { name: 'Facturar' }).click();

  await expect(
    checkout.getByRole('alert').filter({ hasText: 'Los pagos no cubren el total estimado' }),
  ).toBeVisible();
  expect(state.checkoutPayload).toBeUndefined();
});

test('muestra la ficha del cliente existente elegido', async ({ page }) => {
  await setupSaleOrderPage(page);
  await page.goto('/#/sale-orders/detail/0');

  const checkout = page.locator('app-sale-order-checkout');
  const card = checkout.locator('[data-testid="existing-customer-table"]');
  await expect(card).toContainText('Sin cliente: elige uno del buscador');

  await selectCombobox(page, checkout, 'cliente', 'Cliente E2E');
  const name = card.locator('[data-testid="customer-name"]');
  await expect(name).toHaveText('Cliente E2E');
  await expect(card).toContainText('0614-1234567');
  await expect(card).toContainText('1234-5678901');
  await expect(card).toContainText('Dirección E2E');
  await expect(card.locator('span.icon-\\[tabler--alert-triangle\\]')).toHaveCount(0);
});

test('abre la ficha del cliente en escritorio y respeta el toggle', async ({
  page,
}) => {
  await setupSaleOrderPage(page);
  await page.goto('/#/sale-orders/detail/0');

  const checkout = page.locator('app-sale-order-checkout');
  const card = checkout.locator('[data-testid="existing-customer-table"]');
  await selectCombobox(page, checkout, 'cliente', 'Cliente E2E');

  // >=768px: el details nace abierto y su contenido se ve.
  await expect(card.locator('summary')).toHaveText('Información del cliente');
  await expect(card).toHaveJSProperty('open', true);
  await expect(card.locator('[data-testid="customer-name"]')).toBeVisible();

  // El toggle manual manda sobre el valor inicial del viewport.
  await card.locator('summary').click();
  await expect(card).toHaveJSProperty('open', false);
  await expect(card.locator('[data-testid="customer-name"]')).toBeHidden();
  await card.locator('summary').click();
  await expect(card).toHaveJSProperty('open', true);
  await expect(card.locator('[data-testid="customer-name"]')).toBeVisible();
});

test('contrae la ficha del cliente en teléfono', async ({ page }) => {
  await setupSaleOrderPage(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/#/sale-orders/detail/0');

  const checkout = page.locator('app-sale-order-checkout');
  const card = checkout.locator('[data-testid="existing-customer-table"]');
  await expect(card.locator('summary')).toBeVisible();
  await expect(card).toHaveJSProperty('open', false);
  await expect(card.locator('.collapse-content')).toBeHidden();

  // El combobox vive fuera del accordion: sigue alcanzable contraído.
  await selectCombobox(page, checkout, 'cliente', 'Cliente E2E');
  await expect(checkout.locator('app-combobox-form-control').first()).toContainText(
    'Cliente E2E',
  );
});

test('edita el cliente existente desde la ficha y refresca la tarjeta', async ({
  page,
}) => {
  const { state } = await setupSaleOrderPage(page);
  await page.goto('/#/sale-orders/detail/0');

  const checkout = page.locator('app-sale-order-checkout');
  const card = checkout.locator('[data-testid="existing-customer-table"]');
  await selectCombobox(page, checkout, 'cliente', 'Cliente E2E');
  await expect(card.locator('[data-testid="customer-name"]')).toHaveText('Cliente E2E');

  await card.getByRole('button', { name: 'Modificar' }).click();
  const modal = page.locator('app-customer-form-modal dialog[open]');
  await expect(modal.getByRole('heading', { name: 'Editar Cliente' })).toBeVisible();
  await modal.locator('input[formcontrolname="name"]').fill('Cliente E2E Editado');
  await modal.getByRole('button', { name: 'Actualizar', exact: true }).click();
  await expect(modal).not.toBeVisible();

  // La ficha se refresca desde ['customer', id] y la selección sobrevive.
  await expect(card.locator('[data-testid="customer-name"]')).toHaveText(
    'Cliente E2E Editado',
  );
  await expect(checkout.locator('app-combobox-form-control').first()).toContainText(
    'Cliente E2E Editado',
  );
  expect(state.updatedCustomer?.id).toBe(77);
  expect(state.updatedCustomer?.body).toMatchObject({
    name: 'Cliente E2E Editado',
  });
});

test('crea un cliente en línea y lo deja seleccionado en la venta', async ({ page }) => {
  const { state } = await setupSaleOrderPage(page);
  await page.goto('/#/sale-orders/detail/0');

  const checkout = page.locator('app-sale-order-checkout');
  await checkout.getByRole('tab', { name: 'Nuevo' }).click();
  await expect(checkout.locator('[data-testid="new-customer-table"]')).toContainText(
    'Sin cliente: crea uno nuevo',
  );

  await checkout.getByRole('button', { name: 'Crear cliente', exact: true }).click();
  const modal = page.locator('app-customer-form-modal dialog[open]');
  await expect(modal.getByRole('heading', { name: 'Nuevo Cliente' })).toBeVisible();
  await modal.locator('input[formcontrolname="name"]').fill('Cliente Facturado E2E');
  await modal.getByRole('button', { name: 'Guardar', exact: true }).click();
  await expect(modal).not.toBeVisible();

  const name = checkout.locator('[data-testid="new-customer-table"] [data-testid="customer-name"]');
  await expect(name).toHaveText('Cliente Facturado E2E');
  await expect(checkout.locator('[data-testid="selected-customer-note"]')).toContainText(
    'Cliente Facturado E2E',
  );
  expect(state.createdCustomer).toMatchObject({ name: 'Cliente Facturado E2E' });
});

test('desvincula el cliente no contribuyente al cambiar a crédito fiscal', async ({
  page,
}) => {
  const { state } = await setupSaleOrderPage(page);
  await page.goto('/#/sale-orders/detail/0');

  const checkout = page.locator('app-sale-order-checkout');
  const newTable = checkout.locator('[data-testid="new-customer-table"]');
  await checkout.getByRole('tab', { name: 'Nuevo' }).click();

  // El modal arranca con isTaxPayer en false: el mock lo devuelve tal cual,
  // así que el cliente creado no puede servir para crédito fiscal.
  await checkout.getByRole('button', { name: 'Crear cliente', exact: true }).click();
  const modal = page.locator('app-customer-form-modal dialog[open]');
  await expect(modal.getByRole('heading', { name: 'Nuevo Cliente' })).toBeVisible();
  await modal.locator('input[formcontrolname="name"]').fill('No Contribuyente E2E');
  await modal.getByRole('button', { name: 'Guardar', exact: true }).click();
  await expect(modal).not.toBeVisible();

  expect(state.createdCustomer).toMatchObject({ isTaxPayer: false });
  const newName = newTable.locator('[data-testid="customer-name"]');
  await expect(newName).toHaveText('No Contribuyente E2E');

  // Crédito fiscal solo admite contribuyentes: la ficha y el aviso de
  // "seleccionado" desaparecen, el cliente queda desligado de la venta.
  await checkout.getByRole('tab', { name: 'Crédito fiscal' }).click();
  await expect(newTable).toContainText('Sin cliente: crea uno nuevo');
  await expect(newName).toHaveCount(0);
  await expect(checkout.locator('[data-testid="selected-customer-note"]')).toHaveCount(0);
});

test('avisa cuando el contribuyente elegido tiene datos faltantes', async ({ page }) => {
  await setupSaleOrderPage(page);
  await page.goto('/#/sale-orders/detail/0');

  const checkout = page.locator('app-sale-order-checkout');
  const card = checkout.locator('[data-testid="existing-customer-table"]');
  await selectCombobox(page, checkout, 'cliente', 'Contribuyente E2E Incompleto');

  await expect(card.locator('[data-testid="customer-name"]')).toHaveText(
    'Contribuyente E2E Incompleto',
  );
  await expect(card.locator('span.icon-\\[tabler--alert-triangle\\]')).toBeVisible();
  await expect(card.locator('[data-tip]')).toHaveAttribute(
    'data-tip',
    'Faltan: NRC, actividad económica, nombre comercial, tipo de documento, dirección, distrito',
  );
});

test('solicita la reemisión de una factura rechazada', async ({ page }) => {
  const { state } = await setupSaleOrderPage(page);
  await page.goto('/#/sale-orders/list');

  const sales = page.locator('app-sale-orders-page');
  await sales.locator('app-sale-order-table tbody tr').first().click();
  await page.getByRole('button', { name: 'Re-emitir' }).click();

  const resend = page.locator('dialog#sale_order_resend[open]');
  await expect(resend).toBeVisible();
  await resend.getByPlaceholder('Corrección de datos del cliente').fill('Corrección E2E');
  await resend.getByRole('button', { name: 'Re-emitir', exact: true }).click();

  await expect.poll(() => state.resendPayload).toEqual({
    resolutionNote: 'Corrección E2E',
  });
  await expect(
    page.getByRole('alert').filter({ hasText: 'Re-emisión solicitada' }).first(),
  ).toBeVisible();
});
