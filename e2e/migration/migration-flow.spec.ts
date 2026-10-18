import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import {
  fulfillJson,
  mockAuthenticatedSession,
} from '../support/session';

type PreviewFile = {
  filename: string;
  hasPdf: boolean;
  version: number;
  tipoDte: string;
  controlNumber: string;
  generationCode: string;
  fecEmi: string;
  sello: boolean;
  customer: {
    mode: 'generic' | 'match' | 'create';
    key: string;
    customerId: number | null;
  };
  items: {
    codigo: string;
    descripcion: string;
    cantidad: number;
    match: 'match' | 'create';
    productId?: number;
  }[];
  duplicate: boolean;
  errors: string[];
};

const validPreviewFile: PreviewFile = {
  filename: 'FAC-E2E-001.json',
  hasPdf: true,
  version: 1,
  tipoDte: '01',
  controlNumber: '001-00000120',
  generationCode: 'generation-e2e-001',
  fecEmi: '2026-01-15',
  sello: true,
  customer: {
    mode: 'match',
    key: 'customer-001',
    customerId: 10,
  },
  items: [
    {
      codigo: 'PROD-001',
      descripcion: 'Llanta E2E',
      cantidad: 2,
      match: 'match',
      productId: 20,
    },
    {
      codigo: 'PROD-NEW',
      descripcion: 'Producto Nuevo',
      cantidad: 1,
      match: 'create',
    },
  ],
  duplicate: false,
  errors: [],
};

const duplicatePreviewFile: PreviewFile = {
  ...validPreviewFile,
  filename: 'FAC-E2E-DUP.json',
  generationCode: 'generation-e2e-dup',
  duplicate: true,
};

const invalidPreviewFile: PreviewFile = {
  ...validPreviewFile,
  filename: 'FAC-E2E-ERROR.json',
  generationCode: 'generation-e2e-error',
  customer: {
    mode: 'create',
    key: 'customer-new',
    customerId: null,
  },
  errors: ['Código de generación inválido'],
};

async function setupMigrationPage(
  page: Page,
  options: {
    previewFiles?: PreviewFile[];
    verifyMissing?: boolean;
    importTotal?: number;
    orphan?: boolean;
  } = {},
) {
  await mockAuthenticatedSession(page);
  const state = {
    sequenceStatusCalls: 0,
    sequenceSyncCalls: 0,
    previewRequests: [] as string[],
    importRequests: [] as string[],
    streamRequests: [] as string[],
    verifyCalls: 0,
  };

  await page.route(/\/api\/migration\/unlock(?:\?.*)?$/, async (route) => {
    if (route.request().method() !== 'POST') {
      await fulfillJson(route, { message: 'Método no permitido' }, 405);
      return;
    }
    const body = route.request().postDataJSON() as { password?: string };
    if (body.password !== 'E2E-MIGRATION') {
      await fulfillJson(route, { message: 'Contraseña incorrecta' }, 401);
      return;
    }
    await fulfillJson(route, { accessToken: 'migration-e2e-token', expiresIn: 900 });
  });

  await page.route(/\/api\/migration\/unlock\/refresh(?:\?.*)?$/, async (route) => {
    await fulfillJson(route, 'migration-e2e-token-refreshed');
  });

  await page.route(/\/api\/migration\/sequence\/status(?:\?.*)?$/, async (route) => {
    state.sequenceStatusCalls += 1;
    await fulfillJson(route, {
      rows: [
        {
          typeCode: '01',
          establishment: '01',
          maxFound: 120,
          currentNumber: 121,
          synced: state.sequenceStatusCalls > 1,
        },
      ],
      synced: state.sequenceStatusCalls > 1,
    });
  });

  await page.route(/\/api\/migration\/sequence\/sync(?:\?.*)?$/, async (route) => {
    state.sequenceSyncCalls += 1;
    await fulfillJson(route, {
      results: [
        {
          typeCode: '01',
          establishment: '01',
          maxFound: 120,
          sequenceSet: 121,
        },
      ],
      unparsed: 1,
      total: 2,
    });
  });

  await page.route(/\/api\/migration\/invoices\/verify(?:\?.*)?$/, async (route) => {
    state.verifyCalls += 1;
    await fulfillJson(
      route,
      options.verifyMissing
        ? {
            total: 2,
            complete: 1,
            missing: [
              {
                generationCode: 'generation-e2e-002',
                controlNumber: '001-00000121',
                customerName: 'Cliente E2E',
                missingPdf: true,
                missingJson: false,
              },
            ],
          }
        : { total: 1, complete: 1, missing: [] },
    );
  });

  await page.route(/\/api\/migration\/invoices\/preview(?:\?.*)?$/, async (route) => {
    const body = route.request().postData() ?? '';
    state.previewRequests.push(body);
    await fulfillJson(route, {
      files: options.previewFiles ?? [validPreviewFile],
    });
  });

  await page.route(/\/api\/migration\/invoices\/import(?:\?.*)?$/, async (route) => {
    state.importRequests.push(route.request().postData() ?? '');
    if (options.orphan) {
      await fulfillJson(route, {
        jobId: 'unused',
        total: 0,
        orphans: ['ORPHAN-E2E'],
        attached: [],
      });
      return;
    }
    await fulfillJson(route, {
      jobId: 'job-e2e-001',
      total: options.importTotal ?? 1,
      orphans: [],
      attached: [],
    });
  });

  await page.route(
    /\/api\/migration\/invoices\/import\/stream(?:\?.*)?$/,
    async (route) => {
      const request = route.request();
      const url = new URL(request.url());
      state.streamRequests.push(url.searchParams.get('jobId') ?? '');
      const events = [
        {
          jobId: 'job-e2e-001',
          total: options.importTotal ?? 1,
          percent: 100,
          state: 'completed',
          summary: {
            migrated: options.importTotal ?? 1,
            skipped: 0,
            failed: 0,
          },
        },
      ];
      await route.fulfill({
        status: 200,
        headers: {
          'content-type': 'text/event-stream; charset=utf-8',
          'cache-control': 'no-cache',
          'access-control-allow-origin': request.headers()['origin'] ?? '*',
          'access-control-allow-credentials': 'true',
        },
        body: events.map((event) => `data: ${JSON.stringify(event)}\n\n`).join(''),
      });
    },
  );

  return { state };
}

function setInvoiceFiles(
  page: Page,
  files: { name: string; mimeType: string; content: string }[],
) {
  return page.locator('app-migration-page input[type="file"]').setInputFiles(
    files.map((file) => ({
      name: file.name,
      mimeType: file.mimeType,
      buffer: Buffer.from(file.content),
    })),
  );
}

async function unlockMigration(page: Page) {
  const migration = page.locator('app-migration-page');
  await migration.locator('input[type="password"]').fill('E2E-MIGRATION');
  await migration.getByRole('button', { name: 'Desbloquear', exact: true }).click();
  await expect(
    migration.getByRole('heading', { name: 'Verificar facturas importadas' }),
  ).toBeVisible();
}

test('mantiene Migración bloqueada hasta ingresar la contraseña', async ({ page }) => {
  const { state } = await setupMigrationPage(page);
  await page.goto('/#/migration');

  const migration = page.locator('app-migration-page');
  await expect(migration.getByRole('heading', { name: 'Zona protegida' })).toBeVisible();
  await expect(
    migration.getByRole('heading', { name: 'Verificar facturas importadas' }),
  ).toHaveCount(0);
  await expect(
    migration.getByRole('heading', { name: 'Listado de importación de facturas' }),
  ).toHaveCount(0);
  await expect(migration.getByText('Total de importación de facturas')).toHaveCount(0);
  expect(state.sequenceStatusCalls).toBe(0);
});

test('sincroniza el secuenciador una vez finalizada la importación', async ({ page }) => {
  const { state } = await setupMigrationPage(page);
  await page.goto('/#/migration');
  await unlockMigration(page);

  const migration = page.locator('app-migration-page');
  await expect(migration.getByText('pendiente', { exact: true })).toBeVisible();
  await migration
    .getByRole('button', { name: 'Sincronizar secuenciador', exact: true })
    .click();

  await expect(migration.getByText('sincronizado', { exact: true })).toBeVisible();
  await expect(migration.getByText('01', { exact: true }).first()).toBeVisible();
  await expect(
    migration.getByText('2 documentos revisados · 1 sin número de control válido', {
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    migration.getByRole('alert').filter({ hasText: 'Secuenciador sincronizado' }),
  ).toBeVisible();
  expect(state.sequenceSyncCalls).toBe(1);
  expect(state.sequenceStatusCalls).toBe(2);
});

test('revisar archivos y muestra los PDF o JSON faltantes', async ({ page }) => {
  const { state } = await setupMigrationPage(page, { verifyMissing: true });
  await page.goto('/#/migration');
  await unlockMigration(page);

  const migration = page.locator('app-migration-page');
  await migration.getByRole('button', { name: 'Verificar', exact: true }).click();

  await expect(
    migration.locator('p').filter({ hasText: 'facturas completas' }),
  ).toBeVisible();
  await expect(migration.getByText('1/2', { exact: true })).toBeVisible();
  await expect(migration.getByText('Cliente E2E', { exact: true })).toBeVisible();
  await expect(migration.getByText('001-00000121', { exact: true })).toBeVisible();
  await expect(migration.getByText('PDF', { exact: true })).toBeVisible();
  await expect(
    migration.getByRole('alert').filter({ hasText: '1 facturas con archivos faltantes.' }),
  ).toBeVisible();
  expect(state.verifyCalls).toBe(1);
});

test('prepara la importación y filtra extensiones no compatibles', async ({ page }) => {
  const { state } = await setupMigrationPage(page, {
    previewFiles: [validPreviewFile, duplicatePreviewFile, invalidPreviewFile],
  });
  await page.goto('/#/migration');
  await unlockMigration(page);

  const migration = page.locator('app-migration-page');
  await setInvoiceFiles(page, [
    { name: 'FAC-E2E-001.json', mimeType: 'application/json', content: '{}' },
    { name: 'FAC-E2E-001.pdf', mimeType: 'application/pdf', content: '%PDF-1.4' },
    { name: 'IGNORADO.txt', mimeType: 'text/plain', content: 'no importar' },
  ]);

  await expect(migration.getByText('FAC-E2E-001.json', { exact: true })).toBeVisible();
  await expect(migration.getByText('FAC-E2E-DUP.json', { exact: true })).toBeVisible();
  await expect(migration.getByText('FAC-E2E-ERROR.json', { exact: true })).toBeVisible();
  await expect(migration.getByText('disponible', { exact: true }).first()).toBeVisible();
  await expect(migration.getByText('existe', { exact: true }).first()).toBeVisible();
  await expect(migration.getByText('se crea', { exact: true })).toBeVisible();
  await expect(migration.getByText('duplicado', { exact: true })).toBeVisible();
  await expect(migration.getByText('error', { exact: true })).toBeVisible();
  await expect(
    migration.getByRole('button', { name: 'Importar 1 archivos' }),
  ).toBeVisible();
  expect(state.previewRequests[0]).toContain('filename="FAC-E2E-001.json"');
  expect(state.previewRequests[0]).toContain('filename="FAC-E2E-001.pdf"');
  expect(state.previewRequests[0]).not.toContain('filename="IGNORADO.txt"');
});

test('importa facturas y sincroniza el resultado mediante el progreso', async ({ page }) => {
  const { state } = await setupMigrationPage(page, { importTotal: 1 });
  await page.goto('/#/migration');
  await unlockMigration(page);

  const migration = page.locator('app-migration-page');
  await setInvoiceFiles(page, [
    { name: 'FAC-E2E-001.json', mimeType: 'application/json', content: '{}' },
  ]);
  await migration.getByRole('button', { name: 'Importar 1 archivos' }).click();

  await expect
    .poll(() => state.streamRequests)
    .toEqual(['job-e2e-001']);
  expect(state.importRequests[0]).toContain('filename="FAC-E2E-001.json"');
  await expect(
    migration.getByRole('alert').filter({
      hasText: 'Importación finalizada: 1 importadas, 0 omitidas, 0 fallidas',
    }),
  ).toBeVisible();
  await expect(migration.locator('tbody tr').filter({ hasText: 'FAC-E2E-001.json' })).toHaveCount(0);
});

test('informa cuando un PDF no tiene una factura importada', async ({ page }) => {
  const { state } = await setupMigrationPage(page, {
    previewFiles: [],
    orphan: true,
  });
  await page.goto('/#/migration');
  await unlockMigration(page);

  const migration = page.locator('app-migration-page');
  await setInvoiceFiles(page, [
    { name: 'ORPHAN-E2E.pdf', mimeType: 'application/pdf', content: '%PDF-1.4' },
  ]);
  await migration.getByRole('button', { name: 'Adjuntar 1 PDFs' }).click();

  await expect(
    migration.locator('div.alert.alert-error').filter({
      hasText: 'No se importaron 1 archivos; los demás sí se importaron:',
    }),
  ).toBeVisible();
  await expect(migration.getByText('ORPHAN-E2E', { exact: true })).toBeVisible();
  await expect(
    migration.locator('li').filter({
      hasText: 'PDF sin factura importada: sube su JSON.',
    }),
  ).toBeVisible();
  expect(state.streamRequests).toHaveLength(0);
});
