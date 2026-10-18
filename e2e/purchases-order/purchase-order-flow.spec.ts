import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';
import {
  fulfillJson,
  listMeta,
  mockAuthenticatedSession,
} from '../support/session';

type Order = {
  id: number;
  documentNumber: number;
  documentType: string;
  providerId: number;
  total: string;
  status: string;
  createdById: number | null;
  updatedById: number | null;
  canceledById: null;
  createdAt: string;
  updatedAt: string;
  canceledAt: null;
  provider: { id: number; name: string };
  createdBy: null;
  details: {
    id: number;
    product: { id: number; name: string };
    unitPrice: string;
    quantity: number;
    subtotal: string;
    suggestedZoneId: number | null;
    suggestedZone: {
      id: number;
      name: string;
      warehouseId: number;
      warehouse: { id: number; name: string };
    } | null;
  }[];
};

/**
 * Líneas base del fixture. La segunda existe para que la vista unificada
 * tenga que pintar un grupo "Sin asignar" aparte del grupo con zona real.
 */
const DETAIL_LINES = [
  { productId: 10, productName: 'Llanta E2E', unitPrice: 20, quantity: 2 },
  { productId: 11, productName: 'Foco E2E', unitPrice: 15, quantity: 1 },
] as const;

function makeOrder(
  id = 1,
  status = 'PENDING',
  withSuggestedZone = false,
  detailCount = 1,
): Order {
  // `id * 10 + index` mantiene el id 10/11 que casa con `makeZonePreview()`.
  const details = DETAIL_LINES.slice(0, detailCount).map((line, index) => {
    const hasZone = withSuggestedZone && index === 0;
    return {
      id: id * 10 + index,
      product: { id: line.productId, name: line.productName },
      unitPrice: String(line.unitPrice),
      quantity: line.quantity,
      subtotal: String(line.unitPrice * line.quantity),
      suggestedZoneId: hasZone ? 3 : null,
      suggestedZone: hasZone
        ? {
            id: 3,
            name: 'Zona Principal',
            warehouseId: 1,
            warehouse: { id: 1, name: 'Bodega Central' },
          }
        : null,
    };
  });

  return {
    id,
    documentNumber: 100 + id,
    documentType: 'Orden de compra',
    providerId: 1,
    total: String(
      details.reduce((sum, detail) => sum + Number(detail.subtotal), 0),
    ),
    status,
    createdById: 1,
    updatedById: null,
    canceledById: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    canceledAt: null,
    provider: { id: 1, name: 'Proveedor E2E' },
    createdBy: null,
    details,
  };
}

/**
 * `withZone = false` devuelve el mismo preview pero sin ninguna zona designada:
 * sirve para el caso en que la vista unificada debe caer a la tabla plana.
 */
function makeZonePreview(withZone = true) {
  return [
    {
      purchaseOrderDetailId: 10,
      productId: 10,
      productName: 'Llanta E2E',
      quantity: 2,
      zoneId: withZone ? 3 : null,
      zoneName: withZone ? 'Zona Principal' : null,
      warehouseId: withZone ? 1 : null,
      warehouseName: withZone ? 'Bodega Central' : null,
    },
    {
      purchaseOrderDetailId: 11,
      productId: 11,
      productName: 'Foco E2E',
      quantity: 1,
      zoneId: null,
      zoneName: null,
      warehouseId: null,
      warehouseName: null,
    },
  ];
}

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

async function setupPurchaseOrderPage(
  page: Page,
  withSuggestedZone = false,
  detailCount = 1,
  previewWithZone = true,
  previewAssignsOnApprove = false,
) {
  await mockAuthenticatedSession(page);
  let records = [
    makeOrder(1, 'PENDING', withSuggestedZone, detailCount),
    makeOrder(2, 'PENDING', false, detailCount),
  ];
  const state: {
    listQueries: URLSearchParams[];
    created?: Record<string, unknown>;
    updated?: { id: number; body: Record<string, unknown> };
    approved?: Record<string, unknown>;
    rejectedId?: number;
    zonePreviewIds: number[];
  } = { listQueries: [], zonePreviewIds: [] };

  await page.route(/\/api\/purchase-orders(?:\?.*)?$/, async (route) => {
    if (route.request().method() !== 'GET') {
      await fulfillJson(route, { message: 'Método no permitido' }, 405);
      return;
    }
    const url = new URL(route.request().url());
    state.listQueries.push(url.searchParams);
    await fulfillJson(route, {
      data: records,
      meta: listMeta(records.length),
    });
  });

  await page.route(
    /\/api\/purchase-orders\/reject-order\/\d+$/,
    async (route) => {
      const id = Number(new URL(route.request().url()).pathname.split('/').pop());
      state.rejectedId = id;
      records = records.map((record) =>
        record.id === id ? { ...record, status: 'REJECTED' } : record,
      );
      await fulfillJson(route, records.find((record) => record.id === id));
    },
  );

  await page.route(
    /\/api\/purchase-orders\/approve-order\/\d+$/,
    async (route) => {
      const id = Number(new URL(route.request().url()).pathname.split('/').pop());
      state.approved = route.request().postDataJSON() as Record<string, unknown>;
      records = records.map((record) =>
        record.id === id ? { ...record, status: 'COMPLETED' } : record,
      );
      await fulfillJson(route, records.find((record) => record.id === id));
    },
  );

  await page.route(/\/api\/purchase-orders$/, async (route) => {
    if (route.request().method() !== 'POST') {
      await fulfillJson(route, { message: 'Método no permitido' }, 405);
      return;
    }
    const body = route.request().postDataJSON() as Record<string, unknown>;
    state.created = body;
    const created = makeOrder(2);
    created.details = body.details as Order['details'];
    records = [...records, created];
    await fulfillJson(route, created);
  });

  await page.route(/\/api\/purchase-orders\/\d+$/, async (route) => {
    const id = Number(new URL(route.request().url()).pathname.split('/').pop());
    if (route.request().method() === 'GET') {
      await fulfillJson(route, records.find((record) => record.id === id));
      return;
    }
    if (route.request().method() === 'PATCH') {
      const body = route.request().postDataJSON() as Record<string, unknown>;
      state.updated = { id, body };
      await fulfillJson(route, records.find((record) => record.id === id));
      return;
    }
    await fulfillJson(route, { message: 'Método no permitido' }, 405);
  });

  /**
   * Va DESPUÉS de `/\/api\/purchase-orders\/\d+$/`: Playwright evalúa las
   * rutas en orden inverso al registro, así que esta gana y el preview no
   * termina servido como si fuera la orden completa.
   *
   * Con `previewAssignsOnApprove` el preview es stateful: antes de aprobar
   * devuelve el mismo preview sin zonas designadas y recién después de la
   * aprobación devuelve la zona asignada. Así se distingue "refetch porque
   * se invalidó la cache" de "la app nunca volvió a pedirlo".
   */
  await page.route(/\/api\/purchase-orders\/\d+\/zone-preview$/, async (route) => {
    const id = Number(
      new URL(route.request().url()).pathname.split('/').at(-2),
    );
    state.zonePreviewIds.push(id);
    const assigned = previewAssignsOnApprove
      ? state.approved !== undefined
      : previewWithZone;
    await fulfillJson(route, makeZonePreview(assigned));
  });

  await page.route(/\/api\/providers\/search-by-name\/?(?:\?.*)?$/, async (route) => {
    await fulfillJson(route, [{ id: 1, name: 'Proveedor E2E' }]);
  });

  await page.route(/\/api\/products\/summary(?:\?.*)?$/, async (route) => {
    await fulfillJson(route, [
      { id: 10, name: 'Llanta E2E', stock: 8, type: 'TIRE' },
    ]);
  });

  await page.route(/\/api\/warehouses\/search-by-name(?:\?.*)?$/, async (route) => {
    await fulfillJson(route, [{ id: 1, name: 'Bodega Central' }]);
  });

  await page.route(/\/api\/zones\/search-by-name(?:\?.*)?$/, async (route) => {
    const url = new URL(route.request().url());
    // Zonas ya filtradas por bodega: solo nombre, sin prefijo "Bodega / ...".
    if (url.searchParams.get('warehouseId')) {
      await fulfillJson(route, [{ id: 3, name: 'Zona Principal' }]);
      return;
    }
    await fulfillJson(route, [{ id: 3, name: 'Bodega Central / Zona Principal' }]);
  });

  return { state };
}

test('filtra órdenes de compra y abre la vista previa', async ({ page }) => {
  // 2 detalles: el preview asigna zona al 10 y deja el 11 sin asignar.
  const { state } = await setupPurchaseOrderPage(page, false, 2);
  await page.goto('/#/purchase-orders/list');

  const section = page.locator('app-purchase-orders-page');
  await expect(section.locator('app-purchase-order-table tbody tr')).toHaveCount(2);
  await page.getByRole('button', { name: 'Filtros' }).click();
  await page.locator('select[name="status"]').selectOption('PENDING');
  await page.getByPlaceholder('Buscar por número de orden').fill('101');
  await page.getByRole('button', { name: 'Buscar' }).click();

  await expect.poll(() => state.listQueries.at(-1)?.get('status')).toBe('PENDING');
  expect(state.listQueries.at(-1)?.get('documentNumber')).toBe('101');

  await section.locator('app-purchase-order-table tbody tr').first().click();
  await page.getByRole('button', { name: 'Vista Previa' }).click();

  const preview = page.locator('dialog#my_modal_3[open]');
  await expect(preview.getByRole('heading', { name: 'Orden #101' })).toBeVisible();
  await expect(preview.getByText('Proveedor E2E', { exact: true })).toBeVisible();

  // Vista unificada: una sola sección de productos, sin tabla de zonas aparte.
  await expect(preview.getByRole('heading', { name: 'Productos' })).toBeVisible();
  await expect(preview.getByText('Zonas sugeridas')).toHaveCount(0);

  const products = preview.locator('[data-testid="products-table"]');
  const groups = products.locator('[data-testid="product-zone-group"]');

  const assignedGroup = groups.filter({
    hasText: 'Bodega Central / Zona Principal',
  });
  await expect(assignedGroup).toHaveCount(1);

  // La fila del producto con zona cuelga de su encabezado de grupo.
  const assignedRow = products.locator(
    'xpath=//tr[td[@data-testid="product-zone-group"]'
      + " and contains(., 'Bodega Central / Zona Principal')]"
      + '/following-sibling::tr[1]',
  );
  await expect(assignedRow).toContainText('Llanta E2E');
  await expect(assignedRow.locator('[data-testid="product-zone-unassigned"]')).toHaveCount(0);

  // El segundo detalle no tiene zona: cae en el grupo "Sin asignar".
  await expect(groups.filter({ hasText: 'Sin asignar' })).toHaveCount(1);
  const unassignedRow = products.locator('tbody tr').filter({ hasText: 'Foco E2E' });
  await expect(unassignedRow).toHaveCount(1);
  await expect(
    unassignedRow.locator('[data-testid="product-zone-unassigned"]'),
  ).toHaveText('Sin asignar');

  // Orden de los encabezados: el grupo con zona designada va antes que
  // "Sin asignar", que siempre cierra la tabla.
  await expect(groups).toHaveCount(2);
  await expect(groups.nth(0)).toContainText('Bodega Central / Zona Principal');
  await expect(groups.nth(1)).toContainText('Sin asignar');
});

test('muestra la tabla plana cuando ninguna línea tiene zona sugerida', async ({ page }) => {
  // 2 detalles, pero el preview no designa ninguna zona.
  await setupPurchaseOrderPage(page, false, 2, false);
  await page.goto('/#/purchase-orders/list');

  const section = page.locator('app-purchase-orders-page');
  await section.locator('app-purchase-order-table tbody tr').first().click();
  await page.getByRole('button', { name: 'Vista Previa' }).click();

  const preview = page.locator('dialog#my_modal_3[open]');
  const products = preview.locator('[data-testid="products-table"]');
  await expect(preview.getByRole('heading', { name: 'Orden #101' })).toBeVisible();

  // Sin ninguna zona asignada no hay agrupadores: tabla plana.
  await expect(products.locator('[data-testid="product-zone-group"]')).toHaveCount(0);
  await expect(products.locator('tbody tr')).toHaveCount(2);
  await expect(products.getByTestId('product-zone-unassigned')).toHaveText([
    'Sin asignar',
    'Sin asignar',
  ]);
});

test('crea una orden pendiente con producto y zona sugerida', async ({ page }) => {
  const { state } = await setupPurchaseOrderPage(page);
  await page.goto('/#/purchase-orders/detail/0');

  const detail = page.locator('app-purchase-order-detail');
  await selectCombobox(page, detail, 'Proveedor', 'Proveedor E2E');
  await detail.getByRole('button', { name: 'Agregar producto' }).click();

  const productModal = page.locator('app-purchase-order-detail dialog[open]');
  await selectCombobox(page, productModal, 'producto', 'Llanta E2E');
  await productModal.locator('input[formcontrolname="quantity"]').fill('2');
  await productModal.locator('input[formcontrolname="unitPrice"]').fill('20');
  await selectCombobox(page, productModal, 'bodega', 'Bodega Central');
  await selectCombobox(page, productModal, 'zona (opcional)', 'Zona Principal');
  await productModal.getByRole('button', { name: 'Guardar', exact: true }).click();
  await productModal.getByRole('button', { name: 'Cerrar', exact: true }).click();

  await expect(detail.locator('tbody tr').filter({ hasText: 'Llanta E2E' })).toBeVisible();
  await detail.locator('form').first().getByRole('button', { name: 'Guardar', exact: true }).click();

  await expect.poll(() => state.created).toEqual({
    providerId: 1,
    details: [
      {
        productId: 10,
        productName: 'Llanta E2E',
        quantity: 2,
        unitPrice: 20,
        suggestedZoneId: 3,
      },
    ],
  });
  await expect(page.getByText('¿Desea aprobar la orden ahora o más tarde?', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Luego' }).click();
});

test('edita una orden pendiente', async ({ page }) => {
  const { state } = await setupPurchaseOrderPage(page);
  await page.goto('/#/purchase-orders/list');

  const section = page.locator('app-purchase-orders-page');
  await section.locator('app-purchase-order-table tbody tr').first().click();
  await page.getByRole('link', { name: 'Modificar' }).click();

  const detail = page.locator('app-purchase-order-detail');
  await expect(detail.locator('tbody tr').filter({ hasText: 'Llanta E2E' })).toBeVisible();
  await detail.locator('tbody tr').first().click();
  await detail.getByRole('button', { name: 'Modificar', exact: true }).click();

  const productModal = page.locator('app-purchase-order-detail dialog[open]');
  await productModal.locator('input[formcontrolname="quantity"]').fill('3');
  await productModal.getByRole('button', { name: 'Guardar', exact: true }).click();
  await productModal.getByRole('button', { name: 'Cerrar', exact: true }).click();
  await detail.locator('form').first().getByRole('button', { name: 'Guardar', exact: true }).click();

  await expect.poll(() => state.updated).toEqual({
    id: 1,
    body: {
      details: [
        {
          productId: 10,
          productName: 'Llanta E2E',
          quantity: 3,
          unitPrice: '20',
        },
      ],
    },
  });
  await expect(page.getByText('¿Desea aprobar la orden ahora o más tarde?', { exact: true })).toBeVisible();
});

test('aprueba una orden asignando sus cantidades a zonas', async ({ page }) => {
  const { state } = await setupPurchaseOrderPage(page, true);
  await page.goto('/#/purchase-orders/list');

  const section = page.locator('app-purchase-orders-page');
  await section.locator('app-purchase-order-table tbody tr').first().click();
  await page.getByRole('button', { name: 'Aprobar' }).click();

  const approveModal = page.locator('app-approve-modal dialog[open]');
  await expect(approveModal.getByText('Aprobar orden #101', { exact: true })).toBeVisible();
  const approveButton = approveModal.getByRole('button', { name: 'Confirmar aprobación' });
  await expect(approveButton).toBeEnabled();
  await approveButton.click();

  const confirmation = page.locator('app-approve-modal app-confirm-action-modal dialog[open]');
  await expect(confirmation).toContainText('¿Confirmar aprobación?');
  await confirmation.getByRole('button', { name: 'Aprobar', exact: true }).click();

  await expect.poll(() => state.approved).toEqual({
    details: [
      {
        purchaseOrderDetailId: 10,
        allocations: [{ zoneId: 3, quantity: 2 }],
      },
    ],
  });
  await expect(section.getByText('Orden aprobada con éxito', { exact: true })).toBeVisible();
});

test('aprueba una orden sin zona sugerida eligiendo bodega y zona en cascada', async ({
  page,
}) => {
  const { state } = await setupPurchaseOrderPage(page, false);
  await page.goto('/#/purchase-orders/list');

  const section = page.locator('app-purchase-orders-page');
  await section.locator('app-purchase-order-table tbody tr').first().click();
  await page.getByRole('button', { name: 'Aprobar' }).click();

  const approveModal = page.locator('app-approve-modal dialog[open]');
  await expect(approveModal.getByText('Aprobar orden #101', { exact: true })).toBeVisible();
  const approveButton = approveModal.getByRole('button', { name: 'Confirmar aprobación' });
  await expect(approveButton).toBeDisabled();

  await selectCombobox(page, approveModal, 'bodega', 'Bodega Central');
  await selectCombobox(page, approveModal, 'zona', 'Zona Principal');

  await expect(approveButton).toBeEnabled();
  await approveButton.click();

  const confirmationCascade = page.locator('app-approve-modal app-confirm-action-modal dialog[open]');
  await expect(confirmationCascade).toContainText('¿Confirmar aprobación?');
  await confirmationCascade.getByRole('button', { name: 'Aprobar', exact: true }).click();

  await expect.poll(() => state.approved).toEqual({
    details: [
      {
        purchaseOrderDetailId: 10,
        allocations: [{ zoneId: 3, quantity: 2 }],
      },
    ],
  });
  await expect(section.getByText('Orden aprobada con éxito', { exact: true })).toBeVisible();
});

test('refresca el preview de zonas después de aprobar', async ({ page }) => {
  // `withSuggestedZone = true`: la orden llega con zona 3 sugerida.
  // El preview arranca SIN zonas designadas y solo las devuelve ya aprobada.
  const { state } = await setupPurchaseOrderPage(page, true, 1, false, true);
  await page.goto('/#/purchase-orders/list');

  const section = page.locator('app-purchase-orders-page');
  await section.locator('app-purchase-order-table tbody tr').first().click();

  // 1) Vista previa antes de aprobar: la línea cae en la tabla plana,
  //    sin zona. Esto deja la query del preview caliente en la cache.
  await page.getByRole('button', { name: 'Vista Previa' }).click();
  const preview = page.locator('dialog#my_modal_3[open]');
  await expect(preview.getByRole('heading', { name: 'Orden #101' })).toBeVisible();
  await expect(preview.getByTestId('product-zone-unassigned')).toHaveText([
    'Sin asignar',
  ]);
  await preview.getByRole('button', { name: 'Cerrar', exact: true }).click();
  await expect.poll(() => state.zonePreviewIds.length).toBe(1);

  // 2) Aprobar con la asignación de zonas de siempre.
  await page.getByRole('button', { name: 'Aprobar' }).click();
  const approveModal = page.locator('app-approve-modal dialog[open]');
  await expect(approveModal.getByText('Aprobar orden #101', { exact: true })).toBeVisible();
  const approveButton = approveModal.getByRole('button', { name: 'Confirmar aprobación' });
  await expect(approveButton).toBeEnabled();
  await approveButton.click();

  const confirmationRefresh = page.locator('app-approve-modal app-confirm-action-modal dialog[open]');
  await expect(confirmationRefresh).toContainText('¿Confirmar aprobación?');
  await confirmationRefresh.getByRole('button', { name: 'Aprobar', exact: true }).click();

  await expect.poll(() => state.approved).toEqual({
    details: [
      {
        purchaseOrderDetailId: 10,
        allocations: [{ zoneId: 3, quantity: 2 }],
      },
    ],
  });

  // 3) La vista previa tiene que reflejar las zonas recién asignadas: el
  //    approve invalida `['purchase-order-zone-preview']`, así que vuelve
  //    a pedir el preview en vez de servir el cacheado sin zonas.
  await section.locator('app-purchase-order-table tbody tr').first().click();
  await page.getByRole('button', { name: 'Vista Previa' }).click();

  await expect(preview.getByRole('heading', { name: 'Orden #101' })).toBeVisible();

  const products = preview.locator('[data-testid="products-table"]');
  const groups = products.locator('[data-testid="product-zone-group"]');
  await expect(groups).toHaveCount(1);
  await expect(groups.nth(0)).toContainText('Bodega Central / Zona Principal');
  await expect(products).toContainText('Llanta E2E');
  await expect(products.getByTestId('product-zone-unassigned')).toHaveCount(0);

  // Y no solo que se vea bien: el preview se volvió a pedir (invalidado),
  // no servido desde el cache de 5 minutos.
  await expect.poll(() => state.zonePreviewIds.length).toBe(2);
});

test('cancela la aprobación en la confirmación sin ingresar stock', async ({ page }) => {
  const { state } = await setupPurchaseOrderPage(page, true);
  await page.goto('/#/purchase-orders/list');

  const section = page.locator('app-purchase-orders-page');
  await section.locator('app-purchase-order-table tbody tr').first().click();
  await page.getByRole('button', { name: 'Aprobar' }).click();

  const approveModal = page.locator('app-approve-modal dialog[open]');
  await expect(approveModal.getByText('Aprobar orden #101', { exact: true })).toBeVisible();
  await approveModal.getByRole('button', { name: 'Confirmar aprobación' }).click();

  const confirmation = page.locator('app-approve-modal app-confirm-action-modal dialog[open]');
  await expect(confirmation).toBeVisible();
  await confirmation.getByRole('button', { name: 'Cancelar', exact: true }).click();
  await expect(confirmation).not.toBeVisible();
  expect(state.approved).toBeUndefined();
});

test('rechaza una orden pendiente', async ({ page }) => {
  const { state } = await setupPurchaseOrderPage(page);
  await page.goto('/#/purchase-orders/list');

  const section = page.locator('app-purchase-orders-page');
  await section.locator('app-purchase-order-table tbody tr').first().click();
  await page.getByRole('button', { name: 'Rechazar' }).click();

  const confirm = page.locator('app-action-modal dialog[open]');
  await expect(confirm.getByText('Advertencia!', { exact: true })).toBeVisible();
  await confirm.getByRole('button', { name: 'Confirmar', exact: true }).click();

  await expect.poll(() => state.rejectedId).toBe(1);
  await expect(section.getByText('Orden rechazada con éxito', { exact: true })).toBeVisible();
});
