import { ConfirmActionModalComponent } from '../../../shared/components/confirm-action-modal/confirm-action-modal.component';
import { CONSTRUCTION } from '../../../products/interfaces/product.interface';
import { PdfPreviewComponent } from '../../../shared/components/pdf-preview/pdf-preview.component';
import { By } from '@angular/platform-browser';
import { PurchaseOrderService } from '../../services/purchase-order.service';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { QueryClient } from '@tanstack/angular-query-experimental';
import { of } from 'rxjs';
import { AssistedPurchaseComponent } from './assisted-purchase.component';
import { emptyPurchaseOrder } from '../../services/purchase-order.service';
import { PURCHASE_ORDER_STATUS } from '../../enums/purchase-order-status.enum';
import { AssistedPurchaseService } from '../../services/assisted-purchase.service';
import { PurchaseRowDraft } from '../../interfaces/assisted-purchase.interface';
import { AlertService } from '../../../shared/components/alert/alert.service';
import { BrandService } from '../../../brands/services/brand.service';
import { ProviderService } from '../../../providers/services/provider.service';
import { emptyProduct, ProductService } from '../../../products/services/product.service';
import { WarehouseService } from '../../../warehouses/services/warehouse.service';
import { ZoneService } from '../../../zones/services/zone.service';

describe('Assisted purchase brand and optional destination', () => {
  let component: AssistedPurchaseComponent;
  let service: jasmine.SpyObj<AssistedPurchaseService>;
  let router: jasmine.SpyObj<Router>;
  const newRow = (): PurchaseRowDraft => ({
    key: crypto.randomUUID(),
    description: 'Insumo',
    quantity: 1,
    unitPrice: '10',
    choice: 'new',
    type: 'SUPPLY',
    brandName: 'DUNLOP',
    brandMode: 'existing',
    brandSelected: null,
    selected: null,
    zone: null,
    ready: true,
    product: { type: 'SUPPLY', brandId: 5, supply: { salePrice: '15' } },
  });
  it('collapses products independently without changing their draft data', () => {
    const first = newRow(); const second = newRow(); second.key = 'another-product';
    component.rows.set([first, second]);
    component.toggleProduct(first.key);
    expect(component.collapsedProducts().has(first.key)).toBeTrue();
    expect(component.collapsedProducts().has(second.key)).toBeFalse();
    expect(component.rows()[0]).toBe(first);
    component.toggleProduct(first.key);
    expect(component.collapsedProducts().has(first.key)).toBeFalse();
    expect(component.rows()[0]).toBe(first);
  });
  it('allows a new provider without NRC or NIT and validates supplied values', () => {
    component.providerForm.reset({ name: 'Proveedor' });
    expect(component.providerForm.valid).toBeTrue();
    component.providerForm.patchValue({ nrc: 'abc', nit: '---' });
    expect(component.providerForm.invalid).toBeTrue();
  });
  it('does not select a zone before selecting its warehouse', () => {
    const row = newRow();
    component.rows.set([row]);
    component.chooseRowZone(row, { id: 1, name: 'Zona' });
    expect(row.zone).toBeNull();
    component.chooseRowWarehouse(row, { id: 1, name: 'Bodega' });
    row.zoneOptions = [{ id: 1, name: 'Zona' }];
    component.chooseRowZone(row, { id: 1, name: 'Zona' });
    expect(row.zone?.id).toBe(1);
    component.chooseRowWarehouse(row, { id: 2, name: 'Otra' });
    expect(row.zone).toBeNull();
    expect(row.zoneOptions).toEqual([]);
  });
  it('loads the saved order only when approval is requested', async () => {
    const purchases = TestBed.inject(PurchaseOrderService);
    const load = spyOn(purchases, 'getPurchaseOrder').and.returnValue(of({ ...emptyPurchaseOrder, id: 1 }));
    component.savedOrderId.set(1);
    expect(load).not.toHaveBeenCalled();
    await component.approveNow();
    expect(load).toHaveBeenCalledOnceWith(1);
    expect(component.orderToApprove()?.id).toBe(1);
    expect(router.navigate).not.toHaveBeenCalled();
  });
  it('does not save the order again while waiting for an approval decision', async () => {
    component.savedOrderId.set(1);
    await component.save();
    expect(service.save).not.toHaveBeenCalled();
    expect(service.update).not.toHaveBeenCalled();
  });
  it('shows only the zone name in the warehouse-filtered combobox', async () => {
    const zones = TestBed.inject(ZoneService);
    const search = spyOn(zones, 'getZonesByName').and.returnValue(of([
      { id: 3, name: 'Bodega central / Estante A' },
      { id: 4, name: 'Patio' },
    ]));
    const row = newRow();
    component.rows.set([row]);
    component.chooseRowWarehouse(row, { id: 2, name: 'Bodega central' });
    await component.searchRowZones(row, '');
    expect(search).toHaveBeenCalledOnceWith(30, '', undefined, 2);
    expect(row.zoneOptions).toEqual([
      { id: 3, name: 'Estante A' }, { id: 4, name: 'Patio' },
    ]);
    component.chooseRowZone(row, row.zoneOptions?.[0] ?? null);
    expect(row.zone?.name).toBe('Estante A');
  });
  it('persists only each product zone, without its warehouse filter', async () => {
    component.selectedProvider.set({ id: 1, name: 'Proveedor' });
    const first = { ...newRow(), choice: 'existing', productId: 7, product: undefined } satisfies PurchaseRowDraft;
    const second = { ...newRow(), choice: 'existing', productId: 8, product: undefined } satisfies PurchaseRowDraft;
    component.rows.set([first, second]);
    component.chooseRowWarehouse(first, { id: 2, name: 'Bodega' });
    first.zoneOptions = [{ id: 3, name: 'Zona' }];
    component.chooseRowZone(first, { id: 3, name: 'Zona' });
    component.chooseRowWarehouse(second, { id: 4, name: 'Otra bodega' });
    await component.save();
    const payload = service.save.calls.mostRecent().args[0];
    expect(payload.warehouseId).toBeUndefined();
    expect(payload.details[0].suggestedZoneId).toBe(3);
    expect(payload.details[1].suggestedZoneId).toBeUndefined();
    expect(first.zone?.id).toBe(3);
  });
  it('reuses catalog lookups for identical interpreted lines and preserves source values', async () => {
    const products = TestBed.inject(ProductService);
    const product = { ...emptyProduct, id: 9, type: 'TIRE', name: '205/55R16 DUNLOP' };
    const search = spyOn(products, 'getProducts').and.returnValue(of({
      data: [product], meta: { page: 1, limit: 2, total: 1, totalPages: 1, hasNextPage: false, hasPreviousPage: false },
    }));
    const line = { number: 1, description: 'LLANTA 205/55R16 DUNLOP', quantity: 2, unitPrice: '25', code: null };
    service.preview.and.returnValue(of({
      identity: 'invoice', provider: { name: 'Proveedor', nrc: '', nit: '', email: '', phone: '' },
      providerMatch: null, brands: [{ id: 5, name: 'DUNLOP' }], lines: [line, { ...line, number: 2 }],
    }));
    component.mode.set('DOCUMENT');
    component.json.set(new File(['{}'], 'factura.json'));
    await component.interpret();
    expect(search).toHaveBeenCalledTimes(1);
    expect(component.rows().every(row => row.productId === 9 && row.description === line.description && row.quantity === 2 && row.unitPrice === '25')).toBeTrue();
  });
  it('dismisses the interpretation banner and restores it after replacing removed documents', async () => {
    const fixture = TestBed.createComponent(AssistedPurchaseComponent);
    const instance = fixture.componentInstance;
    instance.mode.set('DOCUMENT');
    const input = document.createElement('input');
    input.type = 'file';
    const upload = async (): Promise<void> => {
      const files = new DataTransfer();
      files.items.add(new File(['{}'], 'factura.json', { type: 'application/json' }));
      files.items.add(new File(['%PDF'], 'factura.pdf', { type: 'application/pdf' }));
      input.files = files.files;
      const event = new Event('change');
      input.dispatchEvent(event);
      Object.defineProperty(event, 'target', { value: input });
      await instance.filesChanged(event);
      fixture.detectChanges();
    };
    await upload();
    const close = fixture.debugElement.query(By.css('[aria-label="Cerrar aviso de interpretación"]'));
    expect(close).not.toBeNull();
    close.triggerEventHandler('click');
    fixture.detectChanges();
    expect(fixture.debugElement.query(By.css('[aria-label="Cerrar aviso de interpretación"]'))).toBeNull();
    await instance.removeFile('JSON');
    await instance.removeFile('PDF');
    await upload();
    expect(fixture.debugElement.query(By.css('[aria-label="Cerrar aviso de interpretación"]'))).not.toBeNull();
    service.preview.and.returnValue(of({ identity: 'test', provider: { name: 'Proveedor', nrc: '', nit: '', email: '', phone: '' }, providerMatch: null, brands: [], lines: [] }));
    await instance.interpret();
    fixture.detectChanges();
    expect(fixture.debugElement.query(By.css('[aria-label="Cerrar aviso de interpretación"]'))).toBeNull();
    fixture.destroy();
  });
  it('opens a local PDF with the shared PDF.js viewer', async () => {
    const fixture = TestBed.createComponent(AssistedPurchaseComponent);
    fixture.detectChanges();
    const file = new File(['%PDF-1.7\n'], 'factura.pdf', { type: 'application/pdf' });
    const viewer = fixture.debugElement.query(By.directive(PdfPreviewComponent)).injector.get(PdfPreviewComponent);
    const open = spyOn(viewer, 'open').and.resolveTo();
    fixture.componentInstance.pdf.set(file);
    await fixture.componentInstance.previewFile('PDF');
    expect(open).toHaveBeenCalledOnceWith(file, 'Factura de compra');
    fixture.destroy();
  });
  it('rejects a renamed non-PDF file before creating a preview URL', async () => {
    const url = spyOn(URL, 'createObjectURL').and.callThrough();
    component.pdf.set(new File(['<html>not a PDF</html>'], 'factura.pdf'));
    await component.previewFile('PDF');
    expect(url).not.toHaveBeenCalled();
    expect(TestBed.inject(AlertService).showError).toHaveBeenCalled();
  });
  beforeEach(() => {
    router = jasmine.createSpyObj<Router>('router', ['navigate']);
    router.navigate.and.returnValue(Promise.resolve(true));
    service = jasmine.createSpyObj<AssistedPurchaseService>('purchase', [
      'preview',
      'save',
      'update',
    ]);
    service.save.and.returnValue(
      of({ id: 1, documentNumber: 1, replayed: false }),
    );
    service.update.and.returnValue(
      of({ id: 8, documentNumber: 4, replayed: false }),
    );
    TestBed.configureTestingModule({
      providers: [
        { provide: PurchaseOrderService, useValue: { getPurchaseOrder: () => of({ ...emptyPurchaseOrder, id: 1 }) } },
        { provide: AssistedPurchaseService, useValue: service },
        { provide: BrandService, useValue: {} },
        { provide: ProviderService, useValue: {} },
        { provide: ProductService, useValue: { getProducts: () => of({ data: [], meta: { page: 1, limit: 2, total: 0, totalPages: 0, hasNextPage: false, hasPreviousPage: false } }) } },
        { provide: WarehouseService, useValue: {} },
        { provide: ZoneService, useValue: { getZonesByName: () => of([]) } },
        { provide: QueryClient, useValue: new QueryClient() },
        {
          provide: AlertService,
          useValue: jasmine.createSpyObj('alerts', [
            'showWarningList',
            'showSuccess',
            'showError',
            'showWarning',
          ]),
        },
        {
          provide: Router,
          useValue: router,
        },
      ],
    });
    TestBed.overrideComponent(AssistedPurchaseComponent, {
      set: {
        imports: [CurrencyPipe, FormsModule, ReactiveFormsModule, PdfPreviewComponent, ConfirmActionModalComponent],
        schemas: [NO_ERRORS_SCHEMA],
      },
    });
    component = TestBed.runInInjectionContext(
      () => new AssistedPurchaseComponent(),
    );
  });
  it('requires catalog selection rather than accepting a typed brand by default', () => {
    const row = newRow();
    expect(component.rowValid(row)).toBeFalse();
    component.chooseBrand(row, { id: 5, name: 'Dunlop' });
    row.ready = true;
    expect(component.rowValid(row)).toBeTrue();
    expect(row.brandName).toBe('Dunlop');
  });
  it('invalidates the prepared product when switching to an explicit new brand', () => {
    const row = newRow();
    component.chooseBrand(row, { id: 5, name: 'Dunlop' });
    row.ready = true;
    component.switchBrandMode(row, 'new');
    expect(row.brandSelected).toBeNull();
    expect(row.ready).toBeFalse();
    expect(row.brandName).toBe('');
  });
  it('saves without warehouse or zone suggestions', async () => {
    component.selectedProvider.set({ id: 1, name: 'Proveedor' });
    component.rows.set([
      { ...newRow(), choice: 'existing', productId: 2, product: undefined },
    ]);
    await component.save();
    expect(router.navigate).not.toHaveBeenCalled();
    expect(component.savedOrderId()).not.toBeNull();
    await component.approveLater();
    expect(router.navigate).toHaveBeenCalledWith(['/purchase-orders/list']);
    expect(service.save).toHaveBeenCalled();
    expect(service.save.calls.mostRecent().args[0].warehouseId).toBeUndefined();
    expect(
      service.save.calls.mostRecent().args[0].details[0].suggestedZoneId,
    ).toBeUndefined();
  });
  it('allows preparing a new product without an earlier cost and copies the modal cost for manual purchases', () => {
    const row = { ...newRow(), unitPrice: '', brandSelected: { id: 5, name: 'DUNLOP' } };
    component.rows.set([row]);
    component.prepare(row);
    expect(TestBed.inject(AlertService).showWarning).not.toHaveBeenCalled();
    component.supplyPrepared({ name: 'Insumo', purchasePrice: '12.50', salePrice: '20' });
    expect(row.unitPrice).toBe('12.50');
    expect(row.ready).toBeTrue();
    row.type = 'TIRE';
    row.unitPrice = '';
    component.prepare(row);
    component.tirePrepared({ purchasePrice: '15', salePrice: '25' });
    expect(row.unitPrice).toBe('15');
    component.mode.set('DOCUMENT');
    row.unitPrice = '10';
    component.tirePrepared({ purchasePrice: '99' });
    expect(row.unitPrice).toBe('10');
  });
  it('keeps the new brand input outside an accordion and reserves validation space', () => {
    const fixture = TestBed.createComponent(AssistedPurchaseComponent);
    const row = { ...newRow(), brandMode: 'new', brandName: '' } satisfies PurchaseRowDraft;
    fixture.componentInstance.rows.set([row]);
    fixture.detectChanges();
    const input = fixture.debugElement.query(By.css('input[maxlength="100"]'));
    expect(input).not.toBeNull();
    expect(input.nativeElement.closest('details')).toBeNull();
    row.brandName = 'D';
    fixture.detectChanges();
    expect(fixture.debugElement.query(By.css('input[maxlength="100"]')).nativeElement).toBe(input.nativeElement);
    row.brandName = '';
    fixture.detectChanges();
    expect(fixture.debugElement.query(By.css('input[maxlength="100"]')).nativeElement).toBe(input.nativeElement);
    expect(fixture.debugElement.queryAll(By.css('span.min-h-8')).length).toBe(2);
    fixture.componentInstance.attempted.set(true);
    fixture.detectChanges();
    expect(fixture.debugElement.queryAll(By.css('span.min-h-8')).length).toBe(2);
    fixture.destroy();
  });
  it('suggests unique pending brand names ignoring case and whitespace', () => {
    const current = { ...newRow(), brandMode: 'new' } satisfies PurchaseRowDraft;
    component.rows.set([current,
      { ...newRow(), brandMode: 'new', brandName: ' Dunlop ' },
      { ...newRow(), brandMode: 'new', brandName: 'dunlop' },
      { ...newRow(), brandMode: 'new', brandName: 'Dunlp' },
    ]);
    expect(component.brandSuggestions(current)).toEqual(['DUNLOP', 'DUNLP']);
  });
  it('shows prepared tire dimensions with abbreviated construction and brand only', () => {
    const row = { ...newRow(), type: 'TIRE', product: { type: 'TIRE', tire: { tire: { width: 205, aspectRatio: 55, rimDiameter: 16, construction: CONSTRUCTION.RADIAL } } } } satisfies PurchaseRowDraft;
    expect(component.rowName(row)).toBe('205/55R16 DUNLOP');
    const bias = { ...row, product: { ...row.product, tire: { tire: { ...row.product.tire.tire, construction: CONSTRUCTION.BIAS } } } };
    expect(component.rowName(bias)).toBe('205/55D16 DUNLOP');
  });
  it('places the add action after the products and scrolls to a solid error banner for duplicates', () => {
    let frame: FrameRequestCallback | undefined;
    spyOn(window, 'requestAnimationFrame').and.callFake(callback => { frame = callback; return 1; });
    const scroll = spyOn(HTMLElement.prototype, 'scrollIntoView');
    const fixture = TestBed.createComponent(AssistedPurchaseComponent);
    fixture.componentInstance.rows.set([
      { ...newRow(), choice: 'existing', productId: 7 },
      { ...newRow(), choice: 'existing', productId: 7 },
    ]);
    fixture.detectChanges();
    const banner = fixture.debugElement.query(By.css('.alert-error'));
    expect(banner).not.toBeNull();
    expect(banner.classes['alert-soft']).not.toBeTrue();
    expect(banner.nativeElement.closest('article')?.dataset.purchaseRow).toBe(fixture.componentInstance.rows()[1].key);
    expect(fixture.debugElement.queryAll(By.css('article.border-error')).length).toBe(2);
    expect(banner.nativeElement.textContent).toContain('Producto duplicado');
    expect(banner.nativeElement.textContent).toContain('líneas 1, 2');
    frame?.(0);
    expect(scroll).toHaveBeenCalledWith(jasmine.objectContaining({ block: 'center' }));
    const add = fixture.debugElement.query(By.css('button.btn-success'));
    expect(add.nativeElement.previousElementSibling?.tagName).toBe('ARTICLE');
    fixture.destroy();
  });
  it('previews a prepared new product without requesting a catalog record', async () => {
    const row = { ...newRow(), draftCatalog: { unit: { id: 59, name: 'Unidad' } }, product: { type: 'SUPPLY', brandId: 5, supply: { name: 'Aceite', notes: 'Detalle', salePrice: '15', unitOfMeasureCatalogId: 59 } } } satisfies PurchaseRowDraft;
    await component.showProduct(row);
    expect(component.quickDraft()).toBeTrue();
    expect(component.quickProduct()?.name).toBe('Aceite');
    expect(component.quickProduct()?.notes).toBe('Detalle');
    expect(component.quickProduct()?.unitOfMeasureCatalog?.name).toBe('Unidad');
    expect(service.save).not.toHaveBeenCalled();
  });
  it('offers modifying duplicates, asks again on save and merges only after confirmation', async () => {
    const fixture = TestBed.createComponent(AssistedPurchaseComponent);
    const instance = fixture.componentInstance;
    instance.selectedProvider.set({ id: 1, name: 'Proveedor' });
    const numericRow = { ...newRow(), choice: 'existing', productId: 7, quantity: 2 } satisfies PurchaseRowDraft;
    Object.assign(numericRow, { unitPrice: 25 });
    instance.rows.set([numericRow, { ...newRow(), choice: 'existing', productId: 7, quantity: 3, unitPrice: '25' }]);
    fixture.detectChanges();
    instance.decisionModal()?.onCancel();
    await Promise.resolve();
    expect(instance.rows().length).toBe(2);
    const saving = instance.save();
    expect(instance.decisionTitle()).toBe('Producto duplicado');
    instance.decisionModal()?.onCancel();
    await saving;
    expect(service.save).not.toHaveBeenCalled();
    const merging = instance.resolveDuplicateProducts();
    instance.decisionModal()?.onConfirm();
    await merging;
    expect(instance.rows().length).toBe(1);
    expect(instance.rows()[0].quantity).toBe(5);
    fixture.destroy();
  });
  it('preserves original JSON lines and amounts when a visual group is unified', async () => {
    const fixture = TestBed.createComponent(AssistedPurchaseComponent);
    const instance = fixture.componentInstance;
    const lines = [{ number: 1, description: 'Original 1', quantity: 2, unitPrice: '10', code: null }, { number: 2, description: 'Original 2', quantity: 3, unitPrice: '10', code: null }];
    instance.mode.set('DOCUMENT'); instance.sourceReady.set(true);
    instance.source.set({ identity: 'test', provider: { name: 'Proveedor', nrc: '', nit: '', phone: '', email: '' }, providerMatch: null, brands: [], lines });
    instance.selectedProvider.set({ id: 1, name: 'Proveedor' });
    instance.rows.set(lines.map(line => ({ ...newRow(), choice: 'existing', productId: 7, quantity: line.quantity, description: line.description, sourceLine: line.number })));
    fixture.detectChanges();
    instance.decisionModal()?.onConfirm();
    await Promise.resolve();
    expect(instance.rows().length).toBe(1);
    await instance.save();
    const payload = service.save.calls.mostRecent().args[0];
    expect(payload.details.map(line => ({ description: line.description, quantity: line.quantity, sourceLine: line.sourceLine }))).toEqual(lines.map(line => ({ description: line.description, quantity: line.quantity, sourceLine: line.number })));
    expect(payload.details.reduce((sum, line) => sum + line.quantity * Number(line.unitPrice), 0)).toBe(50);
    fixture.destroy();
  });
  it('hides dependent options without a supported type and clears stale product state on changes', () => {
    const fixture = TestBed.createComponent(AssistedPurchaseComponent);
    const instance = fixture.componentInstance;
    const row = { ...newRow(), type: '' } satisfies PurchaseRowDraft;
    instance.rows.set([row]);
    fixture.detectChanges();
    expect(fixture.debugElement.query(By.css('input[inputmode="decimal"]'))).toBeNull();
    expect(fixture.debugElement.query(By.css('input[maxlength="100"]'))).toBeNull();
    instance.changeProductType(row, 'SUPPLY');
    fixture.detectChanges();
    expect(fixture.debugElement.query(By.css('input[inputmode="decimal"]'))).not.toBeNull();
    row.productId = 7; row.ready = true; row.prepared = true;
    instance.changeProductType(row, 'TIRE');
    expect(row.productId).toBeUndefined();
    expect(row.product).toBeUndefined();
    expect(row.ready).toBeFalse();
    expect(row.prepared).toBeFalse();
    instance.changeProductType(row, 'SERVICE');
    fixture.detectChanges();
    expect(row.type).toBe('');
    expect(fixture.debugElement.query(By.css('input[inputmode="decimal"]'))).toBeNull();
    instance.changeProductType(row, 'SUPPLY');
    fixture.detectChanges();
    expect(fixture.debugElement.query(By.css('input[inputmode="decimal"]'))).not.toBeNull();
    fixture.destroy();
  });
  it('serializes the line cost as a string when a numeric input emits a number', async () => {
    component.selectedProvider.set({ id: 1, name: 'Proveedor' });
    const row = { ...newRow(), choice: 'existing', productId: 7 } satisfies PurchaseRowDraft;
    Object.assign(row, { unitPrice: 25 });
    component.rows.set([row]);
    await component.save();
    expect(service.save).toHaveBeenCalled();
    expect(service.save.calls.mostRecent().args[0].details[0].unitPrice).toBe('25');
  });
  it('normalizes numeric prices returned by either product modal before storing the draft', () => {
    const row = { ...newRow(), unitPrice: '', brandSelected: { id: 5, name: 'DUNLOP' } };
    component.rows.set([row]);
    component.prepare(row);
    const supply = { name: 'Insumo', salePrice: '26', purchasePrice: '25' };
    Object.assign(supply, { salePrice: 26, purchasePrice: 25 });
    component.supplyPrepared(supply);
    expect(row.unitPrice).toBe('25');
    expect(row.product?.supply?.purchasePrice).toBe('25');
    expect(row.product?.supply?.salePrice).toBe('26');
    component.changeProductType(row, 'TIRE');
    component.prepare(row);
    const tire = { salePrice: '26', purchasePrice: '25' };
    Object.assign(tire, { salePrice: 26, purchasePrice: 25 });
    component.tirePrepared(tire);
    expect(row.unitPrice).toBe('25');
    expect(row.product?.tire?.purchasePrice).toBe('25');
    expect(row.product?.tire?.salePrice).toBe('26');
  });
  it('detects the reported new tire drafts before sending and saves one line only after unifying', async () => {
    const fixture = TestBed.createComponent(AssistedPurchaseComponent);
    const instance = fixture.componentInstance;
    instance.selectedProvider.set({ id: 2, name: 'Proveedor' });
    const first = { ...newRow(), brandMode: 'new', brandName: 'AUSTONE', type: 'TIRE' } satisfies PurchaseRowDraft;
    Object.assign(first, { unitPrice: 25, product: { type: 'TIRE', brand: { name: 'AUSTONE' }, tire: { notes: '', salePrice: 26, purchasePrice: 25, itemTypeCatalogId: 1, unitOfMeasureCatalogId: 35, tire: { prefix: '', width: 225, aspectRatio: 50, construction: 'RADIAL', rimDiameter: 15, loadRange: '', plies: 0, condition: 'NEW', quality: 'A', vehicleTypeId: [2] } } } });
    const second = { ...first, key: crypto.randomUUID(), unitPrice: '25', product: { ...first.product, type: 'TIRE', tire: { ...first.product?.tire, purchasePrice: '25' } } } satisfies PurchaseRowDraft;
    instance.rows.set([first, second]);
    fixture.detectChanges();
    expect(instance.duplicateProducts()).toEqual([[1, 2]]);
    expect(instance.decisionTitle()).toBe('Producto duplicado');
    expect(fixture.debugElement.query(By.css('[role="alert"]')).nativeElement.textContent).toContain('Producto duplicado');
    instance.decisionModal()?.onCancel();
    await Promise.resolve();
    const saving = instance.save();
    instance.decisionModal()?.onCancel();
    await saving;
    expect(service.save).not.toHaveBeenCalled();
    const merging = instance.resolveDuplicateProducts();
    instance.decisionModal()?.onConfirm();
    await merging;
    await instance.save();
    expect(service.save).toHaveBeenCalledTimes(1);
    const lines = service.save.calls.mostRecent().args[0].details;
    expect(lines.length).toBe(1);
    expect(lines[0].quantity).toBe(2);
    expect(lines[0].unitPrice).toBe('25');
    fixture.destroy();
  });
  it('uses the final line cost when the product was prepared without a cost', async () => {
    component.selectedProvider.set({ id: 1, name: 'Proveedor' });
    const row = { ...newRow(), brandMode: 'new', unitPrice: '25', product: { type: 'SUPPLY', brand: { name: 'DUNLOP' }, supply: { name: 'Insumo', salePrice: '26', purchasePrice: '' } } } satisfies PurchaseRowDraft;
    component.rows.set([row]);
    await component.save();
    const line = service.save.calls.mostRecent().args[0].details[0];
    expect(line.unitPrice).toBe('25');
    expect(line.product?.supply?.purchasePrice).toBe('25');
    expect(row.product.supply.purchasePrice).toBe('');
  });
  it('identifies missing fields after saving, and clears errors once completed', async () => {
    component.providerMode.set('new');
    expect(component.providerFieldError('name')).toBeNull();
    await component.save();
    expect(component.providerFieldError('name')).toBe('* Obligatorio');
    component.providerForm.controls.name.setValue('Proveedor');
    expect(component.providerFieldError('name')).toBeNull();
    expect(service.save).not.toHaveBeenCalled();
  });
  it('identifies missing row fields when preparing a product', () => {
    const row: PurchaseRowDraft = {
      ...newRow(),
      type: '',
      brandName: '',
      unitPrice: '',
    };
    expect(component.rowFieldError(row, 'brand')).toBeNull();
    component.prepare(row);
    expect(component.rowFieldError(row, 'brand')).toBe('* Obligatorio');
    expect(component.rowFieldError(row, 'type')).toBe('* Obligatorio');
    expect(component.rowFieldError(row, 'cost')).toBe('* Obligatorio');
    row.unitPrice = '-1';
    expect(component.rowFieldError(row, 'cost')).toContain('mayor que cero');
  });

  it('renders the missing provider field in red with a required message', async () => {
    const fixture = TestBed.createComponent(AssistedPurchaseComponent);
    fixture.componentInstance.providerMode.set('new');
    fixture.detectChanges();
    await fixture.componentInstance.save();
    fixture.detectChanges();
    const host: unknown = fixture.nativeElement;
    if (!(host instanceof HTMLElement))
      throw new Error('Expected a component host');
    const name = host.querySelector<HTMLInputElement>(
      'input[formControlName="name"]',
    );
    expect(name?.classList.contains('input-error')).toBeTrue();
    expect(name?.getAttribute('aria-invalid')).toBe('true');
    expect(name?.parentElement?.textContent).toContain('* Obligatorio');
    fixture.componentInstance.providerForm.controls.name.setValue('Proveedor');
    fixture.detectChanges();
    expect(name?.classList.contains('input-error')).toBeFalse();
    expect(name?.parentElement?.textContent).not.toContain('* Obligatorio');
  });
  it('refreshes OnPush provider validation after form value changes', async () => {
    const fixture = TestBed.createComponent(AssistedPurchaseComponent);
    fixture.componentInstance.providerMode.set('new');
    fixture.autoDetectChanges();
    await fixture.componentInstance.save();
    await fixture.whenStable();
    const name = fixture.debugElement.query(By.css('input[formControlName="name"]'));
    expect(name.classes['input-error']).toBeTrue();
    fixture.componentInstance.providerForm.controls.name.setValue('Proveedor');
    await fixture.whenStable();
    expect(name.classes['input-error']).toBeFalsy();
    fixture.destroy();
  });

  it('loads existing purchases into the new view and updates the same order', async () => {
    component.loadOrder({
      ...emptyPurchaseOrder,
      id: 8,
      documentNumber: 4,
      provider: { id: 2, name: 'Proveedor' },
      providerId: 2,
      details: [
        {
          id: 1,
          product: { id: 3, name: 'Llanta' },
          quantity: 2,
          unitPrice: '10',
          subtotal: '20',
          suggestedZoneId: null,
          suggestedZone: null,
        },
      ],
    });
    expect(component.isEditing()).toBeTrue();
    expect(component.rows()[0].productId).toBe(3);
    component.rows()[0].quantity = 3;
    component.markChanged();
    await component.save();
    expect(service.update).toHaveBeenCalledWith(
      8,
      jasmine.objectContaining({
        details: [jasmine.objectContaining({ productId: 3, quantity: 3 })],
      }),
    );
    expect(service.save).not.toHaveBeenCalled();
    expect(router.navigate).not.toHaveBeenCalled();
    expect(component.savedOrderId()).not.toBeNull();
    await component.approveLater();
    expect(router.navigate).toHaveBeenCalledWith(['/purchase-orders/list']);
  });
  it('blocks changes to completed orders', async () => {
    component.loadOrder({
      ...emptyPurchaseOrder,
      id: 8,
      status: PURCHASE_ORDER_STATUS.COMPLETED,
    });
    expect(component.readOnly()).toBeTrue();
    expect(component.locked()).toBeTrue();
    component.addRow();
    await component.save();
    expect(component.rows().length).toBe(0);
    expect(service.update).not.toHaveBeenCalled();
  });
  it('keeps documentary purchases in their original restricted mode', () => {
    component.loadOrder({
      ...emptyPurchaseOrder,
      id: 8,
      sourceIdentity: 'invoice',
    });
    expect(component.mode()).toBe('DOCUMENT');
    expect(component.sourceReady()).toBeFalse();
    component.addRow();
    expect(component.rows().length).toBe(0);
  });
  it('includes a prepared new product in the transactional update', async () => {
    component.loadOrder({
      ...emptyPurchaseOrder,
      id: 8,
      provider: { id: 2, name: 'Proveedor' },
      providerId: 2,
    });
    const row = newRow();
    component.chooseBrand(row, { id: 5, name: 'Dunlop' });
    row.ready = true;
    component.rows.set([row]);
    await component.save();
    expect(service.update).toHaveBeenCalledWith(
      8,
      jasmine.objectContaining({
        details: [jasmine.objectContaining({ product: { ...row.product, supply: { ...row.product?.supply, purchasePrice: row.unitPrice } } })],
      }),
    );
    expect(service.save).not.toHaveBeenCalled();
  });

  it('does not send an update if the order has not changed', async () => {
    component.loadOrder({
      ...emptyPurchaseOrder,
      id: 8,
      provider: { id: 2, name: 'Proveedor' },
      providerId: 2,
    });
    expect(component.hasEditChanges()).toBeFalse();
    await component.save();
    expect(service.update).not.toHaveBeenCalled();
  });
});
